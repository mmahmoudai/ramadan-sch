import mongoose, { Schema, Document } from "mongoose";

export interface IChallengePeriod {
  hijriYear: number;
  hijriMonth: number | null;
  hijriWeekIndex: number | null;
  startDateGregorian: string;
  endDateGregorian: string;
}

export interface IChallengeProgress {
  periodIndex: number;
  dateGregorian: string;
  progressValue: number;
  notes: string;
  completed: boolean;
}

export interface IChallenge extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  scope: "daily" | "weekly" | "monthly";
  active: boolean;
  periods: IChallengePeriod[];
  progress: IChallengeProgress[];
  createdAt: Date;
  updatedAt: Date;
}

const challengePeriodSchema = new Schema<IChallengePeriod>(
  {
    hijriYear: { type: Number, required: true },
    hijriMonth: { type: Number, default: null },
    hijriWeekIndex: { type: Number, default: null },
    startDateGregorian: { type: String, required: true },
    endDateGregorian: { type: String, required: true },
  },
  { _id: false }
);

const challengeProgressSchema = new Schema<IChallengeProgress>(
  {
    periodIndex: { type: Number, required: true },
    dateGregorian: { type: String, required: true },
    progressValue: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const challengeSchema = new Schema<IChallenge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    scope: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    active: { type: Boolean, default: true },
    periods: [challengePeriodSchema],
    progress: [challengeProgressSchema],
  },
  { timestamps: true }
);

export const Challenge = mongoose.model<IChallenge>("Challenge", challengeSchema);
