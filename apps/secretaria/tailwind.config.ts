import type { Config } from "tailwindcss";

function rgbVar(name: string) {
  return `rgb(var(${name}) / <alpha-value>)`;
}

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: rgbVar("--bg"),
        "bg-subtle": rgbVar("--bg-subtle"),
        surface: rgbVar("--surface"),
        "surface-hover": rgbVar("--surface-hover"),
        border: rgbVar("--border"),
        "border-strong": rgbVar("--border-strong"),
        fg: rgbVar("--fg"),
        "fg-muted": rgbVar("--fg-muted"),
        "fg-subtle": rgbVar("--fg-subtle"),
        brand: rgbVar("--brand"),
        "brand-hover": rgbVar("--brand-hover"),
        "brand-fg": rgbVar("--brand-fg"),
        p0: rgbVar("--p0"),
        p1: rgbVar("--p1"),
        p2: rgbVar("--p2"),
        p3: rgbVar("--p3"),
        ok: rgbVar("--ok"),
        "at-risk": rgbVar("--at-risk"),
        overdue: rgbVar("--overdue"),
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
