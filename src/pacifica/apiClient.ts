// Pacifica API client with Solana-based signature authentication
import { Keypair } from '@solana/web3.js';
import axios, { AxiosInstance } from 'axios';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { config } from '../config';
import { logger } from '../util/logger';
import {
  PacificaAccount,
  PacificaApiError,
  PacificaMarket,
  PacificaOrder,
  PacificaSubaccount,
} from './types';

export class PacificaApiClient {
  private axiosInstance: AxiosInstance;
  private accountPublicKey: string;
  private agentKeypair?: Keypair;
  private agentPublicKey?: string;

  constructor(accountPublicKey: string, agentPrivateKey?: string) {
    this.accountPublicKey = accountPublicKey;
    
    // If agent private key is provided, create keypair (optional for read-only mode)
    if (agentPrivateKey) {
      try {
        this.agentKeypair = Keypair.fromSecretKey(bs58.decode(agentPrivateKey));
        this.agentPublicKey = this.agentKeypair.publicKey.toBase58();
        logger.info('Agent keypair configured for signing');
      } catch (error) {
        logger.warn('Failed to parse agent private key - continuing in read-only mode:', error);
        // Don't throw - allow read-only operations
      }
    } else {
      logger.info('No agent keypair provided - read-only mode');
    }

    this.axiosInstance = axios.create({
      baseURL: config.pacificaBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: any) => {
        const apiError: PacificaApiError = {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message,
          details: error.response?.data,
        };
        logger.error('API Error:', apiError);
        return Promise.reject(apiError);
      }
    );
  }

  // Sort JSON keys alphabetically (required by Pacifica)
  private sortJsonKeys(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.sortJsonKeys(item));
    }
    const sorted: any = {};
    Object.keys(value).sort().forEach(key => {
      sorted[key] = this.sortJsonKeys(value[key]);
    });
    return sorted;
  }

  // Prepare message for signing (Pacifica format)
  private prepareMessage(type: string, payload: any): string {
    const timestamp = Date.now();
    const data = {
      type,
      timestamp,
      expiry_window: 5000,
      data: payload,
    };

    const sorted = this.sortJsonKeys(data);
    // Compact JSON (no spaces)
    return JSON.stringify(sorted, null, 0);
  }

  // Sign message with Solana keypair
  private signMessage(message: string, keypair: Keypair): string {
    const messageBytes = Buffer.from(message, 'utf-8');
    // Use nacl to sign the message with the keypair's secret key
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
  }

  // Create request body with signature
  private createSignedRequest(
    type: string,
    payload: any,
    useAgentWallet: boolean = false
  ): any {
    const message = this.prepareMessage(type, payload);
    const timestamp = Date.now();

    let signature: string;
    const requestBody: any = {
      account: this.accountPublicKey,
      timestamp,
      expiry_window: 5000,
      ...payload,
    };

    if (useAgentWallet && this.agentKeypair && this.agentPublicKey) {
      // Sign with agent wallet
      signature = this.signMessage(message, this.agentKeypair);
      requestBody.agent_wallet = this.agentPublicKey;
    } else if (this.agentKeypair) {
      // Sign with account keypair (if we have it)
      signature = this.signMessage(message, this.agentKeypair);
    } else {
      throw new Error('No keypair available for signing');
    }

    requestBody.signature = signature;

    logger.debug('Signed request:', { type, timestamp, hasAgentWallet: !!this.agentPublicKey });

    return requestBody;
  }

  // Test connection by fetching markets
  async testConnection(): Promise<boolean> {
    try {
      await this.getMarkets();
      return true;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    }
  }

  // Get available markets (public endpoint)
  async getMarkets(): Promise<PacificaMarket[]> {
    try {
      const response = await this.axiosInstance.get('/markets');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Get account information (simple GET, no signature required)
  async getAccount(): Promise<PacificaAccount> {
    try {
      const response = await this.axiosInstance.get('/account', {
        params: {
          account: this.accountPublicKey,
        },
      });
      return response.data.data; // API returns data as object
    } catch (error) {
      throw error;
    }
  }

  // Get subaccounts information (simple GET, no signature required)
  async getSubaccounts(): Promise<PacificaSubaccount[]> {
    try {
      const response = await this.axiosInstance.get('/subaccounts', {
        params: {
          account: this.accountPublicKey,
        },
      });
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  }

  // Get open orders (simple GET, no signature required)
  async getOpenOrders(symbol?: string): Promise<PacificaOrder[]> {
    try {
      const params: any = { account: this.accountPublicKey };
      if (symbol) {
        params.symbol = symbol;
      }
      const response = await this.axiosInstance.get('/orders', { params });
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  }

  // Get balance summary
  async getBalances(): Promise<any> {
    try {
      const account = await this.getAccount();
      return account.balances || [];
    } catch (error) {
      throw error;
    }
  }

  // Place a market order (requires signature)
  async placeMarketOrder(params: {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    slippagePercent?: string;
    clientOrderId?: string;
  }): Promise<PacificaOrder> {
    try {
      const payload = {
        symbol: params.symbol,
        side: params.side,
        amount: params.amount,
        reduce_only: false,
        slippage_percent: params.slippagePercent || '0.5',
        client_order_id: params.clientOrderId || `order_${Date.now()}`,
      };

      const requestBody = this.createSignedRequest('create_market_order', payload, true);
      const response = await this.axiosInstance.post('/orders/create_market', requestBody);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Place a limit order (requires signature)
  async placeLimitOrder(params: {
    symbol: string;
    side: 'bid' | 'ask';
    price: string;
    amount: string;
    postOnly?: boolean;
    clientOrderId?: string;
  }): Promise<PacificaOrder> {
    try {
      const payload = {
        symbol: params.symbol,
        side: params.side,
        price: params.price,
        amount: params.amount,
        reduce_only: false,
        post_only: params.postOnly || false,
        client_order_id: params.clientOrderId || `order_${Date.now()}`,
      };

      const requestBody = this.createSignedRequest('create_limit_order', payload, true);
      const response = await this.axiosInstance.post('/orders/create_limit', requestBody);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Cancel an order (requires signature)
  async cancelOrder(orderId: string): Promise<any> {
    try {
      const payload = {
        order_id: orderId,
      };

      const requestBody = this.createSignedRequest('cancel_order', payload, true);
      const response = await this.axiosInstance.post('/orders/cancel', requestBody);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Cancel all orders (requires signature)
  async cancelAllOrders(symbol?: string): Promise<any> {
    try {
      const payload: any = {};
      if (symbol) {
        payload.symbol = symbol;
      }

      const requestBody = this.createSignedRequest('cancel_all_orders', payload, true);
      const response = await this.axiosInstance.post('/orders/cancel_all', requestBody);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

// Factory function to create API client
export function createPacificaClient(
  accountPublicKey: string,
  agentPrivateKey?: string
): PacificaApiClient {
  return new PacificaApiClient(accountPublicKey, agentPrivateKey);
}
