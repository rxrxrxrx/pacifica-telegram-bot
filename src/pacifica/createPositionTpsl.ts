// Create Take Profit / Stop Loss order on Pacifica using agent wallet signature
import { Keypair } from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';
import { randomUUID } from 'crypto';
import nacl from 'tweetnacl';
import { config } from '../config';
import { logger } from '../util/logger';

// Helper function to sort JSON keys alphabetically (required by Pacifica)
function sortJsonKeys(value: any): any {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => sortJsonKeys(item));
  }
  const sorted: any = {};
  Object.keys(value).sort().forEach(key => {
    sorted[key] = sortJsonKeys(value[key]);
  });
  return sorted;
}

// Prepare message for signing (Pacifica format)
function prepareMessage(type: string, timestamp: number, expiryWindow: number, payload: any): string {
  const data = {
    type,
    timestamp,
    expiry_window: expiryWindow,
    data: payload,
  };

  const sorted = sortJsonKeys(data);
  // Compact JSON (no spaces)
  return JSON.stringify(sorted, null, 0);
}

// Sign message with agent wallet keypair
function signMessage(message: string, keypair: Keypair): string {
  const messageBytes = Buffer.from(message, 'utf-8');
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return bs58.encode(signature);
}

export interface TpslOrder {
  stop_price: string;
  limit_price?: string;
  client_order_id?: string;
}

export interface PositionTpslParams {
  accountPublicKey: string;
  agentPrivateKey: string;
  agentPublicKey: string;
  symbol: string;
  side: 'bid' | 'ask';
  takeProfit?: TpslOrder;
  stopLoss?: TpslOrder;
}

export interface PositionTpslResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function createPositionTpsl(params: PositionTpslParams): Promise<PositionTpslResponse> {
  try {
    logger.info(`Creating TP/SL for position: ${params.symbol} ${params.side}`);

    // Validate that at least one of takeProfit or stopLoss is provided
    if (!params.takeProfit && !params.stopLoss) {
      throw new Error('Either takeProfit or stopLoss must be provided');
    }

    // Parse agent wallet keypair
    const secretKey = bs58.decode(params.agentPrivateKey);
    const keypair = Keypair.fromSecretKey(secretKey);

    // Verify the public key matches
    if (keypair.publicKey.toBase58() !== params.agentPublicKey) {
      throw new Error('Agent public key does not match private key');
    }

    // Prepare TP/SL payload
    const timestamp = Date.now();
    const expiryWindow = 5000;
    
    const tpslPayload: any = {
      symbol: params.symbol,
      side: params.side,
    };

    // Add take profit if provided
    if (params.takeProfit) {
      tpslPayload.take_profit = {
        stop_price: params.takeProfit.stop_price,
        client_order_id: params.takeProfit.client_order_id || randomUUID(),
      };
      
      if (params.takeProfit.limit_price) {
        tpslPayload.take_profit.limit_price = params.takeProfit.limit_price;
      }
    }

    // Add stop loss if provided
    if (params.stopLoss) {
      tpslPayload.stop_loss = {
        stop_price: params.stopLoss.stop_price,
      };
      
      if (params.stopLoss.limit_price) {
        tpslPayload.stop_loss.limit_price = params.stopLoss.limit_price;
      }
      if (params.stopLoss.client_order_id) {
        tpslPayload.stop_loss.client_order_id = params.stopLoss.client_order_id;
      }
    }

    // Sign the message
    const message = prepareMessage('set_position_tpsl', timestamp, expiryWindow, tpslPayload);
    const signature = signMessage(message, keypair);

    // Construct request
    const request = {
      account: params.accountPublicKey,
      agent_wallet: params.agentPublicKey,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      ...tpslPayload,
    };

    logger.debug('Sending TP/SL request to Pacifica API');

    // Send request
    const response = await axios.post(
      `${config.pacificaBaseUrl}/positions/tpsl`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`TP/SL created successfully`);

    return {
      success: true,
      data: response.data.data,
    };

  } catch (error: any) {
    logger.error('Failed to create TP/SL:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}
