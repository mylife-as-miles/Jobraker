// Minimal DTO placeholders to match types used by the client app
export type UserDto = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type ResumeDto = {
  id: string;
  title: string;
  data: any;
};
