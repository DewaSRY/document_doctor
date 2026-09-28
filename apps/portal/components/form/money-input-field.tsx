"use client";

import * as React from "react";
import { Controller, type FieldValues, type FieldPath } from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import type { FormInputProps } from "./type";

function getCurrencySymbol(currency: string) {
  try {
    const part = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((piece) => piece.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

function formatAmountForDisplay(raw: string) {
  if (!raw) return "";

  const [wholePart, decimalPart] = raw.split(".");
  const wholeFormatted = wholePart
    ? new Intl.NumberFormat(undefined).format(Number(wholePart) || 0)
    : "";

  if (decimalPart === undefined) {
    return raw.endsWith(".") ? `${wholeFormatted}.` : wholeFormatted;
  }
  return `${wholeFormatted}.${decimalPart}`;
}

function sanitizeAmountInput(input: string) {
  let value = input.replace(/[^0-9.]/g, "");

  const firstDot = value.indexOf(".");
  if (firstDot !== -1) {
    value =
      value.slice(0, firstDot + 1) +
      value.slice(firstDot + 1).replace(/\./g, "");
    const [whole, decimal] = value.split(".");
    value = `${whole}.${decimal.slice(0, 2)}`;
  }

  return value.replace(/^0+(?=\d)/, "");
}

type MoneyInputFieldProps<T extends FieldValues> = FormInputProps<T> & {
  /** Field holding the currency code. The currency is always read-only here — never user-editable. */
  currencyName?: FieldPath<T>;
  /** Currency to display when `currencyName` isn't set (currency is fixed, e.g. the account's). */
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
};

function MoneyInputField<T extends FieldValues>({
  control,
  name,
  currencyName,
  currency: fixedCurrency = "IDR",
  label,
  description,
  className,
  placeholder,
  disabled,
}: MoneyInputFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { value, onChange, ...amountField },
        fieldState: { invalid, isTouched, isDirty, error },
      }) => {
        const rawValue = (value as string | undefined) ?? "";

        return (
          <Field
            name={name}
            invalid={invalid}
            touched={isTouched}
            dirty={isDirty}
            className={className}
          >
            {label ? <FieldLabel>{label}</FieldLabel> : null}
            <InputGroup className="w-full">
              <InputGroupAddon align="inline-start">
                {currencyName ? (
                  <Controller
                    control={control}
                    name={currencyName}
                    render={({ field: currencyField }) => {
                      const selected =
                        (currencyField.value as string | undefined) ??
                        fixedCurrency;

                      return (
                        <span className="font-semibold text-foreground">
                          {getCurrencySymbol(selected)}
                        </span>
                      );
                    }}
                  />
                ) : (
                  <span className="font-semibold text-foreground">
                    {getCurrencySymbol(fixedCurrency)}
                  </span>
                )}
              </InputGroupAddon>
              <InputGroupInput
                id={name}
                inputMode="decimal"
                placeholder={placeholder}
                disabled={disabled}
                value={formatAmountForDisplay(rawValue)}
                onChange={(event) =>
                  onChange(sanitizeAmountInput(event.target.value))
                }
                {...amountField}
              />
            </InputGroup>
            {description ? (
              <FieldDescription>{description}</FieldDescription>
            ) : null}
            <FieldError match={!!error}>{error?.message}</FieldError>
          </Field>
        );
      }}
    />
  );
}

export { MoneyInputField };
