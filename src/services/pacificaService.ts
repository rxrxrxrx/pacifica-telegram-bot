// Pacifica service for managing API connections and fetching data
import { createPacificaClient, PacificaApiClient } from '../pacifica/apiClient';
import { logger } from '../util/logger';
import { userService } from './userService';

class PacificaService {
  // Create API client for a user
  private async getClientForUser(telegramId: number): Promise<PacificaApiClient> {
    const user = await userService.getUserByTelegramId(telegramId);
    
    if (!user) {
      throw new Error('User not found. Please connect your wallet first.');
    }

    if (!user.accountPublicKey) {
      throw new Error('Wallet not configured. Please connect your wallet first.');
    }

    return createPacificaClient(user.accountPublicKey, user.agentPrivateKey);
  }

  // Test user's API credentials
  async testConnection(telegramId: number): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.getClientForUser(telegramId);
      const isConnected = await client.testConnection();

      if (isConnected) {
        return {
          success: true,
          message: '✅ Connection successful!',
        };
      } else {
        return {
          success: false,
          message: '❌ Connection failed. Please check your API credentials.',
        };
      }
    } catch (error: any) {
      logger.error('Connection test error:', error);
      return {
        success: false,
        message: `❌ Connection failed: ${error.message || 'Unknown error'}`,
      };
    }
  }

  // Get account information and format for display
  async getAccountInfo(telegramId: number): Promise<string> {
    try {
      const client = await this.getClientForUser(telegramId);
      const user = await userService.getUserByTelegramId(telegramId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Fetch account data
      const account = await client.getAccount();
      const displayName = userService.getUserDisplayName(user);

      // Format balance information
      let message = `✅ *Connected to Pacifica*\n\n`;
      message += `👤 User: ${displayName}\n`;
      message += `🔑 Wallet: ${user.accountPublicKey.substring(0, 8)}...${user.accountPublicKey.substring(user.accountPublicKey.length - 6)}\n\n`;

      // Account equity and balances
      if (account.account_equity) {
        message += `💰 Account Equity: $${parseFloat(account.account_equity).toFixed(2)}\n`;
      }

      if (account.balance) {
        message += `💵 Balance: $${parseFloat(account.balance).toFixed(2)}\n`;
      }

      if (account.available_to_spend) {
        message += `🟢 Available to Spend: $${parseFloat(account.available_to_spend).toFixed(2)}\n`;
      }

      if (account.available_to_withdraw) {
        message += `💸 Available to Withdraw: $${parseFloat(account.available_to_withdraw).toFixed(2)}\n`;
      }

      // Positions and orders
      message += `\n📊 *Trading Activity:*\n`;
      message += `  • Open Positions: ${account.positions_count || 0}\n`;
      message += `  • Open Orders: ${account.orders_count || 0}\n`;
      message += `  • Stop Orders: ${account.stop_orders_count || 0}\n`;

      // Margin info if applicable
      if (account.total_margin_used && parseFloat(account.total_margin_used) > 0) {
        message += `\n📈 *Margin:*\n`;
        message += `  • Margin Used: $${parseFloat(account.total_margin_used).toFixed(2)}\n`;
        message += `  • Cross MMR: $${parseFloat(account.cross_mmr || '0').toFixed(2)}\n`;
      }
      message += ` \n\n 💡 Use the buttons below to interact with the bot.\n`;

      return message;
    } catch (error: any) {
      logger.error('Error fetching account info:', error);
      const errorMsg = error.message || 'Failed to fetch account information';
      throw new Error(errorMsg);
    }
  }

  // Get open orders count
  async getOpenOrdersCount(telegramId: number): Promise<number> {
    try {
      const client = await this.getClientForUser(telegramId);
      const orders = await client.getOpenOrders();
      return orders.length;
    } catch (error) {
      logger.error('Error fetching open orders:', error);
      return 0;
    }
  }

  // Get formatted account summary
  async getAccountSummary(telegramId: number): Promise<string> {
    try {
      const client = await this.getClientForUser(telegramId);
      const user = await userService.getUserByTelegramId(telegramId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const [account, openOrders] = await Promise.all([
        client.getAccount(),
        client.getOpenOrders().catch(() => []),
      ]);

      const displayName = userService.getUserDisplayName(user);

      let message = `📊 *Account Summary*\n\n`;
      message += `👤 ${displayName}\n\n`;

      if (account.totalEquity) {
        message += `💰 Equity: ${account.totalEquity}\n`;
      }

      if (account.availableBalance) {
        message += `💵 Available: ${account.availableBalance}\n`;
      }

      message += `📝 Open Orders: ${openOrders.length}\n`;

      return message;
    } catch (error: any) {
      logger.error('Error fetching account summary:', error);
      throw new Error(error.message || 'Failed to fetch account summary');
    }
  }

  // Verify credentials (called after user provides keys)
  async verifyCredentials(
    accountPublicKey: string,
    agentPrivateKey?: string
  ): Promise<{ valid: boolean; message: string }> {
    try {
      const client = createPacificaClient(accountPublicKey, agentPrivateKey);
      const isValid = await client.testConnection();

      if (isValid) {
        // Try to fetch account to ensure credentials are correct
        try {
          await client.getAccount();
          return {
            valid: true,
            message: '✅ Wallet credentials verified successfully!',
          };
        } catch (error: any) {
          // If account fetch fails, might still be valid but different endpoint
          logger.warn('Account fetch failed but connection OK:', error.message);
          return {
            valid: true,
            message: '✅ Connection successful! (Account data may not be available)',
          };
        }
      } else {
        return {
          valid: false,
          message: '❌ Could not connect to Pacifica API. Please try again.',
        };
      }
    } catch (error: any) {
      logger.error('Credential verification error:', error);
      return {
        valid: false,
        message: `❌ Verification failed: ${error.message || 'Unknown error'}`,
      };
    }
  }
}

export const pacificaService = new PacificaService();

