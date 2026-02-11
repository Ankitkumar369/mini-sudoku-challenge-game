import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file in puzzle-game/. Create it from .env.example.");
  process.exit(1);
}

const content = fs.readFileSync(envPath, "utf8");
const entries = {};

for (const rawLine of content.split(/\r?\n/)) {
  const line = rawLine.trim();

  if (!line || line.startsWith("#")) {
    continue;
  }

  const index = line.indexOf("=");

  if (index === -1) {
    continue;
  }

  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  entries[key] = value;
}

const requiredForGoogle = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const requiredForDatabase = ["DATABASE_URL"];
const requiredForTruecaller = [
  "TRUECALLER_CLIENT_ID",
  "TRUECALLER_CLIENT_SECRET",
  "TRUECALLER_REDIRECT_URI",
];

function missing(keys) {
  return keys.filter((key) => !entries[key]);
}

const missingGoogle = missing(requiredForGoogle);
const missingDatabase = missing(requiredForDatabase);
const missingTruecaller = missing(requiredForTruecaller);

console.log("Environment doctor report:");
console.log(`- Google auth: ${missingGoogle.length ? "not ready" : "ready"}`);
console.log(`- Database sync: ${missingDatabase.length ? "not ready" : "ready"}`);
console.log(`- Truecaller auth: ${missingTruecaller.length ? "not ready" : "ready"}`);

if (missingGoogle.length) {
  console.log(`  Missing Google keys: ${missingGoogle.join(", ")}`);
}

if (missingDatabase.length) {
  console.log(`  Missing DB keys: ${missingDatabase.join(", ")}`);
}

if (missingTruecaller.length) {
  console.log(`  Missing Truecaller keys: ${missingTruecaller.join(", ")}`);
}

if (missingGoogle.length || missingDatabase.length || missingTruecaller.length) {
  process.exit(1);
}
