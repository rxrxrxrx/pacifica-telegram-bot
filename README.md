# Pacifica Telegram Bot

A secure Telegram bot for trading on the Pacifica perpetual DEX. The bot provides a user-friendly interface for managing trades, positions, and account settings directly through Telegram.

## 🚀 Features

### Trading Operations
- **📈 Limit Orders** - Place limit orders with real-time price display
- **⚡ Market Orders** - Execute market orders instantly
- **❌ Cancel Orders** - Cancel orders by symbol or order ID
- **🎯 Take Profit / Stop Loss** - Set TP/SL for existing positions

### Account Management
- **📊 Account Overview** - View balances, positions, and account info
- **⚙️ Settings** - Manage leverage, view account settings
- **🔐 Secure Storage** - Encrypted private key storage

### Security Features
- **🔒 Encrypted Private Keys** - Agent wallet private keys are encrypted at rest
- **🛡️ Secure Authentication** - Uses Pacifica's agent wallet system
- **🔑 Environment Variables** - Sensitive data stored in environment variables

## 🛠️ Setup

### Prerequisites
- Node.js (LTS version)
- MongoDB database
- Telegram Bot Token
- Pacifica API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pacifica-telegram-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   MONGODB_URI=mongodb://localhost:27017/pacifica
   PACIFICA_BASE_URL=https://api.pacifica.fi/api/v1
   LOG_LEVEL=info
   ENCRYPTION_KEY=your_64_character_encryption_key
   ```

4. **Generate Encryption Key**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Use this 64-character string as your `ENCRYPTION_KEY`.

5. **Build and Run**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## 🔐 Security

### Private Key Encryption
- Agent wallet private keys are encrypted using AES-256-GCM
- Keys are encrypted when stored and decrypted only when needed for signing
- Each user's private key is encrypted with a unique initialization vector
- The encryption key is stored in environment variables

### Data Storage
- User data is stored in MongoDB with proper indexing
- Private keys are never logged or exposed in error messages
- All API communications use HTTPS

## 📱 Usage

### Initial Setup
1. Start a chat with your bot
2. Use `/start` to begin
3. Click "🔗 Connect Wallet"
4. Provide your main wallet public address
5. Provide your agent wallet private key (encrypted and stored securely)

### Trading
- **Limit Orders**: Select symbol → Choose side → Enter price → Enter amount
- **Market Orders**: Select symbol → Choose side → Enter amount
- **Cancel Orders**: View positions → Select symbol to cancel
- **TP/SL**: Select position → Choose type → Enter price(s)

### Account Management
- **Settings**: View account info, leverage, and trading status
- **Leverage**: Adjust leverage for specific trading pairs

## 🏗️ Architecture

### Project Structure
```
src/
├── config/           # Configuration management
├── models/           # Database models
├── pacifica/         # Pacifica API integrations
├── services/         # Business logic
├── telegram/         # Telegram bot handlers
└── util/             # Utilities (logger, encryption)
```

### Key Components
- **Encryption Service**: Handles private key encryption/decryption
- **Pacifica API Client**: Manages API requests and signing
- **Telegram Handlers**: Modular bot interaction handlers
- **User Service**: Manages user data and credentials

## 🔧 API Integration

The bot integrates with Pacifica's REST API:
- **Read Operations**: Account info, positions, prices (public key only)
- **Trading Operations**: Orders, TP/SL, leverage (requires agent wallet signature)
- **Real-time Data**: Market prices, account settings

## 🚨 Security Considerations

1. **Never share your encryption key**
2. **Use a strong, unique encryption key**
3. **Keep your environment variables secure**
4. **Regularly rotate your agent wallet private keys**
5. **Monitor your bot's activity and logs**

## 📝 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

### Testing
- Test files are located in the `tests/` directory
- Run API connection tests before deploying

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This bot is for educational and personal use. Trading cryptocurrencies involves risk. Use at your own discretion and never invest more than you can afford to lose.