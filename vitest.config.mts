import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // `@/…` imports come from tsconfig paths — Vite resolves these natively now,
  // so no vite-tsconfig-paths plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // e2e/ belongs to Playwright, which has its own runner
    exclude: ["e2e/**", "node_modules/**"],
    restoreMocks: true,
  },
});
