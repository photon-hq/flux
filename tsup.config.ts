import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  dts: true,
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
