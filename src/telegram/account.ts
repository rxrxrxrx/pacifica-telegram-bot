// Account information handlers
import TelegramBot from 'node-telegram-bot-api';
import { pacificaService } from '../services/pacificaService';
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { connectedKeyboard, mainKeyboard } from './keyboards';

export class AccountHandler {
  constructor(private bot: TelegramBot) {}

  // Show account information
  async showAccount(chatId: number, userId: number): Promise<void> {
    try {
      const isConnected = await userService.isUserConnected(userId);

      if (!isConnected) {
        await this.bot.sendMessage(
          chatId,
          '❌ You need to connect your wallet first.\n\nClick the button below to get started.',
          mainKeyboard
        );
        return;
      }

      await this.bot.sendMessage(chatId, '🔄 Fetching account information...');

      const accountInfo = await pacificaService.getAccountInfo(userId);

      await this.bot.sendMessage(chatId, accountInfo, {
        parse_mode: 'Markdown',
        ...connectedKeyboard,
      });
    } catch (error: any) {
      logger.error('Error showing account:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ Failed to fetch account: ${error.message || 'Unknown error'}`
      );
    }
  }
}
