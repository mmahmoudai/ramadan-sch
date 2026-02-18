import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actorUserId: mongoose.Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ actorUserId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
