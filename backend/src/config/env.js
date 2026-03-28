import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
  quiet: true,
});

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringFromEnv = (value, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

const booleanFromEnv = (value, fallback = false) => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "require", "required"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
  return fallback;
};

export const env = {
  PORT: numberFromEnv(process.env.PORT, 3001),
  NODE_ENV: stringFromEnv(process.env.NODE_ENV, "development"),
  CORS_ORIGIN: stringFromEnv(process.env.CORS_ORIGIN, "http://localhost:5173,http://localhost:3001"),
  DATABASE_URL: stringFromEnv(process.env.DATABASE_URL, ""),
  DB_HOST: stringFromEnv(process.env.DB_HOST || process.env.PGHOST, "127.0.0.1"),
  DB_PORT: numberFromEnv(process.env.DB_PORT || process.env.PGPORT, 5432),
  DB_USER: stringFromEnv(process.env.DB_USER || process.env.PGUSER, "postgres"),
  DB_PASSWORD: stringFromEnv(process.env.DB_PASSWORD || process.env.PGPASSWORD, "postgres"),
  DB_NAME: stringFromEnv(process.env.DB_NAME || process.env.PGDATABASE, "insightflow_ai"),
  DB_SSL: booleanFromEnv(process.env.DB_SSL || process.env.PGSSL, false),
  DB_POOL_MIN: numberFromEnv(process.env.DB_POOL_MIN, 0),
  DB_POOL_MAX: numberFromEnv(process.env.DB_POOL_MAX, 10),
  DB_IDLE_TIMEOUT_MS: numberFromEnv(process.env.DB_IDLE_TIMEOUT_MS, 10000),
  DB_CONNECTION_TIMEOUT_MS: numberFromEnv(process.env.DB_CONNECTION_TIMEOUT_MS, 5000),
  GEMINI_API_KEY: stringFromEnv(process.env.GEMINI_API_KEY, ""),
  GEMINI_MODEL: stringFromEnv(process.env.GEMINI_MODEL, "gemini-2.0-flash"),
  GEMINI_API_URL: stringFromEnv(
    process.env.GEMINI_API_URL,
    "https://generativelanguage.googleapis.com/v1beta/models",
  ),
  LOG_LEVEL: stringFromEnv(process.env.LOG_LEVEL, "info"),
  port: numberFromEnv(process.env.PORT, 3001),
  nodeEnv: stringFromEnv(process.env.NODE_ENV, "development"),
  corsOrigin: stringFromEnv(process.env.CORS_ORIGIN, "http://localhost:5173,http://localhost:3001"),
  geminiApiKey: stringFromEnv(process.env.GEMINI_API_KEY, ""),
  geminiModel: stringFromEnv(process.env.GEMINI_MODEL, "gemini-2.0-flash"),
  geminiApiUrl: stringFromEnv(
    process.env.GEMINI_API_URL,
    "https://generativelanguage.googleapis.com/v1beta/models",
  ),
};

export const resolvedDatabaseConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

if (!env.DATABASE_URL) {
  console.warn("DATABASE_URL not configured, using DB_HOST/DB_PORT/DB_USER/DB_NAME settings.");
}

if (!env.geminiApiKey) {
  console.warn("GEMINI_API_KEY not configured, fallback mode enabled.");
}

console.log(`Configuration loaded [${env.nodeEnv}]`);
