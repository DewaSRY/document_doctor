import { z } from "zod";
import type { Translate } from "@/feature/common";

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
  });
}

export type LoginFormScreenValues = z.infer<
  ReturnType<typeof createLoginSchema>
>;

export function createRegisterSchema(t: Translate) {
  return z.object({
    username: z.string().min(1, t("usernameRequired")),
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
  });
}

export type RegisterFormScreenValues = z.infer<
  ReturnType<typeof createRegisterSchema>
>;
