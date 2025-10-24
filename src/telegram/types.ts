// Shared types for Telegram handlers
export interface UserState {
  awaitingPublicKey?: boolean;
  awaitingAgentPrivateKey?: boolean;
  tempPublicKey?: string;
  tempAgentPrivateKey?: string;
  tempAgentPublicKey?: string;
  
  // Limit order creation flow
  creatingLimitOrder?: boolean;
  awaitingOrderSymbol?: boolean;
  awaitingOrderSide?: boolean;
  awaitingOrderPrice?: boolean;
  awaitingOrderAmount?: boolean;
  orderData?: {
    symbol?: string;
    side?: 'bid' | 'ask';
    price?: string;
    amount?: string;
  };
}

export interface TelegramHandlers {
  handleStart(msg: any): Promise<void>;
  handleHelp(msg: any): Promise<void>;
  handleAccountCommand(msg: any): Promise<void>;
  handleConnectCommand(msg: any): Promise<void>;
  handleCallbackQuery(query: any): Promise<void>;
  handleMessage(msg: any): Promise<void>;
}
