import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
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
  // Bundle everything except native grpc module
  external: [
    "@grpc/grpc-js",
  ],
  // Force bundle better-grpc and its dependencies
  noExternal: [
    "better-grpc",
    "it-pushable",
    "nice-grpc",
    "nice-grpc-common",
    "zod",
  ],
});
