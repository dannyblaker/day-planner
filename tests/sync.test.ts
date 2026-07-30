import { useApp } from "@/lib/store";
import { usePlanSync } from "@/lib/sync";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, resetStore } from "./app-state";
import { makeDay, makePlan, makeTask, resetFactory } from "./factory";

const DEBOUNCE = 600;

/** let the mount effect's promises settle */
const flush = () => act(async () => {});
const saved = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT");

let fetchMock: ReturnType<typeof vi.fn>;

function mockServer(plan: unknown) {
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? ({ json: async () => ({ ok: true }) } as Response)
      : ({ json: async () => plan } as Response)
  );
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
  resetStore(); // after the clock is pinned: the reset re-dates the seed from it
});

describe("loading", () => {
  it("puts the server's plan into the store", async () => {
    const plan = makePlan([makeDay([makeTask({ title: "From the server" })])]);
    mockServer(plan);
    renderHook(() => usePlanSync());
    await flush();

    expect(app().loaded).toBe(true);
    expect(app().plan.days["2026-07-28"].tasks[0].title).toBe("From the server");
  });

  it("publishes the seeded plan on a first run, so the share link works at once", async () => {
    mockServer(null);
    renderHook(() => usePlanSync());
    await flush();

    expect(saved()).toHaveLength(1);
    expect(JSON.parse(saved()[0][1]!.body as string).shareToken).toBe(
      app().plan.shareToken
    );
  });

  it("falls back to localStorage when the server is unreachable", async () => {
    const cached = makePlan([makeDay([makeTask({ title: "From the cache" })])]);
    localStorage.setItem("dayflow-plan", JSON.stringify(cached));
    fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => usePlanSync());
    await flush();

    expect(app().plan.days["2026-07-28"].tasks[0].title).toBe("From the cache");
  });

  it("does not echo the loaded plan back to the server", async () => {
    mockServer(makePlan([makeDay()]));
    renderHook(() => usePlanSync());
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 2);
    });
    expect(saved()).toHaveLength(0);
  });

  it("starts saving once the load has landed", async () => {
    mockServer(makePlan([makeDay()]));
    renderHook(() => usePlanSync());
    await flush();

    act(() => void app().quickAdd("Added after loading"));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(saved()).toHaveLength(1);
  });

  it("still starts up when both the server and the cache are empty", async () => {
    fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => usePlanSync());
    await flush();

    expect(app().loaded).toBe(true);
    expect(app().plan.days).toBeDefined();
  });
});

describe("saving", () => {
  beforeEach(async () => {
    mockServer(makePlan([makeDay()]));
    renderHook(() => usePlanSync());
    await flush();
    fetchMock.mockClear();
  });

  it("saves after a change, once the typing settles", async () => {
    act(() => void app().quickAdd("Something new"));
    expect(saved()).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(saved()).toHaveLength(1);
    expect(JSON.parse(saved()[0][1]!.body as string).days["2026-07-28"].tasks).toHaveLength(1);
  });

  it("coalesces a burst of edits into a single save", async () => {
    act(() => {
      app().quickAdd("One");
      app().quickAdd("Two");
      app().quickAdd("Three");
    });
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(saved()).toHaveLength(1);
  });

  it("mirrors every save into localStorage as an offline fallback", async () => {
    act(() => void app().quickAdd("Something new"));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    const cached = JSON.parse(localStorage.getItem("dayflow-plan")!);
    expect(cached.days["2026-07-28"].tasks[0].title).toBe("Something new");
  });

  it("raises and lowers the saving flag around the write", async () => {
    const seen: boolean[] = [];
    const unsub = useApp.subscribe((s) => seen.push(s.saving));
    act(() => void app().quickAdd("Something new"));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    unsub();
    expect(seen).toContain(true);
    expect(app().saving).toBe(false);
  });

  it("does not save when nothing about the plan changed", async () => {
    act(() => app().select("nothing-real"));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(saved()).toHaveLength(0);
  });

  it("stops saving once unmounted", async () => {
    const { unmount } = renderHook(() => usePlanSync());
    await flush();
    fetchMock.mockClear();
    unmount();

    act(() => void app().quickAdd("After unmount"));
    await act(async () => {
      vi.advanceTimersByTime(DEBOUNCE * 2);
    });
    // the first hook is still mounted, so exactly one save — not two
    expect(saved()).toHaveLength(1);
  });
});
