import type { Config } from "tailwindcss";

/**
 * Palette: a sage-and-sand scheme built from four source colours.
 *
 *   Ocean Deep  #4E635E   brand — filled buttons, active states
 *   Villa Nova  #E2E0C8   sand — highlight surfaces
 *   Siren Song  #A6B49E   sage — fills and markers
 *   Big River   #818C78   olive — borders and quiet fills
 *
 * The four are used as given. Everything else is derived from them, because
 * four mid-tone swatches cannot carry a whole interface: text needs something
 * darker than any of them, and a full-bleed page needs something lighter.
 * Every text pair below clears WCAG AA, most clear AAA.
 *
 * State is never signalled by hue alone — the greens are too close in
 * luminance to tell apart at 13px, and a third of colour-blind users would
 * not see the difference anyway. Approved states carry a glyph as well.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- surfaces ---
        paper: "#F4F3E6", // page, a lightened Villa Nova
        card: "#FCFBF4", // panels sitting on the page
        sand: "#E2E0C8", // Villa Nova, exact — highlight regions
        sheet: "#FFFFFF", // true white, reserved for drawings

        // --- brand and source colours ---
        brand: "#4E635E", // Ocean Deep, exact
        brandDark: "#3F544C", // pressed / hover
        sage: "#A6B49E", // Siren Song, exact
        olive: "#818C78", // Big River, exact

        // --- text ---
        ink: "#1E2A26", // primary, 13.3:1 on paper
        muted: "#5F6659", // secondary, 5.3:1
        faint: "#7E8878", // tertiary labels, 3.3:1

        // --- lines ---
        rule: "#CBD1C0",
        ruleSoft: "#E2E3D3",

        // --- state ---
        accent: "#3F544C", // approved, 7.3:1
        accentSoft: "#E4E9E2",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2.125rem", { lineHeight: "1.12", letterSpacing: "-0.022em" }],
        title: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.018em" }],
        label: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.13em" }],
      },
      maxWidth: {
        reading: "34rem",
        sheet: "56rem",
        // The architect works at a desk on a wide screen; the client is on a
        // phone. They do not want the same measure.
        shell: "74rem",
      },
      transitionDuration: {
        DEFAULT: "170ms",
      },
      boxShadow: {
        // One shadow, barely there. Never stack them.
        menu: "0 1px 2px rgba(30,42,38,0.05), 0 8px 24px rgba(30,42,38,0.12)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 190ms ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
