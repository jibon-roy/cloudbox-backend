import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger/logger';


interface RateLimitStore {
  count: number;
  resetAt: number;
  blockedUntil?: number | undefined;
}

const rateLimitStore: Record<string, RateLimitStore> = {};

interface RateLimitOptions {
  windowMs?: number; // Time window in ms (default: 15 min)
  maxRequests?: number; // Max requests per window (default: 100)
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  maxBlockTimeMs?: number; // Max block time if abused (default: 1 hour)
}

/**
 * Express rate limiting middleware to prevent DoS attacks
 * Blocks IPs that exceed request limits
 */
export const createRateLimiter = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    maxBlockTimeMs = 60 * 60 * 1000, // 1 hour
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'global';
      const now = Date.now();

      // Initialize or retrieve rate limit data
      if (!rateLimitStore[key]) {
        rateLimitStore[key] = { count: 0, resetAt: now + windowMs };
      }

      const entry = rateLimitStore[key];

      // Check if IP is currently blocked
      if (entry.blockedUntil && now < entry.blockedUntil) {
        const remainingTime = Math.ceil((entry.blockedUntil - now) / 1000);
        logger.warn({
          message: `Rate limit exceeded for IP: ${key}. Blocked for ${remainingTime}s more.`,
          ip: key,
          remainingBlockTime: remainingTime,
        });

        return res.status(429).json({
          success: false,
          message: `Too many requests. Please try again in ${remainingTime} seconds.`,
          retryAfter: remainingTime,
        });
      }

      // Reset window if expired
      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
        entry.blockedUntil = undefined;
      }

      // Increment request count
      entry.count += 1;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

      // Check if limit exceeded
      if (entry.count > maxRequests) {
        const blockDuration = Math.min(entry.count * 60 * 1000, maxBlockTimeMs); // Progressive blocking
        entry.blockedUntil = now + blockDuration;

        logger.error({
          message: `Rate limit exceeded for IP: ${key}. Blocking for ${blockDuration / 1000}s.`,
          ip: key,
          requestCount: entry.count,
          blockDurationSeconds: blockDuration / 1000,
        });

        return res.status(429).json({
          success: false,
          message: 'Too many requests. Your IP has been temporarily blocked.',
          retryAfter: Math.ceil(blockDuration / 1000),
        });
      }

      // Cleanup old entries to prevent memory leak
      if (Object.keys(rateLimitStore).length > 10000) {
        for (const [k, v] of Object.entries(rateLimitStore)) {
          if (now > v.resetAt + windowMs) {
            delete rateLimitStore[k];
          }
        }
      }

      next();
    } catch (err) {
      logger.error({ message: 'Rate limiter error', error: err });
      next();
    }
  };
};

export default createRateLimiter;
