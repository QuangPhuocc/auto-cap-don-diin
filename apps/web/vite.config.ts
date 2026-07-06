import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "4000";
  console.log("--- DEBUG VITE CONFIG ---");
  console.log("process.cwd():", process.cwd());
  console.log("env.PORT:", env.PORT);
  console.log("process.env.PORT:", process.env.PORT);
  console.log("Final apiPort:", apiPort);
  console.log("-------------------------");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": `http://localhost:${apiPort}`
      }
    },
    preview: {
      allowedHosts: true,
      proxy: {
        "/api": `http://localhost:${apiPort}`
      }
    }
  };
});
