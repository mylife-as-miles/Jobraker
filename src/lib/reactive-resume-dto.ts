// Minimal DTO placeholders to match types used by the client app
import { z } from "zod";
export type UserDto = {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  picture?: string | null;
  emailVerified?: boolean | null;
  twoFactorEnabled?: boolean | null;
};

export type ResumeDto = {
  id: string;
  title: string;
  data: any;
  locked?: boolean;
  slug?: string;
  visibility?: "public" | "private";
  updatedAt?: string | Date;
  createdAt?: string | Date;
};

export type UpdateResumeDto = {
  id: string;
  title?: string;
  data?: any;
};

// Minimal user update DTO/schema used by client settings
export type UpdateUserDto = {
  picture?: string | null;
  name?: string;
  username?: string;
  email?: string;
  locale?: string;
};

export const updateUserSchema = {
  // Placeholder mock; validation is handled by zod in the page
} as any;

// Minimal schema used by the create/duplicate resume dialog
export const createResumeSchema = z.object({
  title: z.string().min(1),
});

// Minimal auth DTOs used in client services
export type LoginDto = {
  identifier: string;
  password: string;
};

export type RegisterDto = {
  name: string;
  username: string;
  email: string;
  password: string;
  locale?: string;
};

export type ResetPasswordDto = { token: string; password: string };
export type ForgotPasswordDto = { email: string };
export type UpdatePasswordDto = { currentPassword: string; newPassword: string };

export type TwoFactorDto = { code: string };
export type TwoFactorBackupDto = { code: string };

export type AuthProvidersDto = Array<"github" | "google" | "openid" | "email">;

export type MessageDto = { message: string };

export type AuthResponseDto =
  | { status: "authenticated"; user: UserDto }
  | { status: "2fa_required" };

export const authResponseSchema = {
  pick: (_: { status: true }) => ({ safeParse: (v: any) => ({ success: typeof v.status === "string" }) }),
} as any;

// Minimal misc DTOs used by services
export type FeatureDto = {
  isSignupsDisabled: boolean;
  isEmailAuthDisabled: boolean;
};

export type UrlDto = { url: string };
export type StatisticsDto = { views: number; downloads: number };
export type ContributorDto = { id: string; name: string };
export type ImportResumeDto = { title: string; data: any };
export type CreateResumeDto = {
  title: string;
  slug?: string;
  data?: any;
  visibility?: "public" | "private";
};
export type DeleteResumeDto = { id: string };
