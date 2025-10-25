// Get market prices from Pacifica API
import axios from 'axios';
import { config } from '../config';
import { logger } from '../util/logger';

export interface PriceData {
  symbol: string;
  mark: string;
  mid: string;
  oracle: string;
  funding: string;
  next_funding: string;
  open_interest: string;
  volume_24h: string;
  yesterday_price: string;
  timestamp: number;
}

export interface PricesResponse {
  success: boolean;
  data?: PriceData[];
  error?: string;
}

export async function getPrices(): Promise<PricesResponse> {
  try {
    logger.info('Fetching market prices from Pacifica API');

    const response = await axios.get(
      `${config.pacificaBaseUrl}/info/prices`,
      {
        headers: {
          'Accept': '*/*',
        },
      }
    );

    logger.info('Market prices fetched successfully');

    return {
      success: true,
      data: response.data.data,
    };

  } catch (error: any) {
    logger.error('Failed to fetch market prices:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

export async function getPriceForSymbol(symbol: string): Promise<PriceData | null> {
  try {
    const pricesResult = await getPrices();
    
    if (pricesResult.success && pricesResult.data) {
      const priceData = pricesResult.data.find(price => price.symbol === symbol);
      return priceData || null;
    }
    
    return null;
  } catch (error) {
    logger.error(`Failed to get price for ${symbol}:`, error);
    return null;
  }
}
