import mongoose, { Schema, Document } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IReportAccessLog {
  viewerUserId: mongoose.Types.ObjectId | null;
  accessType: "public" | "private";
  accessedAt: Date;
}

export interface IReport extends Document {
  ownerUserId: mongoose.Types.ObjectId;
  periodScope: string;
  periodStart: string;
  periodEnd: string;
  visibility: "public" | "private";
  includeProfileInfo: boolean;
  publicToken: string | null;
  revokedAt: Date | null;
  accessLog: IReportAccessLog[];
  createdAt: Date;
  updatedAt: Date;
}

const reportAccessLogSchema = new Schema<IReportAccessLog>(
  {
    viewerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    accessType: { type: String, enum: ["public", "private"], required: true },
    accessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reportSchema = new Schema<IReport>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    periodScope: { type: String, required: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    visibility: { type: String, enum: ["public", "private"], default: "private" },
    includeProfileInfo: { type: Boolean, default: false },
    publicToken: { type: String, default: null, sparse: true, unique: true },
    revokedAt: { type: Date, default: null },
    accessLog: [reportAccessLogSchema],
  },
  { timestamps: true }
);

reportSchema.pre("save", function (next) {
  if (this.isNew && this.visibility === "public" && !this.publicToken) {
    this.publicToken = uuidv4();
  }
  next();
});

export const Report = mongoose.model<IReport>("Report", reportSchema);
