import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for pure app logic. Scoped to src/ (the scrapers workspace has its
// own tests) and node environment. The "@/..." alias mirrors tsconfig paths.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
