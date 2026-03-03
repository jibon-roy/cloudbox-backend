import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import webhookController from './helpers/stripe/stripe_webhook/webhook_controller';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import responseTime from 'response-time';
import router from './app/routes';
import config from './config';
import logger from './utils/logger/logger';
import { initiateAdmin } from './bootstrap/createSuperadmin';
import GlobalErrorHandler from './app/middlewares/globalErrorHandler';
import createRateLimiter from './app/middlewares/rateLimiter';
import { sanitizeInput } from './app/middlewares/sanitizeInput';

// Initialize app
const app: Application = express();

// Serve static uploads with open CORS FIRST - before any other middleware
app.use(
  '/uploads',
  (req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Max-Age', '3600');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  },
  express.static('uploads')
);

// Cors Options
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://168.231.120.95:4000',
    'https://inkaurabd.com',
    'https://www.inkaurabd.com/',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'x-client-type', 'Accept', 'Origin'],
  credentials: true,
  exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges', 'Connection', 'Upgrade'],
};

// CORS options for static file serving (more permissive)
const staticCorsOptions = {
  origin: true,
  methods: ['GET'],
  credentials: true,
};

// Middlewares
app.use(helmet());
app.use(cors(corsOptions));
// parse cookies so auth middleware can read `req.cookies`
app.use(cookieParser());
// reduce surface: hide X-Powered-By
app.disable('x-powered-by');

// Stripe webhook endpoint - must accept raw body and be placed before
// JSON body parser and API access token enforcement so Stripe can POST without our header.
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => webhookController.handleStripeWebhook(req, res)
);

// enforce request size limits
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static('public'));

// Add input sanitization middleware
app.use(sanitizeInput);

// Apply rate limiting middleware
const rateLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || config.rateLimit.windowMs),
  maxRequests: Number(process.env.RATE_LIMIT_MAX || config.rateLimit.maxRequests),
  maxBlockTimeMs: 60 * 60 * 1000, // 1 hour
});
app.use(rateLimiter);

// API access token header enforcement
app.use((req: Request, res: Response, next: NextFunction) => {
  // allow health and root endpoints without token
  const openPaths = ['/', '/api/v1/health'];
  // Allow static file requests from uploads
  if (req.path.startsWith('/uploads/')) return next();
  if (openPaths.includes(req.path)) return next();

  const token = req.get('X-API-Access-Token') || req.get('API-ACCESS-TOKEN');
  const configured = process.env.API_ACCESS_TOKEN || config.apiAccessToken;
  if (!configured) {
    // If no token configured, allow (useful for dev) but log a warning
    logger.warn({
      message: 'API_ACCESS_TOKEN not configured; skipping header check',
    });
    return next();
  }

  if (!token || token !== configured) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: missing or invalid api-access-token header',
    });
  }

  next();
});

// Endpoints ( root )
app.get('/', (req: Request, res: Response) => {
  res.send({
    message: 'API Server is running..',
  });
});

// Log incoming requests
app.use(
  responseTime((req: Request, res: Response, time: number) => {
    const timeInMs = time.toFixed(2);
    const timeCategory =
      time < 100
        ? 'VERY FAST'
        : time < 200
          ? 'FAST'
          : time < 500
            ? 'NORMAL'
            : time < 1000
              ? 'SLOW'
              : time < 5000
                ? 'VERY_SLOW'
                : 'CRITICAL';

    // Skip logging for streaming requests to reduce noise
    if (!req.path.includes('/stream/')) {
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
        alert: 'SLOW_RESPONSE',
      });
    }
  })
);

// Routes
app.use('/api/v1', router);

// Health check endpoint
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
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
      message: 'Server health check failed',
      error: 'Database connection failed',
    });
  }
});

// 404 Not Found handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: 'API NOT FOUND!',
    error: {
      path: req.originalUrl,
      message: 'Your requested path is not found!',
    },
  });
});

// Global error handler (returns JSON formatted errors)
app.use(GlobalErrorHandler);

export default app;

// Application initializers to be run after DB connect
export async function initializeApp() {
  try {
    await initiateAdmin();
  } catch (err) {
    console.error('Failed to run app initializers:', err);
  }
}
