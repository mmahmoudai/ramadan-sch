import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ramadan_tracker";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected:", MONGO_URI);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}
