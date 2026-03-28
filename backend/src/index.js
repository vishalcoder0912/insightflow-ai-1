import { env } from "./config/env.js";
import { createServer } from "./http/server.js";
import { connectToDatabase, initializeDatabase, closeDatabase } from "./storage/database.js";

const server = createServer();
const maxPortAttempts = 10;
let currentPort = env.port;
let attempts = 0;

const getDatabaseLabel = () => {
  if (env.DB_NAME) {
    return `${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
  }

  if (!env.DATABASE_URL) {
    return "database-configured";
  }

  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "database-configured";
  }
};

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    attempts += 1;

    if (attempts >= maxPortAttempts) {
      console.error(
        `Unable to find an open port after trying ${maxPortAttempts} ports starting at ${env.port}.`,
      );
      process.exit(1);
    }

    currentPort += 1;
    console.warn(`Port ${currentPort - 1} is already in use. Retrying on port ${currentPort}.`);
    server.listen(currentPort);
    return;
  }

  console.error("Backend failed to start.", error);
  process.exit(1);
});

try {
  await connectToDatabase();
  await initializeDatabase();
  console.log(`PostgreSQL connected: ${getDatabaseLabel()}`);

  server.listen(currentPort, () => {
    console.log(`Backend server listening on http://localhost:${currentPort}`);
    console.log(`Environment: ${env.nodeEnv}`);
    console.log(`CORS Origin: ${env.corsOrigin}`);
    console.log(`Gemini: ${env.geminiApiKey ? "enabled" : "disabled (fallback mode)"}`);
  });
} catch (error) {
  console.error("Failed to connect to PostgreSQL.", error);
  process.exit(1);
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully.");
  server.close(async () => {
    await closeDatabase().catch((error) => {
      console.error("Error closing PostgreSQL pool.", error);
    });
    console.log("Server closed");
    process.exit(0);
  });
});
