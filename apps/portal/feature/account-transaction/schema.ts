import * as z from "zod";

export const depositSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "amountRequired")
    .refine((value) => Number(value) > 0, "amountInvalid"),
  description: z.string().trim().min(1, "descriptionRequired"),
  accountId: z.number().optional(),
});

export type DepositFormValues = z.infer<typeof depositSchema>;
