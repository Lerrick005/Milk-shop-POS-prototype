import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "Milk Shop POS",
                short_name: "ShopPOS",
                description: "Offline-first point of sale for a milk shop",
                theme_color: "#0f172a",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "portrait",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png"
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
                navigateFallback: "/index.html",
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true
            },
            devOptions: {
                enabled: false
            }
        })
    ],
    server: {
        port: 5173,
        host: true
    },
    build: {
        target: "es2020",
        sourcemap: false
    }
});
