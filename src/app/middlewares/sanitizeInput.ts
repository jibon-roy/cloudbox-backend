import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize user input to prevent XSS and injection attacks
 * Removes potentially dangerous characters and HTML tags
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters (query is a read-only getter in Express, mutate in place)
  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = sanitizeObject(req.query);
    for (const key in req.query) {
      delete req.query[key];
    }
    for (const key in sanitizedQuery) {
      req.query[key] = sanitizedQuery[key];
    }
  }

  // Sanitize URL parameters (params can be directly assigned)
  if (req.params && typeof req.params === 'object') {
    const sanitizedParams = sanitizeObject(req.params);
    for (const key in req.params) {
      req.params[key] = sanitizedParams[key];
    }
  }

  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

/**
 * Sanitize a string value
 * Removes XSS-like patterns and dangerous characters
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove common XSS patterns
  let sanitized = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script> tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove <iframe> tags
    .replace(/on\w+\s*=\s*["']([^"']*)["']/gi, '') // Remove event handlers
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/[<>]/g, ''); // Remove < and >

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

export default sanitizeInput;
