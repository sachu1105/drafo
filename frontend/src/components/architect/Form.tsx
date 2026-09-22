"use client";

/**
 * The bits every add-form on a project is built from.
 *
 * Three forms grew up separately and drifted: one laid its fields out in two
 * columns, the next in three, the next full width, each with its own padding
 * and its own idea of where the buttons go. Side by side they read as three
 * screens from three products. Everything here exists so that they cannot
 * drift again.
 *
 * The grid is twelve columns. A field says how many it wants and they line up.
 */

export function FormCard({
  onSubmit,
  children,
}: {
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="animate-rise border border-rule bg-card p-5 sm:p-6"
    >
      {children}
    </form>
  );
}

/** The twelve-column bed every field sits in. */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-12 gap-x-4 gap-y-5">{children}</div>;
}

const SPAN: Record<number, string> = {
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  5: "col-span-12 sm:col-span-5",
  6: "col-span-12 sm:col-span-6",
  8: "col-span-12 sm:col-span-8",
  12: "col-span-12",
};

export function Labelled({
  label,
  span = 12,
  htmlFor,
  children,
}: {
  label: string;
  /** Columns out of twelve, at sm and up. Everything is full width below it. */
  span?: 3 | 4 | 5 | 6 | 8 | 12;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Tag = htmlFor ? "div" : "label";
  return (
    <Tag className={`block ${SPAN[span]}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="eyebrow block">
          {label}
        </label>
      ) : (
        <span className="eyebrow block">{label}</span>
      )}
      <div className="mt-2">{children}</div>
    </Tag>
  );
}

/**
 * Money.
 *
 * The currency mark is part of the control rather than a word in the label,
 * so the number is unmistakably an amount, and the figure is right-aligned
 * and tabular so a column of them lines up on the decimal.
 */
export function MoneyInput({
  value,
  onChange,
  ...input
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
>) {
  return (
    <div className="field-affix">
      <span aria-hidden className="field-affix-mark">
        ₹
      </span>
      <input
        {...input}
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-affix-input text-right tabular-nums"
      />
    </div>
  );
}

/**
 * The row of buttons at the foot of a form.
 *
 * Cancel first in the DOM would be wrong for a keyboard; Cancel last would put
 * the destructive-feeling thing under the thumb on a phone. It sits second,
 * quiet, with a rule above the pair so the actions read as separate from the
 * fields they apply to.
 */
export function FormActions({
  submitLabel,
  busyLabel,
  busy,
  disabled,
  onCancel,
}: {
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-ruleSoft pt-5">
      <button type="submit" disabled={busy || disabled} className="btn-primary">
        {busy ? busyLabel : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="btn-text px-3"
      >
        Cancel
      </button>
    </div>
  );
}

/**
 * The empty state for a tab.
 *
 * One line saying what goes here and one button. The long second paragraph
 * these used to carry was written for somebody reading the product for the
 * first time, and it was still there on the four-hundredth visit.
 */
export function Empty({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="border border-dashed border-rule bg-card px-6 py-14 text-center">
      <p className="font-display text-[1.25rem]">{title}</p>
      <button type="button" onClick={onAction} className="btn-primary mt-5">
        {action}
      </button>
    </div>
  );
}
