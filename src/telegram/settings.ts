// Settings menu handlers
import TelegramBot from 'node-telegram-bot-api';
import { getAccountSettings } from '../pacifica/getAccountSettings';
import { updateLeverage } from '../pacifica/updateLeverage';
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { connectedKeyboard, mainKeyboard } from './keyboards';
import { UserState } from './types';

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

      // Try to fetch account settings
      try {
        const settingsResult = await getAccountSettings(user.accountPublicKey);
        if (settingsResult.success && settingsResult.data && settingsResult.data.length > 0) {
          settingsText += `*Account Settings:*\n`;
          settingsResult.data.forEach(setting => {
            settingsText += `*${setting.symbol}:*\n`;
            settingsText += `  Leverage: *${setting.leverage}x*\n`;
            settingsText += `  Margin: *${setting.isolated ? 'Isolated' : 'Cross'}*\n`;
          });
          settingsText += `\n`;
        } else {
          settingsText += `*Account Settings:*\n`;
          settingsText += `Using default settings (max leverage, cross margin)\n\n`;
        }
      } catch (error) {
        logger.warn('Could not fetch account settings:', error);
        settingsText += `*Account Settings:*\n`;
        settingsText += `Could not fetch settings\n\n`;
      }

      settingsText += `_Note: Private keys are never shown for security._`;

      await this.bot.sendMessage(chatId, settingsText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Show Account', callback_data: 'account' }],
            [
              { text: '📈 Limit Order', callback_data: 'create_order' },
              { text: '⚡ Market Order', callback_data: 'create_market' },
            ],
            [
              { text: '❌ Cancel Order', callback_data: 'cancel_order_menu' },
              { text: '🎯 TP/SL', callback_data: 'create_tpsl' },
            ],
            [{ text: '⚙️ Leverage', callback_data: 'leverage_settings' }],
            [{ text: '⚙️ Settings', callback_data: 'settings' }],
            [{ text: '🔄 Reconnect', callback_data: 'connect' }, { text: '❓ Help', callback_data: 'help' }],
          ],
        },
      });
    } catch (error) {
      logger.error('Error showing settings:', error);
      await this.bot.sendMessage(chatId, '❌ Error loading settings.');
    }
  }

  // Show leverage settings
  async showLeverageSettings(chatId: number, userId: number, userStates?: Map<number, UserState>): Promise<void> {
    try {
      const user = await userService.getUserById(userId);
      
      if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Trading features not enabled!*\n\n' +
          'You need an Agent Wallet to adjust leverage.\n\n' +
          'Use /connect and provide your Agent Wallet Private Key.',
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
        return;
      }

      // Get current settings
      const settingsResult = await getAccountSettings(user.accountPublicKey);
      
      let leverageText = `⚙️ *Leverage Settings*\n\n`;
      leverageText += `Select a symbol to adjust leverage:\n\n`;
      
      if (settingsResult.success && settingsResult.data && settingsResult.data.length > 0) {
        settingsResult.data.forEach((setting, index) => {
          leverageText += `${index + 1}. *${setting.symbol}* - Current: ${setting.leverage}x\n`;
        });
        leverageText += `\nEnter symbol name (e.g., BTC, ETH, SOL):\n`;
      } else {
        leverageText += `Available symbols: BTC, ETH, SOL\n\n`;
        leverageText += `Enter symbol name (e.g., BTC, ETH, SOL):\n`;
      }
      
      leverageText += `Type *"cancel"* to stop`;

      // Set state for leverage input
      if (userStates) {
        userStates.set(userId, {
          awaitingLeverage: true,
          awaitingLeverageSymbol: true,
          orderData: {},
        });
      }

      await this.bot.sendMessage(chatId, leverageText, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('Error showing leverage settings:', error);
      await this.bot.sendMessage(chatId, '❌ Error loading leverage settings.');
    }
  }

  // Handle leverage symbol input
  async handleLeverageSymbolInput(chatId: number, userId: number, input: string, userStates?: Map<number, UserState>): Promise<void> {
    if (input.toLowerCase() === 'cancel') {
      if (userStates) userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Leverage adjustment cancelled.', connectedKeyboard);
      return;
    }

    const symbol = input.toUpperCase().trim();
    const validSymbols = ['BTC', 'ETH', 'SOL', 'WLFI'];
    
    if (!validSymbols.includes(symbol)) {
      await this.bot.sendMessage(
        chatId,
        '❌ Invalid symbol. Enter BTC, ETH, SOL, or WLFI.\n\n' +
        'Type *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Update state to await leverage value
    if (userStates) {
      const state = userStates.get(userId);
      if (state) {
        state.awaitingLeverageSymbol = false;
        state.awaitingLeverageValue = true;
        state.orderData = { symbol };
        userStates.set(userId, state);
      }
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Symbol: *${symbol}*\n\n` +
      `Enter new leverage (1-50):\n\n` +
      `Example: 5 (for 5x leverage)\n` +
      `Type *"cancel"* to stop`,
      { parse_mode: 'Markdown' }
    );
  }

  // Handle leverage value input
  async handleLeverageValueInput(chatId: number, userId: number, input: string, userStates?: Map<number, UserState>): Promise<void> {
    if (input.toLowerCase() === 'cancel') {
      if (userStates) userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Leverage adjustment cancelled.', connectedKeyboard);
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      if (userStates) userStates.delete(userId);
      return;
    }

    const leverage = parseInt(input.trim());
    if (isNaN(leverage) || leverage < 1 || leverage > 50) {
      await this.bot.sendMessage(
        chatId,
        '❌ Invalid leverage. Enter a number between 1 and 50.\n\n' +
        'Type *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const state = userStates?.get(userId);
    const symbol = state?.orderData?.symbol || 'BTC';
    
    if (userStates) userStates.delete(userId);

    await this.bot.sendMessage(
      chatId,
      `🔄 Updating ${symbol} leverage to ${leverage}x...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await updateLeverage({
        accountPublicKey: user.accountPublicKey,
        agentPrivateKey: user.agentPrivateKey,
        agentPublicKey: user.agentPublicKey,
        symbol,
        leverage,
      });

      if (result.success) {
        await this.bot.sendMessage(
          chatId,
          `✅ *Leverage Updated!*\n\n` +
          `Symbol: *${symbol}*\n` +
          `New Leverage: *${leverage}x*\n\n` +
          `Your trading leverage has been successfully updated.`,
          {
            parse_mode: 'Markdown',
            ...connectedKeyboard,
          }
        );
      } else {
        // Parse error message properly
        let errorMsg = 'Unknown error';
        if (result.error) {
          if (typeof result.error === 'object' && result.error !== null) {
            errorMsg = (result.error as any).error || JSON.stringify(result.error);
          } else if (typeof result.error === 'string') {
            errorMsg = result.error;
          }
        }

        await this.bot.sendMessage(
          chatId,
          `❌ *Failed to update leverage*\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try again.`,
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
      }
    } catch (error: any) {
      logger.error('Error updating leverage:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Error updating leverage*\n\n` +
        `${error.message || 'An unexpected error occurred'}\n\n` +
        `Please try again later.`,
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    }
  }
}
