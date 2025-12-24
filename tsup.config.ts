import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: "es2022",
  outDir: "dist",
  platform: "node",
  splitting: false,
  bundle: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Bundle everything - no externals
  noExternal: [/.*/],
});
