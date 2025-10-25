// Order management handlers (limit, market, cancel, TP/SL)
import TelegramBot from 'node-telegram-bot-api';
import { cancelOrder } from '../pacifica/cancelOrder';
import { createMarketOrder } from '../pacifica/createMarketOrder';
import { createLimitOrder } from '../pacifica/createOrderLimit';
import { createPositionTpsl } from '../pacifica/createPositionTpsl';
import { getPositions } from '../pacifica/getPositions';
import { getPriceForSymbol } from '../pacifica/getPrices';
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

  // Handle symbol selection from button (works for both limit and market orders)
  async handleSymbolSelection(chatId: number, userId: number, symbol: string, userStates: Map<number, UserState>): Promise<void> {
    const state = userStates.get(userId);
    if (!state || !state.creatingLimitOrder) return;

    state.orderData!.symbol = symbol;
    state.awaitingOrderSymbol = false;
    state.awaitingOrderSide = true;
    userStates.set(userId, state);

    // Get current price for the symbol
    let priceInfo = '';
    try {
      const priceData = await getPriceForSymbol(symbol);
      if (priceData) {
        priceInfo = `\n💰 *Current Price:*\n`;
        priceInfo += `Mark: *$${parseFloat(priceData.mark).toFixed(2)}*\n`;
        priceInfo += `Mid: *$${parseFloat(priceData.mid).toFixed(2)}*\n`;
        priceInfo += `Oracle: *$${parseFloat(priceData.oracle).toFixed(2)}*\n\n`;
      }
    } catch (error) {
      logger.warn(`Could not fetch price for ${symbol}:`, error);
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Symbol: *${symbol}*${priceInfo}` +
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
    
    // Get current price for reference
    let priceInfo = '';
    if (state.orderData?.symbol) {
      try {
        const priceData = await getPriceForSymbol(state.orderData.symbol);
        if (priceData) {
          const currentPrice = parseFloat(priceData.mark);
          priceInfo = `\n💰 *Current Mark Price: $${currentPrice.toFixed(2)}*\n\n`;
        }
      } catch (error) {
        logger.warn(`Could not fetch price for ${state.orderData.symbol}:`, error);
      }
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Side: *${action}*${priceInfo}` +
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

      // Get user positions to show available orders
      const positionsResult = await getPositions(user.accountPublicKey);
      
      let positionsText = '❌ *Cancel Order*\n\n';
      
      if (positionsResult.success && positionsResult.data && positionsResult.data.length > 0) {
        positionsText += `*Your Open Positions:*\n`;
        positionsResult.data.forEach((position, index) => {
          const side = position.side === 'bid' ? 'LONG' : 'SHORT';
          positionsText += `${index + 1}. *${position.symbol}* ${side}\n`;
          positionsText += `   Amount: ${position.amount}\n`;
          positionsText += `   Entry: $${parseFloat(position.entry_price).toFixed(2)}\n\n`;
        });
        positionsText += `Enter the symbol to cancel orders for:\n\n`;
        positionsText += `Example: BTC, ETH, SOL\n`;
      } else {
        positionsText += `No open positions found.\n\n`;
        positionsText += `Enter the order ID or client order ID to cancel:\n\n`;
        positionsText += `Example: 12345 (order ID)\n`;
        positionsText += `Or: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (client order ID)\n`;
      }
      
      positionsText += `\nType *"cancel"* to stop`;

      await this.bot.sendMessage(chatId, positionsText, { parse_mode: 'Markdown' });

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
  async startTpslCreation(chatId: number, userId: number, userStates: Map<number, UserState>): Promise<void> {
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

      // Get user positions
      const positionsResult = await getPositions(user.accountPublicKey);
      
      if (!positionsResult.success || !positionsResult.data || positionsResult.data.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '❌ *No Open Positions*\n\n' +
          'You need to have an open position to set TP/SL.\n\n' +
          'Open a position first, then come back to set TP/SL.',
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
        return;
      }

      let positionsText = '🎯 *Set Take Profit / Stop Loss*\n\n';
      positionsText += `*Your Open Positions:*\n`;
      
      positionsResult.data.forEach((position, index) => {
        const side = position.side === 'bid' ? 'LONG' : 'SHORT';
        positionsText += `${index + 1}. *${position.symbol}* ${side}\n`;
        positionsText += `   Amount: ${position.amount}\n`;
        positionsText += `   Entry: $${parseFloat(position.entry_price).toFixed(2)}\n\n`;
      });
      
      positionsText += `Select a position to set TP/SL:\n\n`;
      positionsText += `Enter the symbol (e.g., BTC, ETH, SOL):\n`;
      positionsText += `Type *"cancel"* to stop`;

      await this.bot.sendMessage(chatId, positionsText, { parse_mode: 'Markdown' });

      // Set state for TP/SL creation
      userStates.set(userId, {
        creatingTpsl: true,
        awaitingTpslSymbol: true,
        orderData: {},
      });
    } catch (error) {
      logger.error('Error starting TP/SL creation:', error);
      await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  }

  // Handle TP/SL symbol selection
  async handleTpslSymbolSelection(chatId: number, userId: number, symbol: string, userStates: Map<number, UserState>): Promise<void> {
    if (symbol.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ TP/SL creation cancelled.', connectedKeyboard);
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      userStates.delete(userId);
      return;
    }

    const upperSymbol = symbol.toUpperCase().trim();
    
    // Verify position exists
    const positionsResult = await getPositions(user.accountPublicKey);
    if (!positionsResult.success || !positionsResult.data) {
      await this.bot.sendMessage(chatId, '❌ Could not fetch positions. Please try again.');
      return;
    }

    const position = positionsResult.data.find(p => p.symbol === upperSymbol);
    if (!position) {
      await this.bot.sendMessage(
        chatId,
        `❌ No position found for ${upperSymbol}.\n\n` +
        `Available positions: ${positionsResult.data.map(p => p.symbol).join(', ')}\n\n` +
        `Type *"cancel"* to stop`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Get current price
    let priceInfo = '';
    try {
      const priceData = await getPriceForSymbol(upperSymbol);
      if (priceData) {
        const currentPrice = parseFloat(priceData.mark);
        priceInfo = `\n💰 *Current Mark Price: $${currentPrice.toFixed(2)}*\n`;
      }
    } catch (error) {
      logger.warn(`Could not fetch price for ${upperSymbol}:`, error);
    }

    const side = position.side === 'bid' ? 'LONG' : 'SHORT';
    const entryPrice = parseFloat(position.entry_price);
    
    // Update state
    const state = userStates.get(userId);
    if (state) {
      state.awaitingTpslSymbol = false;
      state.awaitingTpslType = true;
      state.orderData = { symbol: upperSymbol, side: position.side };
      userStates.set(userId, state);
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Position: *${upperSymbol}* ${side}${priceInfo}\n` +
      `Entry Price: *$${entryPrice.toFixed(2)}*\n\n` +
      `What would you like to set?\n\n` +
      `1️⃣ Take Profit only\n` +
      `2️⃣ Stop Loss only\n` +
      `3️⃣ Both TP & SL\n\n` +
      `Type 1, 2, or 3\n` +
      `Type *"cancel"* to stop`,
      { parse_mode: 'Markdown' }
    );
  }

  // Handle TP/SL type selection
  async handleTpslTypeSelection(chatId: number, userId: number, input: string, userStates: Map<number, UserState>): Promise<void> {
    if (input.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ TP/SL creation cancelled.', connectedKeyboard);
      return;
    }

    const type = input.trim();
    if (!['1', '2', '3'].includes(type)) {
      await this.bot.sendMessage(
        chatId,
        '❌ Invalid selection. Type 1, 2, or 3.\n\n' +
        'Type *"cancel"* to stop',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const state = userStates.get(userId);
    if (!state) return;

    state.awaitingTpslType = false;
    state.awaitingTpslPrice = true;
    state.orderData!.tpslType = type;
    userStates.set(userId, state);

    const symbol = state.orderData!.symbol!;
    const side = state.orderData!.side!;
    const action = side === 'bid' ? 'LONG' : 'SHORT';

    let message = `✅ TP/SL Type: *${type === '1' ? 'Take Profit Only' : type === '2' ? 'Stop Loss Only' : 'Both TP & SL'}*\n\n`;
    message += `Position: *${symbol}* ${action}\n\n`;

    if (type === '1' || type === '3') {
      message += `Enter Take Profit price:\n`;
      message += `Example: 55000 (for TP at $55,000)\n\n`;
    }
    if (type === '2' || type === '3') {
      message += `Enter Stop Loss price:\n`;
      message += `Example: 48000 (for SL at $48,000)\n\n`;
    }
    message += `Type *"cancel"* to stop`;

    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  // Handle TP/SL price input and create
  async handleTpslPriceInput(chatId: number, userId: number, input: string, userStates: Map<number, UserState>): Promise<void> {
    if (input.toLowerCase() === 'cancel') {
      userStates.delete(userId);
      await this.bot.sendMessage(chatId, '❌ TP/SL creation cancelled.', connectedKeyboard);
      return;
    }

    const user = await userService.getUserById(userId);
    if (!user || !user.agentPrivateKey || !user.agentPublicKey) {
      await this.bot.sendMessage(chatId, '❌ Agent wallet not found. Reconnect with /connect');
      userStates.delete(userId);
      return;
    }

    const state = userStates.get(userId);
    if (!state) return;

    const symbol = state.orderData!.symbol!;
    const side = state.orderData!.side!;
    const tpslType = state.orderData!.tpslType!;
    
    userStates.delete(userId);

    // Parse prices based on type
    let takeProfit: any = undefined;
    let stopLoss: any = undefined;

    if (tpslType === '1' || tpslType === '3') {
      const tpPrice = parseFloat(input.trim());
      if (isNaN(tpPrice) || tpPrice <= 0) {
        await this.bot.sendMessage(
          chatId,
          '❌ Invalid Take Profit price. Enter a valid positive number.\n\n' +
          'Type *"cancel"* to stop',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      takeProfit = {
        stop_price: tpPrice.toString(),
        client_order_id: `tp_${Date.now()}`,
      };
    }

    if (tpslType === '2' || tpslType === '3') {
      const slPrice = parseFloat(input.trim());
      if (isNaN(slPrice) || slPrice <= 0) {
        await this.bot.sendMessage(
          chatId,
          '❌ Invalid Stop Loss price. Enter a valid positive number.\n\n' +
          'Type *"cancel"* to stop',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      stopLoss = {
        stop_price: slPrice.toString(),
        client_order_id: `sl_${Date.now()}`,
      };
    }

    await this.bot.sendMessage(
      chatId,
      `🔄 Setting TP/SL for ${symbol}...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const result = await createPositionTpsl({
        accountPublicKey: user.accountPublicKey,
        agentPrivateKey: user.agentPrivateKey,
        agentPublicKey: user.agentPublicKey,
        symbol,
        side: side as 'bid' | 'ask',
        takeProfit,
        stopLoss,
      });

      if (result.success) {
        let successMessage = `✅ *TP/SL Set Successfully!*\n\n`;
        successMessage += `Symbol: *${symbol}*\n`;
        if (takeProfit) successMessage += `Take Profit: *$${takeProfit.stop_price}*\n`;
        if (stopLoss) successMessage += `Stop Loss: *$${stopLoss.stop_price}*\n`;
        successMessage += `\nYour TP/SL orders have been placed.`;

        await this.bot.sendMessage(chatId, successMessage, {
          parse_mode: 'Markdown',
          ...connectedKeyboard,
        });
      } else {
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
          `❌ *Failed to set TP/SL*\n\n` +
          `Error: ${errorMsg}\n\n` +
          `Please try again.`,
          { parse_mode: 'Markdown', ...connectedKeyboard }
        );
      }
    } catch (error: any) {
      logger.error('Error setting TP/SL:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ *Error setting TP/SL*\n\n` +
        `${error.message || 'An unexpected error occurred'}\n\n` +
        `Please try again later.`,
        { parse_mode: 'Markdown', ...connectedKeyboard }
      );
    }
  }
}
