// Configuration loader from environment variables
import dotenv from 'dotenv';
import { logger } from '../util/logger';

dotenv.config();

interface Config {
  telegramBotToken: string;
  mongodbUri: string;
  pacificaBaseUrl: string;
  logLevel: string;
}

function loadConfig(): Config {
  const required = ['TELEGRAM_BOT_TOKEN', 'MONGODB_URI'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    mongodbUri: process.env.MONGODB_URI!,
    pacificaBaseUrl: process.env.PACIFICA_BASE_URL || 'https://api.pacifica.fi/api/v1',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}

export const config = loadConfig();
