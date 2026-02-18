import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  personalInfo: Record<string, unknown>;
  language: "ar" | "en";
  timezoneIana: string;
  timezoneSource: "auto" | "manual";
  reminderEnabled: boolean;
  reminderTimeLocal: string;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: null },
    personalInfo: { type: Schema.Types.Mixed, default: {} },
    language: { type: String, enum: ["ar", "en"], default: "en" },
    timezoneIana: { type: String, default: "Asia/Riyadh" },
    timezoneSource: { type: String, enum: ["auto", "manual"], default: "auto" },
    reminderEnabled: { type: Boolean, default: true },
    reminderTimeLocal: { type: String, default: "21:00" },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", userSchema);
