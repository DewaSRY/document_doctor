"use client"

import * as React from "react"
import { Controller, type FieldValues } from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { FormInputProps } from "./type"

type InputFieldProps<T extends FieldValues> = FormInputProps<T> &
  Omit<
    React.ComponentProps<typeof Input>,
    "name" | "value" | "defaultValue" | "onChange" | "onBlur"
  >

function InputField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: InputFieldProps<T>) {
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
          <Input id={name} {...inputProps} {...field} value={value ?? ""} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError match={!!error}>{error?.message}</FieldError>
        </Field>
      )}
    />
  )
}

export { InputField }
