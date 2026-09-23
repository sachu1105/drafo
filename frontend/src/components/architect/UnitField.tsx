"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select } from "@/components/architect/Select";

/**
 * How a material is priced: pick one, or type your own.
 *
 * This was an <input list> with a datalist behind it, which is the tidy
 * answer on paper and does not work in practice. Chrome draws the arrow so
 * faintly that nobody finds it, Firefox draws nothing at all, and a dropdown
 * whose affordance depends on the browser is not a dropdown. So it is a real
 * dropdown, with one option at the bottom that turns it into a text box.
 *
 * The typed route has to stay. This trade has a long tail of local units --
 * per running foot, per bag, per brass -- and a closed list turns every one
 * of them into "Other", which is worse than free text. The list is managed in
 * the Django admin, so the common ones can be added without a deploy.
 *
 * A unit already recorded but no longer on the list -- a retired one, or
 * something typed years ago -- opens straight into the text box with those
 * words in it. Editing a material must never silently change its price unit.
 */
const OTHER = "\u0000other";

export function UnitField({
  value,
  onChange,
  units,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  units: string[];
  id?: string;
}) {
  const [typing, setTyping] = useState(
    () => value !== "" && !units.includes(value),
  );

  if (typing) {
    // The way back is welded into the box rather than parked beside it. A
    // separate pill floating next to a square field was a second control
    // where there is only one thing here, and the one shape on the row that
    // matched nothing else on it. The field-affix pattern already exists for
    // exactly this: one border around the pair, so it reads as one control.
    //
    // The chevron is the same one the dropdown wears, in the same corner, so
    // the typed state looks like the dropdown with the words filled in -- and
    // pressing it does what a chevron in that corner ought to do.
    return (
      <div className="field-affix">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="per brass"
          autoFocus
          className="field-affix-input"
        />
        <button
          type="button"
          onClick={() => {
            setTyping(false);
            // Going back to the list abandons what was typed: leaving it
            // behind would show a dropdown whose value is not on it.
            onChange("");
          }}
          aria-label="Choose from the list instead"
          className="flex shrink-0 items-center px-3 text-faint transition-colors
                     duration-150 hover:text-ink"
        >
          <ChevronDown aria-hidden size={16} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <Select
      id={id}
      value={units.includes(value) ? value : ""}
      onChange={(next) => {
        if (next === OTHER) {
          setTyping(true);
          onChange("");
          return;
        }
        onChange(next);
      }}
      choices={[
        // Not every material is priced per anything -- a one-off fitting is
        // just a price -- so blank is a real answer and comes first.
        { value: "", label: "No unit" },
        ...units.map((unit) => ({ value: unit, label: unit })),
        {
          value: OTHER,
          label: "Something else…",
          note: "Type your own",
        },
      ]}
      placeholder="Choose a unit"
    />
  );
}
