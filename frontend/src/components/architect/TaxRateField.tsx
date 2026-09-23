"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/architect/Select";
import { api } from "@/lib/api";
import type { TaxRate } from "@/lib/types";

/**
 * A tax rate, chosen from the ones the admin offers.
 *
 * Typed by hand until now, which was wrong twice over: the rates already
 * exist in the database, and a tax rate is not a place for free text. A
 * mistyped unit is untidy; a mistyped rate is wrong arithmetic on a document
 * somebody files for their accountant.
 *
 * So what happens to a value that is not on the list? It is kept and shown,
 * and labelled so nobody mistakes it for a choice they made today.
 *
 * That case is not hypothetical. A practice sets 18%, the admin retires or
 * restates that slab, and the value stored on the profile -- and on every
 * invoice line ever raised -- is suddenly not in the dropdown. Dropping it to
 * blank would silently restate a rate. Snapping it to the nearest would be
 * worse. The only honest answer is to carry it as its own option, marked, so
 * it survives a save it was not part of and the architect can see there is
 * something to decide.
 *
 * `percent` is the value throughout, not a rate id, for the same reason:
 * `InvoiceLine.tax_percent` stores the number it was charged at, so an
 * invoice raised at 18% still says 18% after the slab moves.
 */
export function TaxRateField({
  value,
  onChange,
  id,
  /** The wording for the nought option, which differs by where this is used. */
  noneLabel = "No tax",
}: {
  value: string;
  onChange: (percent: string) => void;
  id?: string;
  noneLabel?: string;
}) {
  const [rates, setRates] = useState<TaxRate[] | null>(null);

  useEffect(() => {
    api<TaxRate[]>("/tax-rates/")
      .then(setRates)
      .catch(() => setRates([]));
  }, []);

  return (
    <Select
      id={id}
      value={normalise(value)}
      onChange={onChange}
      choices={choicesFor(rates ?? [], value, noneLabel)}
      placeholder={rates === null ? "Loading…" : noneLabel}
    />
  );
}

/**
 * "18.00", "18" and 18 are the same rate and must match the same option.
 *
 * The API sends two decimal places, the seeded rows send two decimal places,
 * and a value that came back from a form does not. Comparing the strings
 * would put an invoice raised at "18.00" against an option worth "18" and
 * find no match, which is exactly the false alarm this file exists to avoid.
 */
function normalise(value: string): string {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : value;
}

export function choicesFor(
  rates: TaxRate[],
  current: string,
  noneLabel: string,
): { value: string; label: string; note?: string }[] {
  const offered = rates.map((rate) => ({
    value: normalise(rate.percent),
    label: rate.label,
  }));

  // Nought is always available, whether or not the admin has a row for it: a
  // reimbursed printing charge on an otherwise taxed invoice is ordinary.
  const choices = offered.some((choice) => choice.value === "0")
    ? offered
    : [{ value: "0", label: noneLabel }, ...offered];

  const here = normalise(current);
  if (here === "" || choices.some((choice) => choice.value === here)) {
    return choices;
  }

  // The stored rate is no longer offered. Carry it, and say so.
  return [
    {
      value: here,
      label: `${here}%`,
      note: "No longer on the list — kept as it was",
    },
    ...choices,
  ];
}
