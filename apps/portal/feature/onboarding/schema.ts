import * as z from "zod";

import { createAccountSchema } from "@/feature/account";

export const onboardingCreateAccountSchema = createAccountSchema.extend({
  currency: z.string().trim().min(1, "currencyRequired"),
  openingBalance: z
    .string()
    .trim()
    .refine((value) => value === "" || Number(value) >= 0, "openingBalanceInvalid"),
});

export type OnboardingCreateAccountFormValues = z.infer<
  typeof onboardingCreateAccountSchema
>;
