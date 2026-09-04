import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./ws/gameServer";
import { ensureDatabaseSchema, formatDatabaseError, pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  const attempts = Number(process.env.DB_STARTUP_ATTEMPTS ?? 12);
  for (let attempt = 1; ; attempt += 1) {
    try {
      logger.info({ attempt, attempts }, "Connecting to database");
      await ensureDatabaseSchema();
      break;
    } catch (error) {
      console.error(`[startup] database attempt ${attempt}/${attempts} failed`, formatDatabaseError(error));
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 1_000, 5_000)));
    }
  }
  logger.info("Database schema ready");

  const server = http.createServer(app);
  setupWebSocketServer(server);

  server.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  server.on("error", (err) => {
    console.error("[server] fatal error", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[startup] Failed to start server", formatDatabaseError(err));
  process.exit(1);
});
