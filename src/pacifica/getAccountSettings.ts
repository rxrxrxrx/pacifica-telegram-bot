// Get account settings from Pacifica API
import axios from 'axios';
import { config } from '../config';
import { logger } from '../util/logger';

export interface AccountSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
  created_at: number;
  updated_at: number;
}

export interface AccountSettingsResponse {
  success: boolean;
  data?: AccountSetting[];
  error?: string;
}

export async function getAccountSettings(accountPublicKey: string): Promise<AccountSettingsResponse> {
  try {
    logger.info(`Fetching account settings for: ${accountPublicKey}`);

    const response = await axios.get(
      `${config.pacificaBaseUrl}/account/settings`,
      {
        params: {
          account: accountPublicKey,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Account settings fetched successfully');

    return {
      success: true,
      data: response.data.data,
    };

  } catch (error: any) {
    logger.error('Failed to fetch account settings:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}
