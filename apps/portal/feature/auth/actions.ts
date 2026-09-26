"use server";

import { redirect } from "@/i18n/redirect";
import type { AppLocale } from "@/i18n/settings";
import type { CommonSuccessResponse } from "@/feature/common";
import { authClient } from "./client";
import type { LoginRequest, ProfileResponse, RegisterRequest } from "./type";
import { clearSessionCookie, setSessionCookie } from "./session";

// Masking server action for handling API requests with packed results
import { runMaskingServerAction } from "@/lib/api/pack-server-action";
import type { MaskingActionResult } from "@/lib/api/types";

export async function logoutAction(locale: AppLocale): Promise<void> {
  await clearSessionCookie();
  return redirect({ href: "/login", locale });
}

export async function loginAction(
  body: LoginRequest,
): Promise<MaskingActionResult<null>> {
  return runMaskingServerAction(async () => {
    const response = await authClient.login(body);
    await setSessionCookie(
      response.data.data.access_token,
      response.data.data.expires_in,
    );
    return null;
  });
}

export async function registerAction(
  body: RegisterRequest,
): Promise<MaskingActionResult<null>> {
  return runMaskingServerAction(async () => {
    const response = await authClient.register(body);
    await setSessionCookie(
      response.data.data.access_token,
      response.data.data.expires_in,
    );
    return null;
  });
}

export async function getProfileAction(): Promise<
  MaskingActionResult<CommonSuccessResponse<ProfileResponse>>
> {
  return runMaskingServerAction(async () => {
    const response = await authClient.getProfile();
    return response.data;
  });
}
