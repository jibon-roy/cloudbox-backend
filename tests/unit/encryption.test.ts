import { EncryptionService } from '../../src/lib/encryption';

describe('EncryptionService', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';

      const encrypted = EncryptionService.encrypt(plaintext);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);

      const decrypted = EncryptionService.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = 'Same text';

      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);

      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle special characters', () => {
      const plaintext = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';

      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';

      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('hash', () => {
    it('should hash a string consistently', () => {
      const data = 'test data';

      const hash1 = EncryptionService.hash(data);
      const hash2 = EncryptionService.hash(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = EncryptionService.hash('data1');
      const hash2 = EncryptionService.hash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateToken', () => {
    it('should generate a random token', () => {
      const token1 = EncryptionService.generateToken();
      const token2 = EncryptionService.generateToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of specified length', () => {
      const token16 = EncryptionService.generateToken(16);
      const token32 = EncryptionService.generateToken(32);

      // Each byte becomes 2 hex chars
      expect(token16.length).toBe(32); // 16 bytes * 2
      expect(token32.length).toBe(64); // 32 bytes * 2
    });
  });

  describe('encryptBuffer and decryptBuffer', () => {
    it('should encrypt and decrypt a buffer correctly', () => {
      const plainBuffer = Buffer.from('test file content');

      const encrypted = EncryptionService.encryptBuffer(plainBuffer);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plainBuffer);

      const decrypted = EncryptionService.decryptBuffer(encrypted);
      expect(decrypted).toEqual(plainBuffer);
    });
  });
});
