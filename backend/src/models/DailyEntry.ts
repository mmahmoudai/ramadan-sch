import mongoose, { Schema, Document } from "mongoose";

export interface IDailyEntryField {
  fieldKey: string;
  fieldType: "checkbox" | "text" | "radio" | "textarea";
  value: unknown;
  completed: boolean;
}

export interface IDailyEntry extends Document {
  userId: mongoose.Types.ObjectId;
  gregorianDate: string;
  hijriYear: number;
  hijriMonth: number;
  hijriDay: number;
  timezoneSnapshot: string;
  lockAtUtc: Date;
  status: "open" | "locked";
  fields: IDailyEntryField[];
  createdAt: Date;
  updatedAt: Date;
}

const dailyEntryFieldSchema = new Schema<IDailyEntryField>(
  {
    fieldKey: { type: String, required: true },
    fieldType: { type: String, enum: ["checkbox", "text", "radio", "textarea"], required: true },
    value: { type: Schema.Types.Mixed },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const dailyEntrySchema = new Schema<IDailyEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gregorianDate: { type: String, required: true },
    hijriYear: { type: Number, required: true },
    hijriMonth: { type: Number, required: true },
    hijriDay: { type: Number, required: true },
    timezoneSnapshot: { type: String, required: true },
    lockAtUtc: { type: Date, required: true },
    status: { type: String, enum: ["open", "locked"], default: "open" },
    fields: [dailyEntryFieldSchema],
  },
  { timestamps: true }
);

dailyEntrySchema.index({ userId: 1, gregorianDate: 1 }, { unique: true });

export const DailyEntry = mongoose.model<IDailyEntry>("DailyEntry", dailyEntrySchema);
