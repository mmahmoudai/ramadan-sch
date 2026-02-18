import mongoose, { Schema, Document } from "mongoose";

export interface IReaction extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  authorUserId: mongoose.Types.ObjectId;
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  reactionType: string;
  createdAt: Date;
}

const reactionSchema = new Schema<IReaction>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reactionType: { type: String, required: true },
  },
  { timestamps: true }
);

reactionSchema.index({ targetType: 1, targetId: 1 });
reactionSchema.index({ authorUserId: 1, targetType: 1, targetId: 1, reactionType: 1 }, { unique: true });

export const Reaction = mongoose.model<IReaction>("Reaction", reactionSchema);
