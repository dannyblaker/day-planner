"use client";

import { planDocument } from "./plan-doc";
import { Plan } from "./types";

/** Match the exported image to whatever theme is on screen. */
const bg = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim() || "#0b1410";

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * The plan as data rather than a picture: every task, every dependency, and the
 * derived state, in the same document GET /api/export serves — built here from
 * what is on screen so the download is what you are looking at, whether or not
 * the last autosave has landed.
 */
export function exportJSON(plan: Plan, name: string) {
  const doc = planDocument(plan);
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  download(url, `${name}-${doc.exportedAt.slice(0, 10)}.json`);
  // the click is synchronous, but the fetch of the blob may not be
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportPNG(node: HTMLElement, name: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(node, { backgroundColor: bg(), pixelRatio: 2 });
  download(url, `${name}.png`);
}

export async function exportPDF(node: HTMLElement, name: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(node, { backgroundColor: bg(), pixelRatio: 2 });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  const { jsPDF } = await import("jspdf");
  const w = img.width / 2;
  const h = img.height / 2;
  const pdf = new jsPDF({
    orientation: h >= w ? "portrait" : "landscape",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(url, "PNG", 0, 0, w, h);
  pdf.save(`${name}.pdf`);
}
