/**
 * MongoDB Migration Script
 * Creates indexes and ensures collections are properly set up.
 * Run: npx tsx src/scripts/migrate.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db";

// Import all models to register schemas
import "../models/User";
import "../models/RefreshToken";
import "../models/DailyEntry";
import "../models/Challenge";
import "../models/FamilyGroup";
import "../models/VisibilityApproval";
import "../models/Comment";
import "../models/Reaction";
import "../models/Report";
import "../models/AuditLog";
import "../models/EmailReminder";

dotenv.config();

async function migrate() {
  await connectDB();
  console.log("\n=== Running MongoDB Migrations ===\n");

  // Sync all indexes defined in schemas
  const modelNames = mongoose.modelNames();
  for (const name of modelNames) {
    const model = mongoose.model(name);
    console.log(`  Syncing indexes for: ${name}`);
    await model.syncIndexes();
  }

  console.log(`\n  ✓ Synced indexes for ${modelNames.length} models`);

  // List all collections
  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();
  console.log(`\n  Collections in database:`);
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`    - ${col.name}: ${count} documents`);
  }

  console.log("\n=== Migration Complete ===\n");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
