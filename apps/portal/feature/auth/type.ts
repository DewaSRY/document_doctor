export type LoginRequest = {
  email: string;
};

export type AuthResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export type RegisterRequest = {
  username: string;
  email: string;
};

export type ProfileResponse = {
  id: number;
  username: string;
  email: string;
  created_at: string;
};
