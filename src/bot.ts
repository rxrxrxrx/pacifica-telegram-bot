// Main entry point for Pacifica Telegram Bot
import mongoose from 'mongoose';
import TelegramBot from 'node-telegram-bot-api';
import { config } from './config';
import { TelegramHandlers } from './telegram/handlers';
import { logger } from './util/logger';

class PacificaBot {
  private bot: TelegramBot;

  constructor() {
    // Initialize Telegram bot
    this.bot = new TelegramBot(config.telegramBotToken, { polling: true });
    
    // Initialize handlers (registers event listeners)
    new TelegramHandlers(this.bot);

    logger.info('Pacifica Telegram Bot initialized');
  }

  // Connect to MongoDB
  async connectDatabase(): Promise<void> {
    try {
      await mongoose.connect(config.mongodbUri);
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  // Start the bot
  async start(): Promise<void> {
    try {
      // Connect to database first
      await this.connectDatabase();

      // Set up bot info
      const botInfo = await this.bot.getMe();
      logger.info(`Bot started: @${botInfo.username}`);
      logger.info('Listening for messages...');

      // Set up error handlers
      this.bot.on('polling_error', (error) => {
        logger.error('Polling error:', error);
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down bot...');
    
    try {
      await this.bot.stopPolling();
      await mongoose.connection.close();
      logger.info('Bot stopped successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Create and start the bot
const bot = new PacificaBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

