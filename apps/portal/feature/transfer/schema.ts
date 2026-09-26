import * as z from "zod";

export const transferDetailsSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "amountRequired")
    .refine((value) => Number(value) > 0, "amountInvalid"),
  description: z.string().trim().min(1, "descriptionRequired"),
});

export type TransferDetailsFormValues = z.infer<typeof transferDetailsSchema>;
