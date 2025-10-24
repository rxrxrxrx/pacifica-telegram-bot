// Settings menu handlers
import TelegramBot from 'node-telegram-bot-api';
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { connectedKeyboard, mainKeyboard } from './keyboards';

export class SettingsHandler {
  constructor(private bot: TelegramBot) {}

  // Show settings menu
  async showSettings(chatId: number, userId: number): Promise<void> {
    try {
      const user = await userService.getUserById(userId);
      
      if (!user) {
        await this.bot.sendMessage(chatId, '❌ Not connected. Use /connect first.', mainKeyboard);
        return;
      }

      const tradingStatus = user.agentPrivateKey ? '✅ Enabled' : '📖 Read-only';
      
      let settingsText = `⚙️ *Settings*\n\n`;
      settingsText += `*Account Information:*\n`;
      settingsText += `Main Wallet: \`${user.accountPublicKey}\`\n\n`;
      
      if (user.agentPublicKey) {
        settingsText += `*Agent Wallet:*\n`;
        settingsText += `Public Key: \`${user.agentPublicKey}\`\n`;
        settingsText += `Private Key: \`***hidden***\`\n\n`;
      }
      
      settingsText += `*Trading Status:* ${tradingStatus}\n\n`;
      settingsText += `_Note: Private keys are never shown for security._`;

      await this.bot.sendMessage(chatId, settingsText, {
        parse_mode: 'Markdown',
        ...connectedKeyboard,
      });
    } catch (error) {
      logger.error('Error showing settings:', error);
      await this.bot.sendMessage(chatId, '❌ Error loading settings.');
    }
  }
}
