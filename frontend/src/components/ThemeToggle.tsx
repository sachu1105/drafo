"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

/**
 * Light, dark, or whatever the machine is doing.
 *
 * Three states rather than two, and the third is the default. A visitor who
 * has set their laptop to turn dark in the evening has already said what they
 * want, and a product that ignores that until it is told again is one that
 * flashes white at them at ten at night. So until somebody presses this, the
 * page follows the system -- and the moment they do press it, it stops, which
 * is the other half of the contract: an explicit choice has to stick.
 *
 * Rendered as a segmented control, not a switch. A two-state toggle cannot
 * express "follow the system", and the common workaround -- a switch you long
 * press, or a menu behind an icon -- hides the one state most people want.
 *
 * Nothing is drawn until the effect has run. The server does not know what is
 * in localStorage, so rendering a state on the server would guarantee it is
 * wrong for somebody and hydrate into a mismatch; the strip keeps its size
 * and stays blank for one frame instead.
 */

type Choice = "light" | "dark" | "system";

const CHOICES: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Follow the system", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export const THEME_KEY = "drafo.theme";

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    setChoice(readChoice());
  }, []);

  function pick(next: Choice) {
    setChoice(next);
    try {
      if (next === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing. The page still changes; it just will not be
      // remembered, which is better than refusing to change.
    }
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-full border border-rule p-0.5"
    >
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const on = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            onClick={() => pick(value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full
                        transition-colors duration-150 ${
                          on
                            ? "bg-brand text-paper"
                            : "text-faint hover:text-ink"
                        }`}
          >
            {/* Invisible rather than absent until the choice is known, so the
                strip does not change width on hydration. */}
            <Icon
              aria-hidden
              size={14}
              strokeWidth={1.75}
              className={choice === null ? "invisible" : ""}
            />
          </button>
        );
      })}
    </div>
  );
}

function readChoice(): Choice {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* blocked storage reads as "no choice made", which is the right default */
  }
  return "system";
}

function applyTheme(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/**
 * The same decision, taken before the page paints.
 *
 * Injected into <head> as a blocking script, which is the one place a
 * blocking script earns its keep: the alternative is the browser painting a
 * cream page and React repainting it black a moment later, and that flash is
 * the single most noticeable bug a dark theme can have.
 *
 * It is a string rather than a function because it has to be inlined into the
 * document before any bundle loads. Kept to what it must do and nothing else.
 */
export const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var dark = stored === 'dark' || (!stored &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;
