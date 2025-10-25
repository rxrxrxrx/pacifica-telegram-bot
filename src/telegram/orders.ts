// Order management handlers (limit, market, cancel, TP/SL)
import TelegramBot from 'node-telegram-bot-api';
import { cancelOrder } from '../pacifica/cancelOrder';
import { createMarketOrder } from '../pacifica/createMarketOrder';
import { createLimitOrder } from '../pacifica/createOrderLimit';
// import { createPositionTpsl } from '../pacifica/createPositionTpsl'; // Future use
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { connectedKeyboard, sideSelectionKeyboard, symbolSelectionKeyboard } from './keyboards';
import { UserState } from './types';

export class OrdersHandler {
  constructor(private bot: TelegramBot) {}

  // Start limit order creation flow
  async startLimitOrderCreation(chatId: number, userId: number, userStates: Map<number, UserState>): Promise<void> {
    try {
      // Check if user has agent wallet
      const user = await userService.getUserById(userId);
      
      if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Trading features not enabled!*\n\n' +
          'You need an Agent Wallet to place orders.\n\n' +
          'Use /connect and provide your Agent Wallet Private Key.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Initialize order creation state
      userStates.set(userId, {
        creatingLimitOrder: true,
        awaitingOrderSymbol: true,
        orderData: {},
      });

      await this.bot.sendMessage(
        chatId,
        '📈 *Create Limit Order*\n\n' +
        '1️⃣ Select a symbol:',
        {
          parse_mode: 'Markdown',
          ...symbolSelectionKeyboard,
        }
      );
    } catch (error) {
      logger.error('Error starting limit order creation:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle symbol selection from button
  async handleSymbolSelection(chatId: number, userId: number, symbol: string, userStates: Map<number, UserState>): Promise<void> {
    const state = userStates.get(userId);
    if (!state || !state.creatingLimitOrder) return;

    state.orderData!.symbol = symbol;
    state.awaitingOrderSymbol = false;
    state.awaitingOrderSide = true;
    userStates.set(userId, state);

    await this.bot.sendMessage(
      chatId,
      `✅ Symbol: *${symbol}*\n\n` +
      '2️⃣ Select side:',
      {
        parse_mode: 'Markdown',
        ...sideSelectionKeyboard,
      }
    );
  }

  // Handle side selection from button
  async handleSideSelection(chatId: number, userId: number, side: string, userStates: Map<number, UserState>): Promise<void> {
    const state = userStates.get(userId);
    if (!state || !state.creatingLimitOrder) return;

    state.orderData!.side = side as 'bid' | 'ask';
    state.awaitingOrderSide = false;
    state.awaitingOrderPrice = true;
    userStates.set(userId, state);

    const action = side === 'bid' ? 'BUY' : 'SELL';
    await this.bot.sendMessage(
      chatId,
      `✅ Side: *${action}*\n\n` +
      '3️⃣ Enter the limit price\n' +
      'Example: 95000\n\n' +
      'Or type *"cancel"* to stop',
      { parse_mode: 'Markdown' }
    );
  }

  // Handle order symbol input (text fallback)
  async handleOrderSymbol(chatId: number, userId: number, symbol: string, userStates: Map<number, UserState>): Promise<void> {
    if (symbol.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
      return;
    }

    const state = userStates.get(userId)!;
    
    const upperSymbol = symbol.toUpperCase().trim();
    if (upperSymbol.length < 2 || upperSymbol.length > 10) {
      await this.bot.sendMessage(chatId, '❌ Invalid symbol. Please enter a valid symbol (e.g., BTC, ETH)');
      return;
    }

    state.orderData!.symbol = upperSymbol;
    state.awaitingOrderSymbol = false;
    state.awaitingOrderSide = true;
    userStates.set(userId, state);

    await this.bot.sendMessage(
      chatId,
      `✅ Symbol: *${upperSymbol}*\n\n` +
      '2️⃣ Select side:',
      {
        parse_mode: 'Markdown',
        ...sideSelectionKeyboard,
      }
    );
  }

  // Handle order side input (text fallback)
  async handleOrderSide(chatId: number, userId: number, side: string, userStates: Map<number, UserState>): Promise<void> {
    if (side.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
      return;
    }

    const state = userStates.get(userId)!;
    const normalizedSide = side.toLowerCase().trim();

    if (normalizedSide !== 'bid' && normalizedSide !== 'ask') {
      await this.bot.sendMessage(
        chatId,
        '❌ Invalid side. Type:\n• *"bid"* to BUY\n• *"ask"* to SELL\n• *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    state.orderData!.side = normalizedSide as 'bid' | 'ask';
    state.awaitingOrderSide = false;
    state.awaitingOrderPrice = true;
    userStates.set(userId, state);

    const action = normalizedSide === 'bid' ? 'BUY' : 'SELL';
    await this.bot.sendMessage(
      chatId,
      `✅ Side: *${action}*\n\n` +
      '3️⃣ Enter the limit price\n' +
      'Example: 95000\n\n' +
      'Or type *"cancel"* to stop',
      { parse_mode: 'Markdown' }
    );
  }

  // Handle order price input
  async handleOrderPrice(chatId: number, userId: number, price: string, userStates: Map<number, UserState>): Promise<void> {
    if (price.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
      return;
    }

    const state = userStates.get(userId)!;
    
    const numPrice = parseFloat(price.trim());
    if (isNaN(numPrice) || numPrice <= 0) {
      await this.bot.sendMessage(chatId, '❌ Invalid price. Enter a valid positive number or type *"cancel"*', { parse_mode: 'Markdown' });
      return;
    }

    state.orderData!.price = price.trim();
    state.awaitingOrderPrice = false;
    state.awaitingOrderAmount = true;
    userStates.set(userId, state);

    await this.bot.sendMessage(
      chatId,
      `✅ Price: *$${price}*\n\n` +
      '4️⃣ Enter the amount\n' +
      'Example: 0.01\n\n' +
      'Or type *"cancel"* to stop',
      { parse_mode: 'Markdown' }
    );
  }

  // Handle order amount input and execute
  async handleOrderAmount(chatId: number, userId: number, amount: string, userStates: Map<number, UserState>): Promise<void> {
    if (amount.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
      return;
    }

    const state = userStates.get(userId)!;
    
    const numAmount = parseFloat(amount.trim());
    if (isNaN(numAmount) || numAmount <= 0) {
      await this.bot.sendMessage(chatId, '❌ Invalid amount. Enter a valid positive number or type *"cancel"*', { parse_mode: 'Markdown' });
      return;
    }

    state.orderData!.amount = amount.trim();
    
    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      userStates.delete(userId);
      return;
    }

    const orderData = state.orderData!;
    userStates.delete(userId);

    const action = orderData.side === 'bid' ? 'BUY' : 'SELL';
    await this.bot.sendMessage(
      chatId,
      `📝 *Order Summary*\n\n` +
      `Symbol: *${orderData.symbol}*\n` +
      `Side: *${action}*\n` +
      `Price: *$${orderData.price}*\n` +
      `Amount: *${orderData.amount}*\n\n` +
      `🔄 Placing order...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await createLimitOrder({
        accountPublicKey: user.accountPublicKey,
        agentPrivateKey: user.agentPrivateKey,
        agentPublicKey: user.agentPublicKey,
        symbol: orderData.symbol!,
        side: orderData.side!,
        price: orderData.price!,
        amount: orderData.amount!,
      });

      if (result.success && result.data) {
        await this.bot.sendMessage(
          chatId,
          `✅ *Limit Order Created!*\n\n` +
          `📊 Order ID: *${result.data.order_id}*\n\n` +
          `Symbol: ${orderData.symbol}\n` +
          `Side: ${action}\n` +
          `Price: $${orderData.price}\n` +
          `Amount: ${orderData.amount}\n\n` +
          `View on Pacifica dashboard.`,
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
          `❌ *Failed to create order*\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try again.`,
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
      }
    } catch (error: any) {
      logger.error('Error creating limit order:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Error creating order*\n\n` +
        `${error.message || 'An unexpected error occurred'}\n\n` +
        `Please try again later.`,
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    }
  }

  // Start market order creation flow
  async startMarketOrderCreation(chatId: number, userId: number, userStates: Map<number, UserState>): Promise<void> {
    try {
      // Check if user has agent wallet
      const user = await userService.getUserById(userId);
      
      if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Trading features not enabled!*\n\n' +
          'You need an Agent Wallet to place orders.\n\n' +
          'Use /connect and provide your Agent Wallet Private Key.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Initialize market order creation state
      userStates.set(userId, {
        creatingLimitOrder: true, // Reuse same state for market orders
        awaitingOrderSymbol: true,
        orderData: {},
      });

      await this.bot.sendMessage(
        chatId,
        '⚡ *Create Market Order*\n\n' +
        '1️⃣ Select a symbol:',
        {
          parse_mode: 'Markdown',
          ...symbolSelectionKeyboard,
        }
      );
    } catch (error) {
      logger.error('Error starting market order creation:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle market order amount input and execute
  async handleMarketOrderAmount(chatId: number, userId: number, amount: string, userStates: Map<number, UserState>): Promise<void> {
    if (amount.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Order creation cancelled.', connectedKeyboard);
      return;
    }

    const state = userStates.get(userId)!;
    
    const numAmount = parseFloat(amount.trim());
    if (isNaN(numAmount) || numAmount <= 0) {
      await this.bot.sendMessage(chatId, '❌ Invalid amount. Enter a valid positive number or type *"cancel"*', { parse_mode: 'Markdown' });
      return;
    }

    state.orderData!.amount = amount.trim();
    
    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      userStates.delete(userId);
      return;
    }

    const orderData = state.orderData!;
    userStates.delete(userId);

    const action = orderData.side === 'bid' ? 'BUY' : 'SELL';
    await this.bot.sendMessage(
      chatId,
      `📝 *Market Order Summary*\n\n` +
      `Symbol: *${orderData.symbol}*\n` +
      `Side: *${action}*\n` +
      `Amount: *${orderData.amount}*\n\n` +
      `🔄 Placing market order...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await createMarketOrder({
        accountPublicKey: user.accountPublicKey,
        agentPrivateKey: user.agentPrivateKey,
        agentPublicKey: user.agentPublicKey,
        symbol: orderData.symbol!,
        side: orderData.side!,
        amount: orderData.amount!,
        slippagePercent: '0.5', // Default 0.5% slippage
      });

      if (result.success && result.data) {
        await this.bot.sendMessage(
          chatId,
          `✅ *Market Order Created!*\n\n` +
          `📊 Order ID: *${result.data.order_id}*\n\n` +
          `Symbol: ${orderData.symbol}\n` +
          `Side: ${action}\n` +
          `Amount: ${orderData.amount}\n\n` +
          `View on Pacifica dashboard.`,
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
          `❌ *Failed to create market order*\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try again.`,
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
      }
    } catch (error: any) {
      logger.error('Error creating market order:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Error creating market order*\n\n` +
        `${error.message || 'An unexpected error occurred'}\n\n` +
        `Please try again later.`,
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    }
  }

  // Start cancel order flow
  async startCancelOrder(chatId: number, userId: number, userStates: Map<number, UserState>): Promise<void> {
    try {
      // Check if user has agent wallet
      const user = await userService.getUserById(userId);
      
      if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Trading features not enabled!*\n\n' +
          'You need an Agent Wallet to cancel orders.\n\n' +
          'Use /connect and provide your Agent Wallet Private Key.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        '❌ *Cancel Order*\n\n' +
        'Enter the order ID or client order ID to cancel:\n\n' +
        'Example: 12345 (order ID)\n' +
        'Or: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (client order ID)\n\n' +
        'Type *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );

      // Set state for cancel order input
      userStates.set(userId, {
        awaitingCancelOrder: true,
        orderData: {},
      });
    } catch (error) {
      logger.error('Error starting cancel order:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle cancel order input
  async handleCancelOrderInput(chatId: number, userId: number, input: string, userStates: Map<number, UserState>): Promise<void> {
    if (input.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ Cancel order cancelled.', connectedKeyboard);
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      userStates.delete(userId);
      return;
    }

    const trimmedInput = input.trim();
    let orderId: number | undefined;
    let clientOrderId: string | undefined;

    // Check if it's a numeric order ID
    if (/^\d+$/.test(trimmedInput)) {
      orderId = parseInt(trimmedInput);
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedInput)) {
      clientOrderId = trimmedInput;
    } else {
      await this.bot.sendMessage(
        chatId,
        '❌ Invalid format. Enter a numeric order ID or UUID client order ID.\n\n' +
        'Type *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    userStates.delete(userId);

    await this.bot.sendMessage(
      chatId,
      `🔄 Canceling order...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await cancelOrder({
        accountPublicKey: user.accountPublicKey,
        agentPrivateKey: user.agentPrivateKey,
        agentPublicKey: user.agentPublicKey,
        symbol: 'BTC', // Default symbol - could be made configurable
        orderId,
        clientOrderId,
      });

      if (result.success && result.data) {
        await this.bot.sendMessage(
          chatId,
          `✅ *Order Canceled!*\n\n` +
          `📊 Order ID: *${result.data.order_id}*\n\n` +
          `Order has been successfully canceled.`,
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
          `❌ *Failed to cancel order*\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try again.`,
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
      }
    } catch (error: any) {
      logger.error('Error canceling order:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Error canceling order*\n\n` +
        `${error.message || 'An unexpected error occurred'}\n\n` +
        `Please try again later.`,
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    }
  }

  // Start TP/SL creation flow
  async startTpslCreation(chatId: number, userId: number): Promise<void> {
    try {
      // Check if user has agent wallet
      const user = await userService.getUserById(userId);
      
      if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Trading features not enabled!*\n\n' +
          'You need an Agent Wallet to set TP/SL.\n\n' +
          'Use /connect and provide your Agent Wallet Private Key.',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        '🎯 *Set Take Profit / Stop Loss*\n\n' +
        'This feature is complex and requires multiple parameters.\n\n' +
        'For now, please use the Pacifica web interface for TP/SL orders.\n\n' +
        'This feature will be enhanced in future updates.',
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    } catch (error) {
      logger.error('Error starting TP/SL creation:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }
}
