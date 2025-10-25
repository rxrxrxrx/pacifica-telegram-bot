// Cancel order on Pacifica using agent wallet signature
import { Keypair } from '@solana/web3.js';
import axios from 'axios';
import bs58 from 'bs58';
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

export interface CancelOrderParams {
  accountPublicKey: string;
  agentPrivateKey: string;
  agentPublicKey: string;
  symbol: string;
  orderId?: number;
  clientOrderId?: string;
}

export interface CancelOrderResponse {
  success: boolean;
  data?: {
    order_id: number;
  };
  error?: string;
}

export async function cancelOrder(params: CancelOrderParams): Promise<CancelOrderResponse> {
  try {
    logger.info(`Canceling order: ${params.symbol} - ${params.orderId || params.clientOrderId}`);

    // Validate that either orderId or clientOrderId is provided
    if (!params.orderId && !params.clientOrderId) {
      throw new Error('Either orderId or clientOrderId must be provided');
    }

    // Parse agent wallet keypair
    const secretKey = bs58.decode(params.agentPrivateKey);
    const keypair = Keypair.fromSecretKey(secretKey);

    // Verify the public key matches
    if (keypair.publicKey.toBase58() !== params.agentPublicKey) {
      throw new Error('Agent public key does not match private key');
    }

    // Prepare cancel payload
    const timestamp = Date.now();
    const expiryWindow = 5000;
    
    const cancelPayload: any = {
      symbol: params.symbol,
    };

    // Add either orderId or clientOrderId
    if (params.orderId) {
      cancelPayload.order_id = params.orderId;
    } else {
      cancelPayload.client_order_id = params.clientOrderId;
    }

    // Sign the message
    const message = prepareMessage('cancel_order', timestamp, expiryWindow, cancelPayload);
    const signature = signMessage(message, keypair);

    // Construct request
    const request = {
      account: params.accountPublicKey,
      agent_wallet: params.agentPublicKey,
      signature,
      timestamp,
      expiry_window: expiryWindow,
      ...cancelPayload,
    };

    logger.debug('Sending cancel order request to Pacifica API');

    // Send request
    const response = await axios.post(
      `${config.pacificaBaseUrl}/orders/cancel`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`Order canceled successfully: order_id=${response.data.data.order_id}`);

    return {
      success: true,
      data: response.data.data,
    };

  } catch (error: any) {
    logger.error('Failed to cancel order:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}
