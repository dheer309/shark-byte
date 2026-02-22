import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

export default defineConfig({
  plugins: [react()],
  server: {
    //host: "10.189.30.32",
    //host: "10.190.142.214",
    //host: "10.200.184.214",
    host: "10.70.159.4",
    //host: "10.189.30.56",
    https: {
      key: readFileSync("key.pem"),
      cert: readFileSync("cert.pem"),
    },
    proxy: {
      "/api": "http://localhost:5001",
    },
  },
});
