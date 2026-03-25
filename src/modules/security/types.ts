import type { UserRole } from "@/modules/shared/contracts/domain";

export type AuthUserView = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = {
  username: string;
  password: string;
  role: UserRole;
  email: string;
  fullName?: string;
};

export type UpdateUserPayload = {
  username?: string;
  password?: string;
  role?: UserRole;
  email?: string;
  fullName?: string;
  isActive?: boolean;
};

export type JwtAuthResponse = {
  token: string;
  user: AuthUserView;
};
