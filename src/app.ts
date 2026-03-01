import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import helmet from "helmet";
import responseTime from "response-time";
import router from "./app/routes";
import config from "./config";
import logger from "./utils/logger/logger";
import { initiateAdmin } from "./bootstrap/createSuperadmin";

// Initialize app
const app: Application = express();

// Cors Options
const corsOptions = {
  origin: config.env === "production" ? process.env.CORS_ORIGIN : "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  ALLOWED_HEADERS: [
    "Content-Type",
    "Authorization",
    "x-client-type",
    "Accept",
    "Origin",
  ],
  credentials: true,
  exposedHeaders: [
    "Content-Range",
    "Content-Length",
    "Accept-Ranges",
    "Connection",
    "Upgrade",
  ],
};

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
// reduce surface: hide X-Powered-By
app.disable("x-powered-by");

// enforce request size limits
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.static("public"));

// Simple in-memory rate limiter (basic protection)
const rateStore: Record<string, { count: number; resetAt: number }> = {};
const windowMs = Number(
  process.env.RATE_LIMIT_WINDOW_MS || config.rateLimit.windowMs,
);
const maxRequests = Number(
  process.env.RATE_LIMIT_MAX || config.rateLimit.maxRequests,
);
app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    const key =
      req.ip || req.headers["x-forwarded-for"]?.toString() || "global";
    const now = Date.now();
    const entry = rateStore[key] || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    rateStore[key] = entry;
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, maxRequests - entry.count)),
    );
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > maxRequests) {
      return res
        .status(429)
        .json({ success: false, message: "Too many requests" });
    }
    next();
  } catch (err) {
    next();
  }
});

// API access token header enforcement
app.use((req: Request, res: Response, next: NextFunction) => {
  // allow health and root endpoints without token
  const openPaths = ["/", "/api/v1/health"];
  if (openPaths.includes(req.path)) return next();

  const token = req.get("X-API-Access-Token") || req.get("API-ACCESS-TOKEN");
  const configured = process.env.API_ACCESS_TOKEN || config.apiAccessToken;
  if (!configured) {
    // If no token configured, allow (useful for dev) but log a warning
    logger.warn({
      message: "API_ACCESS_TOKEN not configured; skipping header check",
    });
    return next();
  }

  if (!token || token !== configured) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: missing or invalid api-access-token header",
    });
  }

  next();
});

// Endpoints ( root )
app.get("/", (req: Request, res: Response) => {
  res.send({
    message: "API Server is running..",
  });
});

// Log incoming requests
app.use(
  responseTime((req: Request, res: Response, time: number) => {
    const timeInMs = time.toFixed(2);
    const timeCategory =
      time < 100
        ? "VERY FAST"
        : time < 200
          ? "FAST"
          : time < 500
            ? "NORMAL"
            : time < 1000
              ? "SLOW"
              : time < 5000
                ? "VERY_SLOW"
                : "CRITICAL";

    // Skip logging for streaming requests to reduce noise
    if (!req.path.includes("/stream/")) {
      logger.info({
        message: `Request processed - ${timeCategory}: ${timeInMs}ms - ${req.method} ${req.originalUrl}`,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${timeInMs}ms`,
        timeCategory,
        statusCode: res.statusCode,
        // userAgent: req.get("User-Agent"),
        // ip: req.ip,
      });
    }

    // Alert for performance issues
    if (time > 1000) {
      logger.warn({
        message: `Performance concern: ${req.method} ${req.originalUrl}`,
        responseTime: `${timeInMs}ms`,
        statusCode: res.statusCode,
        alert: "SLOW_RESPONSE",
      });
    }
  }),
);

// Routes
app.use("/api/v1", router);

// Health check endpoint
app.get("/api/v1/health", async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Server health check failed",
      error: "Database connection failed",
    });
  }
});

// 404 Not Found handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: "API NOT FOUND!",
    error: {
      path: req.originalUrl,
      message: "Your requested path is not found!",
    },
  });
});

export default app;

// Application initializers to be run after DB connect
export async function initializeApp() {
  try {
    await initiateAdmin();
  } catch (err) {
    console.error("Failed to run app initializers:", err);
  }
}
