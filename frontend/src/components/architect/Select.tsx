"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type Choice = {
  value: string;
  label: string;
  /** A second line, quieter. For an option that needs explaining. */
  note?: string;
};

/**
 * A dropdown the page draws itself.
 *
 * The native select was styled as far as styling goes: the closed control
 * takes a border and a custom arrow, and then the list that opens is the
 * operating system's -- system font, system grey, a blue highlight that
 * belongs to no palette here. On a page built out of sage, sand and hairlines
 * it is the one element that looks borrowed, which is the same complaint the
 * .select class already makes about the closed control.
 *
 * So the list is ours: the card surface, a sage mark on the row under the
 * cursor, a tick against the one in force, and the quiet text weight used
 * everywhere else.
 *
 * Everything the native control gave away free has to be paid back by hand,
 * and this is the part worth being careful about -- a handsome dropdown that
 * cannot be driven from a keyboard is a worse control than the plain one:
 *
 *   Up / Down    move, opening the list if it is shut
 *   Enter        take the one under the marker
 *   Escape       leave it as it was
 *   Home / End   first, last
 *   a-z          jump to what starts with those letters
 *   Tab          close and move on
 *
 * The closed control keeps the geometry of the fields beside it. Only the
 * list is new: a trigger that suddenly looked different from the Item box
 * next to it would trade one inconsistency for another.
 */
export function Select({
  value,
  onChange,
  choices,
  placeholder = "—",
  id,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  choices: Choice[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });

  const chosen = choices.find((choice) => choice.value === value) ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the marked row in view when the keyboard moves it.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    if (disabled) return;
    setActive(Math.max(0, choices.findIndex((choice) => choice.value === value)));
    setOpen(true);
  }

  function take(index: number) {
    const choice = choices[index];
    if (choice) onChange(choice.value);
    setOpen(false);
  }

  function step(by: number) {
    setActive((at) => {
      const next = at + by;
      if (next < 0) return choices.length - 1;
      if (next >= choices.length) return 0;
      return next;
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) return show();
        return step(event.key === "ArrowDown" ? 1 : -1);
      case "Home":
        if (!open) return;
        event.preventDefault();
        return setActive(0);
      case "End":
        if (!open) return;
        event.preventDefault();
        return setActive(choices.length - 1);
      case "Enter":
      case " ":
        event.preventDefault();
        return open ? take(active) : show();
      case "Escape":
        if (!open) return;
        event.preventDefault();
        return setOpen(false);
      case "Tab":
        return setOpen(false);
      default:
        break;
    }

    // Typeahead. Letters within a second of each other are one search, so
    // "pe" finds "per bag" rather than everything starting with "e".
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return;
    const now = Date.now();
    typed.current = {
      text: (now - typed.current.at < 1000 ? typed.current.text : "") + event.key,
      at: now,
    };
    const found = choices.findIndex((choice) =>
      choice.label.toLowerCase().startsWith(typed.current.text.toLowerCase()),
    );
    if (found === -1) return;
    if (!open) return onChange(choices[found].value);
    setActive(found);
  }

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`field flex items-center justify-between gap-2 text-left
                    disabled:cursor-not-allowed disabled:text-faint ${
                      open ? "border-brand" : ""
                    }`}
      >
        <span className={chosen ? "truncate" : "truncate text-faint"}>
          {chosen ? chosen.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 transition-transform duration-150 ${
            open ? "-scale-y-100 text-brand" : "text-faint"
          }`}
        />
      </button>

      {open ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-activedescendant={`${listId}-${active}`}
          className="animate-rise absolute left-0 right-0 top-[calc(100%+4px)] z-30
                     max-h-64 overflow-y-auto rounded-lg border border-rule bg-card
                     p-1 shadow-menu"
        >
          {choices.map((choice, index) => {
            const marked = index === active;
            const current = choice.value === value;
            return (
              <li
                key={choice.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={current}
                // Mouse and keyboard drive the same marker, so moving the
                // pointer over a row and pressing Enter does what it looks
                // like it will.
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  // Before blur, or the list closes out from under the click.
                  event.preventDefault();
                  take(index);
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2
                            text-[0.9375rem] transition-colors duration-100 ${
                              marked ? "bg-accentSoft text-ink" : "text-muted"
                            }`}
              >
                <Check
                  aria-hidden
                  size={14}
                  strokeWidth={2}
                  className={`shrink-0 text-brand ${current ? "" : "invisible"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${current ? "text-ink" : ""}`}>
                    {choice.label}
                  </span>
                  {choice.note ? (
                    <span className="block truncate text-[0.75rem] text-faint">
                      {choice.note}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
