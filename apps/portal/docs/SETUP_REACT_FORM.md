Yes—that's a better approach for a scalable application. Since you're using **Next.js + TypeScript**, I recommend setting it up in this order:

## Step 1: Install the dependencies

Install **React Hook Form**, **Zod**, and the Zod resolver:

```bash
yarn add react-hook-form zod @hookform/resolvers
```

Their responsibilities:

- `react-hook-form` → manages form state and submission
- `zod` → validates form data
- `@hookform/resolvers` → connects Zod with React Hook Form

---

## Step 2: Set up shadcn/ui

If you haven't initialized shadcn yet, initialize it first:

```bash
yarn dlx shadcn@latest init
```

Then install the form-related components:

```bash
yarn dlx shadcn@latest add form input button
```

You should get shared UI components similar to:

```text
components/
└── form/
    └── input-field.tsx
```

The important idea is that these components become your **shared UI base**, while each feature builds its forms using those shared components.

---

# Step 3: Create a shared form input component

Instead of repeating this everywhere:

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

Create a reusable component.

For example:

`components/shared/form/FormInput.tsx`

```tsx
"use client";

import { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";

interface FormInputProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}

export function FormInput<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = "text",
}: FormInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}

          <FormControl>
            <Input {...field} type={type} placeholder={placeholder} />
          </FormControl>

          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

This component is generic, so it remains type-safe with your Zod-inferred form types.

---

## Step 4: Create a feature schema

For example:

`features/auth/schemas/login.schema.ts`

```tsx
import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),

  password: z.string().min(1, "Password is required"),
});

export type LoginFormScreenValues = z.infer<typeof loginSchema>;
```

---

## Step 5: Use the shared input with React Hook Form

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/shared/form/FormInput";

import { loginSchema, LoginFormScreenValues } from "../schemas/login.schema";

export function LoginFormScreen() {
  const form = useForm<LoginFormScreenValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormScreenValues) {
    console.log(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormInput
          control={form.control}
          name="email"
          label="Email"
          placeholder="Enter your email"
          type="email"
        />

        <FormInput
          control={form.control}
          name="password"
          label="Password"
          placeholder="Enter your password"
          type="password"
        />

        <Button type="submit">Login</Button>
      </form>
    </Form>
  );
}
```

## Recommended setup flow

```text
1. Install React Hook Form + Zod
           ↓
2. Initialize shadcn/ui
           ↓
3. Add shared base components (Input, Form, Button)
           ↓
4. Build reusable form components on top of shadcn
           ↓
5. Create feature-specific Zod schemas
           ↓
6. Connect schemas with React Hook Form
           ↓
7. Integrate submission with React Query/API
```

This architecture keeps your **shared UI reusable**, while validation and business logic stay inside each feature. It also makes it easy later to create `FormSelect`, `FormTextarea`, `FormCheckbox`, and other standardized inputs.
