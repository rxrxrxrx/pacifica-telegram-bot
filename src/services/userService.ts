// User service for managing user data and credentials
import { EncryptedPrivateKey, IUser, User } from '../models/User';
import { EncryptionService } from '../util/encryption';
import { logger } from '../util/logger';

export interface UserData {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface ApiCredentials {
  accountPublicKey: string;
  agentPrivateKey?: string; // Raw private key (will be encrypted)
  agentPublicKey?: string;
  apiConfigKey?: string;
}

class UserService {
  // Find user by Telegram ID
  async getUserByTelegramId(telegramId: number): Promise<IUser | null> {
    try {
      const user = await User.findOne({ telegramId });
      return user;
    } catch (error) {
      logger.error(`Error finding user ${telegramId}:`, error);
      throw error;
    }
  }

  // Alias for getUserByTelegramId (for consistency)
  async getUserById(userId: number): Promise<IUser | null> {
    return this.getUserByTelegramId(userId);
  }

  // Get decrypted private key for a user
  async getDecryptedPrivateKey(userId: number): Promise<string | null> {
    try {
      const user = await this.getUserByTelegramId(userId);
      if (!user || !user.agentPrivateKey) {
        return null;
      }

      return EncryptionService.decrypt(user.agentPrivateKey);
    } catch (error) {
      logger.error('Error decrypting private key:', error);
      return null;
    }
  }

  // Create or update user with API credentials
  async saveUser(userData: UserData, credentials: ApiCredentials): Promise<IUser> {
    try {
      const existingUser = await this.getUserByTelegramId(userData.telegramId);

      if (existingUser) {
        // Update existing user
        existingUser.username = userData.username;
        existingUser.firstName = userData.firstName;
        existingUser.lastName = userData.lastName;
        existingUser.accountPublicKey = credentials.accountPublicKey;
        
        // Encrypt private key if provided
        if (credentials.agentPrivateKey) {
          existingUser.agentPrivateKey = EncryptionService.encrypt(credentials.agentPrivateKey);
        }
        
        existingUser.agentPublicKey = credentials.agentPublicKey;
        existingUser.apiConfigKey = credentials.apiConfigKey;
        
        await existingUser.save();
        logger.info(`Updated user credentials for Telegram ID: ${userData.telegramId}`);
        return existingUser;
      } else {
        // Encrypt private key if provided
        let encryptedPrivateKey: EncryptedPrivateKey | undefined;
        if (credentials.agentPrivateKey) {
          encryptedPrivateKey = EncryptionService.encrypt(credentials.agentPrivateKey);
        }

        // Create new user
        const newUser = new User({
          telegramId: userData.telegramId,
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          accountPublicKey: credentials.accountPublicKey,
          agentPrivateKey: encryptedPrivateKey,
          agentPublicKey: credentials.agentPublicKey,
          apiConfigKey: credentials.apiConfigKey,
        });

        await newUser.save();
        logger.info(`Created new user for Telegram ID: ${userData.telegramId}`);
        return newUser;
      }
    } catch (error) {
      logger.error('Error saving user:', error);
      throw error;
    }
  }

  // Update only API credentials for existing user
  async updateApiCredentials(telegramId: number, credentials: ApiCredentials): Promise<IUser> {
    try {
      const user = await this.getUserByTelegramId(telegramId);
      
      if (!user) {
        throw new Error('User not found');
      }

      user.accountPublicKey = credentials.accountPublicKey;
      
      // Encrypt private key if provided
      if (credentials.agentPrivateKey) {
        user.agentPrivateKey = EncryptionService.encrypt(credentials.agentPrivateKey);
      }
      
      user.agentPublicKey = credentials.agentPublicKey;
      user.apiConfigKey = credentials.apiConfigKey;
      
      await user.save();
      logger.info(`Updated API credentials for user: ${telegramId}`);
      return user;
    } catch (error) {
      logger.error('Error updating credentials:', error);
      throw error;
    }
  }

  // Check if user has connected their API
  async isUserConnected(telegramId: number): Promise<boolean> {
    const user = await this.getUserByTelegramId(telegramId);
    return user !== null && !!user.accountPublicKey;
  }

  // Delete user (for data removal requests)
  async deleteUser(telegramId: number): Promise<boolean> {
    try {
      const result = await User.deleteOne({ telegramId });
      logger.info(`Deleted user: ${telegramId}`);
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get user display name
  getUserDisplayName(user: IUser): string {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    } else if (user.firstName) {
      return user.firstName;
    } else if (user.username) {
      return `@${user.username}`;
    } else {
      return `User ${user.telegramId}`;
    }
  }
}

export const userService = new UserService();

