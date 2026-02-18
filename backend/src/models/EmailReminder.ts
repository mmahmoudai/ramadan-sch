import mongoose, { Schema, Document } from "mongoose";

export interface IEmailReminder extends Document {
  userId: mongoose.Types.ObjectId;
  sendAtUtc: Date;
  status: "queued" | "sent" | "skipped" | "failed";
  reason: string;
  createdAt: Date;
}

const emailReminderSchema = new Schema<IEmailReminder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sendAtUtc: { type: Date, required: true },
    status: { type: String, enum: ["queued", "sent", "skipped", "failed"], default: "queued" },
    reason: { type: String, default: "" },
  },
  { timestamps: true }
);

emailReminderSchema.index({ status: 1, sendAtUtc: 1 });

export const EmailReminder = mongoose.model<IEmailReminder>("EmailReminder", emailReminderSchema);
