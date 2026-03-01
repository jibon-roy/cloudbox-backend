import { Server } from "http";
import app from "./app";
import config from "./config";

import { initializeApp } from "./app";
import { prisma } from "./lib/prisma";
import { ensureRedisConnected } from "./lib/redisConnection";

let server: Server;

async function main() {
  try {
    // 1. Connect to database
    await prisma.$connect();
    console.log("🛢️  Database connected successfully");

    // 1.b Ensure Redis is reachable
    try {
      await ensureRedisConnected(
        Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
      );
      console.log("✅ Redis connected");
    } catch (err) {
      console.error(
        "❌ Redis connection failed:",
        (err as any)?.message || err,
      );
      process.exit(1);
    }

    // Ensure superadmin exists
    // Run app initializers (e.g., create superadmin)
    try {
      await initializeApp();
    } catch (err) {
      console.error("❌ App initialization failed:", err);
    }

    // 2. Start HTTP server
    server = app.listen(config.port, () => {
      console.log(`🚀 Server is running on port ${config.port}`);
    });

    // Handle server errors
    server.on("error", (error: any) => {
      if (error.code === "EADDRINUSE") {
        console.error(`❌ Port ${config.port} is already in use`);
      } else {
        console.error("❌ Server error:", error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
const exitHandler = () => {
  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: unknown) => {
  console.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);

process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  if (server) {
    server.close();
  }
});
