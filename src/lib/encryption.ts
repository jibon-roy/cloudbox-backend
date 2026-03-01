import crypto from 'crypto';
import logger from '../utils/logger/logger';

const algorithm = 'aes-256-cbc';

/**
 * Encryption utility for sensitive file data
 * Uses AES-256-CBC for encryption at rest
 */
export class EncryptionService {
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || 'default-dev-key-please-set-in-env';

    // Ensure key is exactly 32 bytes for AES-256
    if (key.length < 32) {
      const hash = crypto.createHash('sha256');
      hash.update(key);
      return hash.digest();
    }

    return Buffer.from(key.substring(0, 32), 'utf-8');
  }

  /**
   * Encrypt a string value
   * Returns base64 encoded ciphertext with IV
   */
  static encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + ciphertext in base64
      const combined = iv.toString('hex') + encrypted;
      return Buffer.from(combined, 'hex').toString('base64');
    } catch (error) {
      logger.error({
        message: 'Encryption error',
        error,
      });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a base64 encoded encrypted string
   */
  static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64').toString('hex');

      // Extract IV (first 32 hex chars = 16 bytes)
      const iv = Buffer.from(combined.substring(0, 32), 'hex');
      const ciphertext = combined.substring(32);

      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      logger.error({
        message: 'Decryption error',
        error,
      });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash a string (one-way, cannot decrypt)
   * Useful for checksums and verification
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a random secure token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt file contents
   * Returns encrypted buffer
   */
  static encryptBuffer(buffer: Buffer): Buffer {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(buffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Prepend IV to encrypted data
      return Buffer.concat([iv, encrypted]);
    } catch (error) {
      logger.error({
        message: 'Buffer encryption error',
        error,
      });
      throw new Error('Failed to encrypt buffer');
    }
  }

  /**
   * Decrypt file contents
   * Expects buffer with IV prepended
   */
  static decryptBuffer(encryptedBuffer: Buffer): Buffer {
    try {
      const key = this.getEncryptionKey();
      const iv = encryptedBuffer.subarray(0, 16);
      const encrypted = encryptedBuffer.subarray(16);

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted;
    } catch (error) {
      logger.error({
        message: 'Buffer decryption error',
        error,
      });
      throw new Error('Failed to decrypt buffer');
    }
  }
}

export default EncryptionService;
