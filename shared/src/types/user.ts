export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Profile {
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  personalInfoJson: Record<string, unknown>;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  language: "ar" | "en";
  timezoneIana: string;
  timezoneSource: "auto" | "manual";
  reminderEnabled: boolean;
  reminderTimeLocal: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  keepSignedIn: boolean;
}
