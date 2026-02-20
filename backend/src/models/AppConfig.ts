import mongoose, { Schema, Document } from "mongoose";

export interface IAppConfig extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const appConfigSchema = new Schema<IAppConfig>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const AppConfig = mongoose.model<IAppConfig>("AppConfig", appConfigSchema);

export async function getConfig(key: string, defaultValue: unknown = null): Promise<unknown> {
  const doc = await AppConfig.findOne({ key });
  return doc ? doc.value : defaultValue;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await AppConfig.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
}
