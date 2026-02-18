import mongoose, { Schema, Document } from "mongoose";

export interface IVisibilityApproval extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  viewerUserId: mongoose.Types.ObjectId;
  scope: "dashboard" | "reports";
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const visibilityApprovalSchema = new Schema<IVisibilityApproval>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    viewerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    scope: { type: String, enum: ["dashboard", "reports"], required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

visibilityApprovalSchema.index({ ownerUserId: 1, viewerUserId: 1, scope: 1 }, { unique: true });

export const VisibilityApproval = mongoose.model<IVisibilityApproval>("VisibilityApproval", visibilityApprovalSchema);
