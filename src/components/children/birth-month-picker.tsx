"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Birth-month picker: two dropdowns (year + localized month) that report a single
 * "YYYY-MM" value, so the surrounding form field and its stored `birth_month` are
 * unchanged. Replaces a native <input type="month">, which opened at the current
 * month and made picking a date 2–10 years back painful — worst on mobile.
 *
 * Uncontrolled-with-initial-value: pass `value="YYYY-MM"` (or "YYYY-MM-DD") to
 * prefill both selects when editing an existing child; the component then owns the
 * two-part selection and reports every change via `onChange` (empty until both are
 * set). Range validation (past, age ≤ 10) lives with the form — see isValidBirthMonth.
 */
function splitYm(value: string): [string, string] {
  if (!/^\d{4}-\d{2}/.test(value)) return ["", ""];
  const parts = value.slice(0, 7).split("-");
  return [parts[0] ?? "", parts[1] ?? ""];
}

export function BirthMonthPicker({
  value = "",
  onChange,
  yearTriggerId,
  invalid = false,
}: {
  value?: string;
  onChange: (next: string) => void;
  yearTriggerId?: string;
  invalid?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("onboarding");

  const [initialYear, initialMonth] = splitYm(value);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    // Current year down to current − 11: covers ages 0–10 with a margin, descending.
    return Array.from({ length: 12 }, (_, i) => String(current - i));
  }, []);

  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "long" });
    // Localized month names — no hardcoded arrays. Day 1 of a fixed year is only
    // ever read for its month name.
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1).padStart(2, "0"),
      label: fmt.format(new Date(2000, i, 1)),
    }));
  }, [locale]);

  function pick(nextYear: string, nextMonth: string) {
    setYear(nextYear);
    setMonth(nextMonth);
    onChange(nextYear && nextMonth ? `${nextYear}-${nextMonth}` : "");
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={year} onValueChange={(y) => pick(y, month)}>
        <SelectTrigger
          id={yearTriggerId}
          aria-label={t("birthYearLabel")}
          aria-invalid={invalid}
          className="w-full"
        >
          <SelectValue placeholder={t("birthYearPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={month} onValueChange={(m) => pick(year, m)}>
        <SelectTrigger
          aria-label={t("birthMonthLabel")}
          aria-invalid={invalid}
          className="w-full"
        >
          <SelectValue placeholder={t("birthMonthPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
