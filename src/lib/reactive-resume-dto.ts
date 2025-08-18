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
