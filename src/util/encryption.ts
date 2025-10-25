// Encryption service for secure private key storage
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../util/logger';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits

  /**
   * Encrypts a private key using AES-256-GCM
   * @param privateKey - The private key to encrypt
   * @returns Encrypted data with IV and auth tag
   */
  static encrypt(privateKey: string): EncryptedData {
    try {
      // Validate encryption key
      if (!config.encryptionKey || config.encryptionKey.length !== 64) {
        throw new Error('Invalid encryption key. Must be 64 characters (32 bytes hex)');
      }

      // Convert hex key to buffer
      const key = Buffer.from(config.encryptionKey, 'hex');
      
      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher using createCipheriv (the correct method)
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from('pacifica-bot', 'utf8')); // Additional authenticated data
      
      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      logger.debug('Private key encrypted successfully');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypts a private key using AES-256-GCM
   * @param encryptedData - The encrypted data with IV and tag
   * @returns Decrypted private key
   */
  static decrypt(encryptedData: EncryptedData): string {
    try {
      // Validate encryption key
      if (!config.encryptionKey || config.encryptionKey.length !== 64) {
        throw new Error('Invalid encryption key. Must be 64 characters (32 bytes hex)');
      }

      // Convert hex key to buffer
      const key = Buffer.from(config.encryptionKey, 'hex');
      
      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      // Create decipher using createDecipheriv (the correct method)
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from('pacifica-bot', 'utf8')); // Additional authenticated data
      decipher.setAuthTag(tag);
      
      // Decrypt the private key
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.debug('Private key decrypted successfully');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Validates that the encryption key is properly configured
   */
  static validateEncryptionKey(): boolean {
    return !!(config.encryptionKey && config.encryptionKey.length === 64);
  }

  /**
   * Generates a new encryption key (for setup)
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }
}