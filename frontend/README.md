# Multi-Chain DEX Frontend

Modern, minimalist decentralized exchange (DEX) frontend built with Next.js 14, featuring order book-based trading.

## Features

- 🎨 **Modern UI** - Clean, minimalist design with dark/light theme support
- 💼 **Multi-Wallet Support** - MetaMask, WalletConnect, Coinbase Wallet, and more via RainbowKit
- 📊 **Order Book Trading** - Create, execute, and cancel limit orders
- ⚡ **Real-time Updates** - Live order book with WebSocket events
- 🔄 **Token Approval Flow** - Automatic ERC20 token approval handling
- 📱 **Responsive Design** - Mobile-first, works on all devices
- 🌐 **Multi-Chain Ready** - Architecture supports multiple blockchains (currently Sepolia)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Web3**: wagmi v2 + viem
- **Wallet**: RainbowKit
- **State Management**: Zustand + TanStack Query
- **Animations**: Framer Motion
- **UI Components**: Radix UI
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+ 
- MetaMask or another Web3 wallet
- Sepolia testnet ETH (from faucet)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys
```

### Environment Variables

Create `.env.local` file:

```env
# WalletConnect Project ID (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Alchemy RPC URL for Sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Or use public RPC (less reliable)
# NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

### Development

```bash
# Run development server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── trade/page.tsx     # Trading page
│   └── orders/page.tsx    # My Orders
│
├── components/
│   ├── ui/                # Base UI components
│   ├── layout/            # Header, Navigation
│   ├── wallet/            # Wallet components  
│   ├── orderbook/         # Order book components
│   ├── trade/             # Trading components
│   └── orders/            # Orders components
│
├── hooks/                 # Custom React hooks
│   ├── useOrderBook.ts    # Fetch all orders
│   ├── useCreateOrder.ts  # Create order
│   ├── useExecuteOrder.ts # Execute order
│   └── useCancelOrder.ts  # Cancel order
│
├── lib/
│   ├── contracts/         # ABIs, addresses, wagmi config
│   ├── constants/         # Tokens, chains
│   ├── utils/             # Utilities
│   └── providers/         # React providers
│
└── types/                 # TypeScript types
```

## Usage

### 1. Connect Wallet

Click "Connect Wallet" in the header and select your wallet.

### 2. Get Testnet ETH

Visit Sepolia faucets:
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

### 3. Create an Order

1. Go to "Trade" page
2. Select token to sell (ETH/TKA/TKB)
3. Enter amount to sell
4. Select token to buy
5. Enter amount you want to receive
6. Click "Approve" if selling ERC20 token
7. Click "Create Order"
8. Confirm transaction in wallet

### 4. Execute an Order

1. Browse order book on "Trade" page
2. Find an order you want to take
3. Click "Execute" on the order
4. Approve tokens if needed
5. Confirm transaction

### 5. Cancel Your Order

1. Go to "My Orders" page
2. Find your active order
3. Click "Cancel"
4. Confirm transaction

## Deployed Contracts (Sepolia)

```
OrderBook:    0x96c763c1Cb33e5be34c20980570Fe1614F3df05e
Trade:        0x125B8201BFB93337b298Dc650F9729a2aa7E2061
TokenManager: 0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5
TestTokenA:   0x16eb4f1a13dC130074360a14ec5ee01632e87584
TestTokenB:   0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644
```

## Features in Detail

### Token Approval

The app automatically detects when ERC20 token approval is needed:
- Shows "Approve" button before "Create Order" or "Execute"
- Checks current allowance
- Requests approval for exact amount needed
- Shows loading state during approval

### Real-time Order Book

- Automatically updates when orders are created, executed, or cancelled
- Uses WebSocket events from blockchain
- Filters by token pair
- Shows exchange rates

### Dark/Light Theme

- Toggle in header
- Syncs with system preference
- Persists in localStorage
- Smooth transitions

## Customization

### Adding New Tokens

Edit `lib/constants/tokens.ts`:

```typescript
{
  address: '0xYourTokenAddress',
  symbol: 'TKC',
  name: 'Test Token C',
  decimals: 18,
  logoURI: '/tokens/tkc.svg',
}
```

### Adding New Chains

1. Update `lib/contracts/config.ts` - add chain to wagmi config
2. Update `lib/contracts/addresses.ts` - add contract addresses for new chain
3. Update `lib/constants/tokens.ts` - add tokens for new chain

## Troubleshooting

### "Network not supported"

Make sure MetaMask is connected to Sepolia testnet.

### "Insufficient balance"

Get testnet ETH from faucets or mint test tokens.

### Transactions failing

- Check gas prices
- Ensure you have enough ETH for gas
- Try increasing gas limit

### Orders not showing

- Check network connection
- Refresh the page
- Ensure you're on correct network

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
