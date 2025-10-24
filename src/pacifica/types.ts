// Type definitions for Pacifica API responses

export interface PacificaMarket {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  [key: string]: any;
}

export interface PacificaBalance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

export interface PacificaAccount {
  balance: string;
  fee_level: number;
  account_equity: string;
  available_to_spend: string;
  available_to_withdraw: string;
  pending_balance: string;
  total_margin_used: string;
  cross_mmr: string;
  positions_count: number;
  orders_count: number;
  stop_orders_count: number;
  updated_at: number;
  use_ltp_for_stop_orders?: boolean;
  [key: string]: any;
}

export interface PacificaSubaccount {
  subaccountId: string;
  name?: string;
  balances?: PacificaBalance[];
  [key: string]: any;
}

export interface PacificaOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: string;
  quantity: string;
  status: string;
  [key: string]: any;
}

export interface PacificaApiError {
  code: string;
  message: string;
  details?: any;
}

export interface SignedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: any;
}

