import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  LoginRequest,
  ProfileResponse,
  RegisterRequest,
} from "@/feature/auth/type";
import type { CommonSuccessResponse } from "@/feature/common";
import {
  getProfileAction,
  loginAction,
  logoutAction,
  registerAction,
} from "../actions";
import type { AppLocale } from "@/i18n/settings";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";

export const authQueryKeys = {
  all: ["auth"] as const,
  profile: () => [...authQueryKeys.all, "profile"] as const,
};

export const useLoginMutation = () => {
  return useMutation<null, Error, LoginRequest>({
    mutationFn: (body) => loginAction(body).then(unpackActionResult),
  });
};

export const useRegisterMutation = () => {
  return useMutation<null, Error, RegisterRequest>({
    mutationFn: (body) => registerAction(body).then(unpackActionResult),
  });
};

export const useProfileQuery = () => {
  return useQuery<CommonSuccessResponse<ProfileResponse>, Error>({
    queryKey: authQueryKeys.profile(),
    queryFn: () => getProfileAction().then(unpackActionResult),
  });
};

export const useLogoutMutation = () => {
  return useMutation({
    mutationFn: (locale: AppLocale) => logoutAction(locale),
  });
};
