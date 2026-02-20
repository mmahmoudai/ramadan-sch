import mongoose, { Schema, Document } from "mongoose";

export interface IFamilyGift extends Document {
  familyId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  type: "gift" | "badge" | "certificate";
  icon: string;
  title: string;
  message: string;
  seen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const familyGiftSchema = new Schema<IFamilyGift>(
  {
    familyId: { type: Schema.Types.ObjectId, ref: "FamilyGroup", required: true, index: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["gift", "badge", "certificate"], required: true },
    icon: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    seen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

familyGiftSchema.index({ familyId: 1, toUserId: 1 });
familyGiftSchema.index({ familyId: 1, createdAt: -1 });

export const FamilyGift = mongoose.model<IFamilyGift>("FamilyGift", familyGiftSchema);
