// Get user positions from Pacifica API
import axios from 'axios';
import { config } from '../config';
import { logger } from '../util/logger';

export interface Position {
  symbol: string;
  side: 'bid' | 'ask';
  amount: string;
  entry_price: string;
  margin?: string;
  funding: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface PositionsResponse {
  success: boolean;
  data?: Position[];
  error?: string;
}

export async function getPositions(accountPublicKey: string): Promise<PositionsResponse> {
  try {
    logger.info(`Fetching positions for: ${accountPublicKey}`);

    const response = await axios.get(
      `${config.pacificaBaseUrl}/positions`,
      {
        params: {
          account: accountPublicKey,
        },
        headers: {
          'Accept': '*/*',
        },
      }
    );

    logger.info('Positions fetched successfully');

    return {
      success: true,
      data: response.data.data,
    };

  } catch (error: any) {
    logger.error('Failed to fetch positions:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}
