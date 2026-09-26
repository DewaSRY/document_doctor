import { BaseClient } from "@/lib/api/base-client";
import type { CommonSuccessResponse } from "@/feature/common";
import type {
  AuthResponse,
  LoginRequest,
  ProfileResponse,
  RegisterRequest,
} from "./type";

export class AuthClient extends BaseClient {
  login(body: LoginRequest) {
    return this.post<CommonSuccessResponse<AuthResponse>>({
      endpoint: "/auth/login",
      body,
    });
  }

  register(body: RegisterRequest) {
    return this.post<CommonSuccessResponse<AuthResponse>>({
      endpoint: "/auth/register",
      body,
    });
  }

  getProfile() {
    return this.get<CommonSuccessResponse<ProfileResponse>>({
      endpoint: "/auth/profile",
    });
  }
}

export const authClient = new AuthClient();
