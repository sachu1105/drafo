import type { Config } from "tailwindcss";

/**
 * Palette: a sage-and-sand scheme built from four source colours, in two
 * themes.
 *
 * The values live in globals.css as CSS variables; this file only names them.
 * See that file for the dark set and for why each step lands where it does.
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
  // The theme is chosen by a `data-theme` attribute on <html>, set before
  // first paint by an inline script. Not Tailwind's `dark:` variant: with the
  // palette behind variables there is nothing for a `dark:` prefix to do, and
  // a codebase where half the colours switch by themselves and half need a
  // prefix is one where somebody always forgets the prefix.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      /* Every colour is a variable, and the variables are defined twice --
         once for the light theme and once for the dark one, in globals.css.
         Nothing here changes between them, which is the point: a component
         asks for `bg-card` and gets the right surface for whichever theme is
         on, with no `dark:` prefix anywhere in the codebase.

         The channels are stored bare (`244 243 230`) rather than as a colour,
         so `<alpha-value>` still works. That is not a detail -- `bg-ink/50`,
         `text-sand/85` and `bg-paper/95` are all in use, and a plain
         `var(--ink)` would have broken every one of them silently. */
      colors: {
        // --- surfaces ---
        paper: "rgb(var(--paper) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        sand: "rgb(var(--sand) / <alpha-value>)",
        // True white in both themes, and reserved for drawings: a plan is ink
        // on white paper, and showing one on a dark ground is showing a
        // different drawing.
        sheet: "rgb(var(--sheet) / <alpha-value>)",

        // --- brand and source colours ---
        brand: "rgb(var(--brand) / <alpha-value>)",
        brandDark: "rgb(var(--brand-dark) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        olive: "rgb(var(--olive) / <alpha-value>)",

        // --- text ---
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",

        // --- lines ---
        rule: "rgb(var(--rule) / <alpha-value>)",
        ruleSoft: "rgb(var(--rule-soft) / <alpha-value>)",

        // --- material swatches ---
        // Lifted pixel-for-pixel from the sample board in the hero drawing:
        // wood, stone and a sage laminate. They ground the three feature
        // panels, so each drawing sits on a material rather than on paper.
        // Fixed in both themes -- they are photographs of materials, and a
        // teak sample is not a different colour at night.
        swatchWood: "#E4C1A0",
        swatchStone: "#E8E2DC",
        swatchSage: "#859388",

        // --- state ---
        accent: "rgb(var(--accent) / <alpha-value>)",
        accentSoft: "rgb(var(--accent-soft) / <alpha-value>)",
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
        // Two, and never stacked on one element. They are different jobs:
        // `menu` is a surface that has left the page -- a dropdown, a popover.
        // `lift` is a card that is still on the page and has merely been
        // pointed at, so it is about half the strength; any more and a hover
        // reads as something that has opened.
        // The shadow colour is a variable too. A shadow tuned for ink on
        // cream is invisible on a dark page: what reads as depth there is a
        // heavier, blacker cast, not the same one at the same strength.
        menu: "0 1px 2px rgb(var(--shadow) / var(--shadow-a1)), 0 8px 24px rgb(var(--shadow) / var(--shadow-a2))",
        lift: "0 1px 2px rgb(var(--shadow) / var(--shadow-a3)), 0 4px 10px rgb(var(--shadow) / var(--shadow-a4))",
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
