import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), "");
    var apiPort = env.PORT || "4000";
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                "/api": "http://localhost:".concat(apiPort)
            }
        },
        preview: {
            allowedHosts: true,
            proxy: {
                "/api": "http://localhost:".concat(apiPort)
            }
        }
    };
});
