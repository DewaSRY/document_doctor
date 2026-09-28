"use client";

import * as React from "react";
import { Controller, type FieldValues } from "react-hook-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

import type { FormInputProps } from "./type";

type CounterPosition = "inside" | "top" | "bottom";

type TextareaFieldProps<T extends FieldValues> = FormInputProps<T> & {
  counter?: boolean;
  counterPosition?: CounterPosition;
} & Omit<
    React.ComponentProps<typeof Textarea>,
    "name" | "value" | "defaultValue" | "onChange" | "onBlur"
  >;

function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  counter = false,
  counterPosition = "bottom",
  maxLength,
  ...textareaProps
}: TextareaFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { value, ...field },
        fieldState: { invalid, isTouched, isDirty, error },
      }) => {
        const length = (value ?? "").length;
        const counterText = maxLength ? `${length}/${maxLength}` : `${length}`;

        return (
          <Field
            name={name}
            invalid={invalid}
            touched={isTouched}
            dirty={isDirty}
            className={className}
          >
            {label || (counter && counterPosition === "top") ? (
              <div className="flex w-full items-center justify-between">
                {label ? <FieldLabel>{label}</FieldLabel> : <span />}
                {counter && counterPosition === "top" ? (
                  <span className="text-xs text-muted-foreground">
                    {counterText}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="relative w-full pb-6">
              <Textarea
                id={name}
                {...textareaProps}
                {...field}
                value={value ?? ""}
                maxLength={maxLength}
                className={
                  counter && counterPosition === "inside" ? "" : undefined
                }
              />
              {counter && counterPosition === "inside" ? (
                <span className="pointer-events-none absolute bottom-2 right-2.5 text-xs text-muted-foreground">
                  {counterText}
                </span>
              ) : null}
              <FieldError match={!!error}>{error?.message}</FieldError>
            </div>
            {description ? (
              <FieldDescription>{description}</FieldDescription>
            ) : null}
            {counter && counterPosition === "bottom" ? (
              <span className="block w-full text-right text-xs text-muted-foreground">
                {counterText}
              </span>
            ) : null}
          </Field>
        );
      }}
    />
  );
}

export { TextareaField };
