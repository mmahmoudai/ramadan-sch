import mongoose, { Schema, Document } from "mongoose";

export interface IFamilyMember {
  userId: mongoose.Types.ObjectId;
  role: "owner" | "member";
  status: "invited" | "active";
  joinedAt: Date;
}

export interface IFamilyGroup extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  name: string;
  members: IFamilyMember[];
  createdAt: Date;
  updatedAt: Date;
}

const familyMemberSchema = new Schema<IFamilyMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    status: { type: String, enum: ["invited", "active"], default: "invited" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const familyGroupSchema = new Schema<IFamilyGroup>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    members: [familyMemberSchema],
  },
  { timestamps: true }
);

export const FamilyGroup = mongoose.model<IFamilyGroup>("FamilyGroup", familyGroupSchema);
