/**
 * Jest test setup file
 * Runs before all tests
 */

// Suppress console output during tests (optional)
// global.console = { ...console, log: jest.fn(), error: jest.fn(), warn: jest.fn() };

// Set test timeout
jest.setTimeout(10000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/cloudbox_test';
process.env.JWT_SECRET = 'test_secret_key__not_for_production';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
