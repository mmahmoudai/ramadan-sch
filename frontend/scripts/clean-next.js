const fs = require("fs");
const path = require("path");

const lifecycleEvent = process.env.npm_lifecycle_event || "";
const targetDistDir = lifecycleEvent === "predev" ? ".next-dev" : ".next";
const nextDir = path.join(__dirname, "..", targetDistDir);

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(`Cleaned ${targetDistDir} cache.`);
} catch (error) {
  console.warn(`Could not clean ${targetDistDir} cache:`, error.message);
}
