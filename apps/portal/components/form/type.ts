import { Control, FieldPath, FieldValues } from "react-hook-form";

// React Hook Form input props interface
export interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  description?: string;
  className?: string;
}
