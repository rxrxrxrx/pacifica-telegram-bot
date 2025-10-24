# Pacifica Telegram Bot

A Telegram bot for interacting with the Pacifica perpetual DEX API. Connect your trading account, check balances, and manage your positions directly from Telegram.

## Features

- 🔐 Secure API key storage in MongoDB
- 📊 Real-time account information and balances
- 🔄 Easy API credential management
- 🤖 Intuitive Telegram interface with inline buttons
- ✅ API credential verification
- 🔒 Secure request signing for authenticated endpoints

## Tech Stack

- **Node.js** (v18+ LTS)
- **TypeScript** for type safety
- **node-telegram-bot-api** for Telegram integration
- **MongoDB** with Mongoose for data persistence
- **Axios** for HTTP requests
- **Pacifica API** integration with signing support

## Installation

1. **Clone or create the project:**
   ```bash
   cd pacifica-telegram-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/pacifica-bot
   
   # Pacifica API Configuration
   PACIFICA_BASE_URL=https://api.pacifica.fi/api/v1
   # For testnet: https://testnet-api.pacifica.fi/api/v1
   
   # Optional: Logging level (debug, info, warn, error)
   LOG_LEVEL=info
   ```

4. **Build the TypeScript code:**
   ```bash
   npm run build
   ```

## Usage

### Development Mode

Run with automatic TypeScript compilation:

```bash
npm run dev
```

### Production Mode

Build and run the compiled JavaScript:

```bash
npm run build
npm start
```

### Watch Mode

Automatically rebuild on file changes:

```bash
npm run watch
```

## How to Use the Bot

1. **Start the bot** on Telegram by sending `/start` to your bot

2. **Connect your API:**
   - Click the "🔗 Connect API" button
   - Send your Pacifica API key when prompted
   - Optionally provide API secret for signing (or type "skip")

3. **View your account:**
   - Click "📊 Show Account" to see your balances and account info
   - Or use the `/account` command

4. **Get help:**
   - Click "❓ Help" or use `/help` command

### Available Commands

- `/start` - Start the bot and show main menu
- `/connect` - Connect or reconnect your Pacifica API
- `/account` - View your account information
- `/help` - Display help information

## API Integration

The bot integrates with Pacifica's REST API and includes:

- **Public endpoints:** Markets, server time
- **Authenticated endpoints:** Account info, balances, orders limit
- **Signed requests:** Order placement and management (with API secret)

### Pacifica API Documentation

- Main API: [docs.pacifica.fi](https://docs.pacifica.fi)
- REST API: `https://api.pacifica.fi/api/v1`
- Testnet API: `https://testnet-api.pacifica.fi/api/v1`

## Security Considerations

- ✅ API keys are stored in MongoDB (consider encryption for production)
- ✅ Keys are never logged to console
- ✅ Environment variables for sensitive configuration
- ✅ Request signing with HMAC-SHA256 for authenticated operations
- ⚠️ **Future improvement:** Implement API key encryption at rest
rmination


## License

MIT License - feel free to use and modify as needed.

## Support

For issues or questions:

- Check the Pacifica API documentation
- Review bot logs for error messages
- Open an issue in the 
- DM me on Telegram: @roros_silk


---

Built by roro$ with ❤️ for the Pacifica community

