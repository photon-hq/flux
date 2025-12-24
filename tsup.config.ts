import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Don't bundle grpc - it has native dependencies and CommonJS require() calls
  external: ["@grpc/grpc-js", "nice-grpc", "nice-grpc-common"],
});
