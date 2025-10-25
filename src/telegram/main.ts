// Main Telegram bot handlers
import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api';
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { AccountHandler } from './account';
import { ConnectionHandler } from './connection';
import { connectedKeyboard, mainKeyboard } from './keyboards';
import { OrdersHandler } from './orders';
import { SettingsHandler } from './settings';
import { UserState } from './types';

export class TelegramHandlers {
  private connectionHandler: ConnectionHandler;
  private ordersHandler: OrdersHandler;
  private settingsHandler: SettingsHandler;
  private accountHandler: AccountHandler;
  private userStates = new Map<number, UserState>();

  constructor(private bot: TelegramBot) {
    this.connectionHandler = new ConnectionHandler(bot);
    this.ordersHandler = new OrdersHandler(bot);
    this.settingsHandler = new SettingsHandler(bot);
    this.accountHandler = new AccountHandler(bot);
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Command handlers
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
    this.bot.onText(/\/account/, (msg) => this.handleAccountCommand(msg));
    this.bot.onText(/\/connect/, (msg) => this.handleConnectCommand(msg));

    // Callback query handler for inline buttons
    this.bot.on('callback_query', (query) => this.handleCallbackQuery(query));

    // Message handler for text input
    this.bot.on('message', (msg) => this.handleMessage(msg));
  }

  // Handle /start command
  private async handleStart(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    try {
      const isConnected = await userService.isUserConnected(userId);
      const firstName = msg.from?.first_name || 'there';

      let welcomeMessage = `👋 Hi ${firstName}!\n\n`;
      welcomeMessage += `Welcome to *Pacifica Trading Bot*.\n\n`;

      if (isConnected) {
        welcomeMessage += `✅ Your wallet is already connected.\n`;
        welcomeMessage += `Use the buttons below to view your account or reconnect.\n`;
        
        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown',
          ...connectedKeyboard,
        });
      } else {
        welcomeMessage += `To get started, connect your Pacifica wallet.\n`;
        welcomeMessage += `Click the button below to begin.\n`;
        
        await this.bot.sendMessage(chatId, welcomeMessage, {
          parse_mode: 'Markdown',
          ...mainKeyboard,
        });
      }
    } catch (error) {
      logger.error('Error in handleStart:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle /help command
  private async handleHelp(msg: Message): Promise<void> {
    const chatId = msg.chat.id;

    let helpText = `📖 *Pacifica Bot Help*\n\n`;
    helpText += `*Available Commands:*\n`;
    helpText += `/start - Start the bot and see main menu\n`;
    helpText += `/connect - Connect your Pacifica wallet\n`;
    helpText += `/account - View your account information\n`;
    helpText += `/help - Show this help message\n\n`;
    helpText += `*How to Connect:*\n`;
    helpText += `1. Get your Solana wallet public key (account address)\n`;
    helpText += `2. Click "Connect Wallet" button\n`;
    helpText += `3. Send your wallet public key when prompted\n`;
    helpText += `4. Send your API Agent Private Key for signing (or skip for read-only)\n\n`;
    helpText += `*Security Note:*\n`;
    helpText += `Your keys are stored securely and never logged or shared.\n`;

    await this.bot.sendMessage(chatId, helpText, {
      parse_mode: 'Markdown',
      ...mainKeyboard,
    });
  }

  // Handle /account command
  private async handleAccountCommand(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    await this.accountHandler.showAccount(chatId, userId);
  }

  // Handle /connect command
  private async handleConnectCommand(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    await this.connectionHandler.startConnection(chatId, userId, this.userStates);
  }

  // Handle callback queries from inline buttons
  private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!chatId) return;

    // Answer callback query to remove loading state
    await this.bot.answerCallbackQuery(query.id);

    try {
      switch (data) {
        case 'connect':
          await this.connectionHandler.startConnection(chatId, userId, this.userStates);
          break;

        case 'account':
          await this.accountHandler.showAccount(chatId, userId);
          break;

        case 'help':
          await this.handleHelp(query.message!);
          break;

        case 'create_order':
          await this.ordersHandler.startLimitOrderCreation(chatId, userId, this.userStates);
          break;

        case 'create_market':
          await this.ordersHandler.startMarketOrderCreation(chatId, userId, this.userStates);
          break;

        case 'cancel_order_menu':
          await this.ordersHandler.startCancelOrder(chatId, userId, this.userStates);
          break;

        case 'create_tpsl':
          await this.ordersHandler.startTpslCreation(chatId, userId);
          break;

        case 'settings':
          await this.settingsHandler.showSettings(chatId, userId);
          break;

        case 'cancel_order':
          this.userStates.delete(userId);
          await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
          break;

        // Symbol selection
        case 'symbol_btc':
        case 'symbol_eth':
        case 'symbol_sol':
          await this.ordersHandler.handleSymbolSelection(chatId, userId, data.replace('symbol_', '').toUpperCase(), this.userStates);
          break;

        // Side selection
        case 'side_bid':
        case 'side_ask':
          await this.ordersHandler.handleSideSelection(chatId, userId, data.replace('side_', ''), this.userStates);
          break;

        default:
          logger.warn(`Unknown callback data: ${data}`);
      }
    } catch (error) {
      logger.error('Error handling callback query:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle incoming text messages
  private async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text;

    if (!userId || !text) return;

    // Ignore commands (they're handled separately)
    if (text.startsWith('/')) return;

    const state = this.userStates.get(userId);

    if (!state) return;

    try {
      // Handle public key input (step 1)
      if (state.awaitingPublicKey) {
        await this.connectionHandler.handlePublicKeyInput(chatId, userId, text, this.userStates);
        return;
      }

      // Handle agent private key input (step 2)
      if (state.awaitingAgentPrivateKey) {
        await this.connectionHandler.handleAgentPrivateKeyInput(chatId, userId, text, this.userStates);
        return;
      }

      // Handle limit order creation flow
      if (state.awaitingOrderSymbol) {
        await this.ordersHandler.handleOrderSymbol(chatId, userId, text, this.userStates);
        return;
      }

      if (state.awaitingOrderSide) {
        await this.ordersHandler.handleOrderSide(chatId, userId, text, this.userStates);
        return;
      }

      if (state.awaitingOrderPrice) {
        await this.ordersHandler.handleOrderPrice(chatId, userId, text, this.userStates);
        return;
      }

      if (state.awaitingOrderAmount) {
        // Check if it's a market order (no price) or limit order (has price)
        if (state.orderData?.price) {
          await this.ordersHandler.handleOrderAmount(chatId, userId, text, this.userStates);
        } else {
          await this.ordersHandler.handleMarketOrderAmount(chatId, userId, text, this.userStates);
        }
        return;
      }

      if (state.awaitingCancelOrder) {
        await this.ordersHandler.handleCancelOrderInput(chatId, userId, text, this.userStates);
        return;
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
      this.userStates.delete(userId);
    }
  }
}
