import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  authorUserId: mongoose.Types.ObjectId;
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  body: string;
  hiddenByOwner: boolean;
  deletedByOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true },
    hiddenByOwner: { type: Boolean, default: false },
    deletedByOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

commentSchema.index({ targetType: 1, targetId: 1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
