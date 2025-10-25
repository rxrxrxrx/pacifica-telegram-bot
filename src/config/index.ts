// Configuration loader from environment variables
import dotenv from 'dotenv';
import { logger } from '../util/logger';

dotenv.config();

interface Config {
  telegramBotToken: string;
  mongodbUri: string;
  pacificaBaseUrl: string;
  logLevel: string;
  encryptionKey: string;
}

function loadConfig(): Config {
  const required = ['TELEGRAM_BOT_TOKEN', 'MONGODB_URI', 'ENCRYPTION_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate encryption key format
  if (process.env.ENCRYPTION_KEY!.length !== 64) {
    logger.error('ENCRYPTION_KEY must be 64 characters (32 bytes hex)');
    throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes hex)');
  }

  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    mongodbUri: process.env.MONGODB_URI!,
    pacificaBaseUrl: process.env.PACIFICA_BASE_URL || 'https://api.pacifica.fi/api/v1',
    logLevel: process.env.LOG_LEVEL || 'info',
    encryptionKey: process.env.ENCRYPTION_KEY!,
  };
}

export const config = loadConfig();
