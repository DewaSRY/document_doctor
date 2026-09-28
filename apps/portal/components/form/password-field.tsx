"use client";

import * as React from "react";
import { Controller, type FieldValues } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type { FormInputProps } from "./type";

type PasswordFieldProps<T extends FieldValues> = FormInputProps<T> &
  Omit<
    React.ComponentProps<typeof Input>,
    "name" | "value" | "defaultValue" | "onChange" | "onBlur" | "type"
  >;

function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: PasswordFieldProps<T>) {
  const [visible, setVisible] = React.useState(false);
  const { t } = useTranslation("auth");

  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { value, ...field },
        fieldState: { invalid, isTouched, isDirty, error },
      }) => (
        <Field
          name={name}
          invalid={invalid}
          touched={isTouched}
          dirty={isDirty}
          className={className}
        >
          {label ? <FieldLabel>{label}</FieldLabel> : null}
          <div className="relative w-full">
            <Input
              {...inputProps}
              {...field}
              value={value ?? ""}
              type={visible ? "text" : "password"}
              className="pr-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute inset-y-0 right-1 my-auto"
              onClick={() => setVisible((prev) => !prev)}
              aria-label={visible ? t("hidePassword") : t("showPassword")}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <FieldError match={!!error}>{error?.message}</FieldError>
        </Field>
      )}
    />
  );
}

export { PasswordField };
