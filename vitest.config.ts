import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["test/sleuth/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": resolve(projectRoot, "."),
    },
  },
});
