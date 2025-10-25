// Wallet connection flow handlers
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import TelegramBot from 'node-telegram-bot-api';
import { pacificaService } from '../services/pacificaService';
import { userService } from '../services/userService';
import { logger } from '../util/logger';
import { connectedKeyboard } from './keyboards';
import { UserState } from './types';

export class ConnectionHandler {
  constructor(private bot: TelegramBot) {}

  // Start wallet connection flow
  async startConnection(chatId: number, userId: number, userStates: Map<number, UserState>): Promise<void> {
    const message = `🔑 *Connect Your Pacifica Wallet*\n\n`;
    const instructions = `Step 1/2: Send your *Main Wallet Public Address*\n\n`;
    const note = `_Example: CQrXnr8fUAM5ZsAn6CQhEoBT9Gx1g91xXFvQaErrNqsC_`;

    await this.bot.sendMessage(chatId, message + instructions + note, {
      parse_mode: 'Markdown',
    });

    // Set user state to awaiting public key
    userStates.set(userId, { awaitingPublicKey: true });
  }

  // Handle wallet public key input (Step 1)
  async handlePublicKeyInput(chatId: number, userId: number, publicKey: string, userStates: Map<number, UserState>): Promise<void> {
    // Validate Solana public key format (basic check - should be base58, 32-44 chars)
    if (publicKey.length < 32 || publicKey.length > 44) {
      await this.bot.sendMessage(chatId, '❌ Invalid wallet public key format. Please try again with a valid Solana address.');
      return;
    }

    const state = userStates.get(userId)!;
    state.awaitingPublicKey = false;
    state.tempPublicKey = publicKey;
    state.awaitingAgentPrivateKey = true;
    userStates.set(userId, state);

    const message = `✅ Main wallet public key received.\n\n`;
    const prompt = `Step 2/2: Send your *Agent Wallet Private Key*\n\n`;
    const instructions = `• This is the ~88 character private key\n`;
    const howTo = `• Get it from Pacifica API key page → "Generate"\n`;
    const note = `• ⚠️ *IMPORTANT:* Save it - shown only once!\n`;
    const skip = `• Or type *"skip"* for read-only mode`;

    await this.bot.sendMessage(
      chatId,
      message + prompt + instructions + howTo + note + skip,
      { parse_mode: 'Markdown' }
    );

    await this.bot.sendPhoto(chatId, 'https://i.ibb.co/BHMnRzhL/wallet-agent-key.png');
  }

  // Handle agent private key input (Step 2)
  async handleAgentPrivateKeyInput(chatId: number, userId: number, input: string, userStates: Map<number, UserState>): Promise<void> {
    const state = userStates.get(userId)!;

    if (input.toLowerCase() !== 'skip') {
      // Validate private key format (must be ~88 characters for Solana keypair)
      if (input.length < 80 || input.length > 95) {
        await this.bot.sendMessage(
          chatId, 
          '❌ *Invalid Agent Wallet Private Key!*\n\n' +
          'Expected ~88 characters.\n\n' +
          '⚠️ If you entered the 44-char API Config Key, that\'s wrong.\n\n' +
          'Type *"skip"* for read-only mode.',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Try to derive the public key from private key
      try {
        const secretKey = bs58.decode(input);
        const keypair = Keypair.fromSecretKey(secretKey);
        const agentPublicKey = keypair.publicKey.toBase58();
        
        state.tempAgentPrivateKey = input;
        state.tempAgentPublicKey = agentPublicKey; // Automatically derived!
        
        // Save directly - no need for step 3
        await this.saveUserCredentials(chatId, userId, state.tempPublicKey!, input, agentPublicKey);
        userStates.delete(userId);
      } catch (error) {
        await this.bot.sendMessage(
          chatId,
          '❌ *Invalid private key format!*\n\n' +
          'Could not parse as Solana keypair.\n\n' +
          'Type *"skip"* for read-only mode.',
          { parse_mode: 'Markdown' }
        );
      }
    } else {
      // Read-only mode - save directly
      await this.saveUserCredentials(chatId, userId, state.tempPublicKey!, undefined, undefined);
      userStates.delete(userId);
    }
  }

  // Save user credentials helper
  private async saveUserCredentials(
    chatId: number, 
    userId: number, 
    accountPublicKey: string, 
    agentPrivateKey?: string,
    agentPublicKey?: string
  ): Promise<void> {
    await this.bot.sendMessage(chatId, '🔄 Saving credentials...');

    try {
      const chatMember = await this.bot.getChatMember(chatId, userId);
      
      const userData = {
        telegramId: userId,
        username: chatMember.user?.username,
        firstName: chatMember.user?.first_name,
        lastName: chatMember.user?.last_name,
      };

      await userService.saveUser(userData, { 
        accountPublicKey, 
        agentPrivateKey, 
        agentPublicKey,
        apiConfigKey: agentPublicKey // Same as agent public key
      });

      // Try to fetch and display account info
      try {
        const accountInfo = await pacificaService.getAccountInfo(userId);
        await this.bot.sendMessage(chatId, accountInfo, {
          parse_mode: 'Markdown',
          ...connectedKeyboard,
        });
      } catch (error: any) {
        const features = agentPrivateKey ? '✅ Trading enabled' : '📖 Read-only mode';
        await this.bot.sendMessage(
          chatId,
          `✅ *Wallet Connected!*\n\n` +
          `👤 Wallet: ${accountPublicKey.substring(0, 8)}...${accountPublicKey.substring(accountPublicKey.length - 8)}\n` +
          `${features}\n\n` +
          `You can now use the bot!`,
          {
            parse_mode: 'Markdown',
            ...connectedKeyboard,
          }
        );
      }
    } catch (error: any) {
      logger.error('Error saving credentials:', error);
      await this.bot.sendMessage(chatId, `❌ Error: ${error.message || 'Failed to save wallet'}`);
    }
  }
}
