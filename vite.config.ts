import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "esnext" },
  server: { host: "127.0.0.1" }
});
