import { sanitizeInput } from '../../src/app/middlewares/sanitizeInput';
import { Request, Response, NextFunction } from 'express';

describe('sanitizeInput Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {};
    next = jest.fn();
  });

  describe('sanitize body', () => {
    it('should remove XSS script tags', () => {
      req.body = {
        name: '<script>alert("xss")</script>Hello',
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.name).toBe('Hello');
      expect(next).toHaveBeenCalled();
    });

    it('should remove event handlers', () => {
      req.body = {
        title: 'Title<img src=x onerror="alert(\'xss\')">',
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.title).not.toContain('onerror');
    });

    it('should remove all HTML tags', () => {
      req.body = {
        content: '<p>Hello</p><div>World</div>',
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.content).toBe('HelloWorld');
    });

    it('should preserve normal text', () => {
      req.body = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.email).toBe('test@example.com');
      expect(req.body.name).toBe('John Doe');
    });
  });

  describe('sanitize query parameters', () => {
    it('should sanitize query strings', () => {
      req.query = {
        search: '<script>alert("xss")</script>test',
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.query.search).toBe('test');
    });
  });

  describe('sanitize nested objects', () => {
    it('should recursively sanitize nested objects', () => {
      req.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          contact: {
            email: '<img src=x>test@example.com',
          },
        },
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.contact.email).toBe('test@example.com');
    });
  });

  describe('sanitize arrays', () => {
    it('should sanitize arrays of strings', () => {
      req.body = {
        tags: ['<script>xss</script>tag1', 'tag2<iframe></iframe>'],
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.tags[0]).toBe('tag1');
      expect(req.body.tags[1]).toBe('tag2');
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined', () => {
      req.body = {
        field1: null,
        field2: undefined,
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.field1).toBeNull();
      expect(req.body.field2).toBeUndefined();
    });

    it('should handle non-string values', () => {
      req.body = {
        count: 42,
        active: true,
      };

      sanitizeInput(req as Request, res as Response, next);

      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
    });
  });
});
