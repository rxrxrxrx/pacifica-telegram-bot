// Keyboard button definitions
export const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔗 Connect Wallet', callback_data: 'connect' }],
      [{ text: '📊 Show Account', callback_data: 'account' }],
      [{ text: '❓ Help', callback_data: 'help' }],
    ],
  },
};

export const connectedKeyboard = {
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
      [{ text: '⚙️ Settings', callback_data: 'settings' }],
      [{ text: '🔄 Reconnect', callback_data: 'connect' }, { text: '❓ Help', callback_data: 'help' }],
    ],
  },
};

export const symbolSelectionKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '₿ BTC', callback_data: 'symbol_btc' },
        { text: '⟠ ETH', callback_data: 'symbol_eth' },
        { text: '◎ SOL', callback_data: 'symbol_sol' },
      ],
      [{ text: '❌ Cancel', callback_data: 'cancel_order' }],
    ],
  },
};

export const sideSelectionKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🟢 BUY', callback_data: 'side_bid' },
        { text: '🔴 SELL', callback_data: 'side_ask' },
      ],
      [{ text: '❌ Cancel', callback_data: 'cancel_order' }],
    ],
  },
};

export const orderTypeKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📈 Limit Order', callback_data: 'create_order' },
        { text: '⚡ Market Order', callback_data: 'create_market' },
      ],
      [
        { text: '❌ Cancel Order', callback_data: 'cancel_order_menu' },
        { text: '🎯 TP/SL', callback_data: 'create_tpsl' },
      ],
      [{ text: '❌ Cancel', callback_data: 'cancel_order' }],
    ],
  },
};
