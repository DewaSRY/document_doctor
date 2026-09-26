import * as z from "zod";

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "nameRequired"),
  description: z.string().trim().min(1, "descriptionRequired"),
});

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>;
