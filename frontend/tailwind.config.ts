// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: "var(--bg)",
                surface: "var(--surface)",
                border: "var(--border)",
                accent: "var(--accent)",
                accent2: "var(--accent2)",
                accent3: "var(--accent3)",
                text: "var(--text)",
                muted: "var(--muted)",
                pump: "var(--pump)",
                dump: "var(--dump)",
                watch: "var(--watch)",
            },
            fontFamily: {
                mono: ["Share Tech Mono", "monospace"],
                display: ["Syne", "sans-serif"],
                body: ["DM Sans", "sans-serif"],
            },
        },
    },
    plugins: [],
};

export default config;
