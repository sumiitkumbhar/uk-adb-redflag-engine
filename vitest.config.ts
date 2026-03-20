// vitest.config.ts  (place in project root: same level as package.json)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
    // If your tests import TS files from /lib, this helps path issues:
    // deps: { inline: [/next/, /react/] },
  },
});