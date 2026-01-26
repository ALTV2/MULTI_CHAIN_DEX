# Автоматическая конфигурация

## Что изменилось

Фронтенд теперь **автоматически** настраивается без создания `.env.local`!

### Автоматически

1. **RPC URL** - Читается из `ethereum/.env` (переменная `SEPOLIA_RPC_URL`)
2. **MetaMask** - Работает сразу
3. **Браузерные кошельки** - Coinbase, Brave и др. - работают из коробки

### Опционально

**WalletConnect** - Только для мобильных кошельков (Trust Wallet, Rainbow и др.)

## Быстрый старт

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Всё! Больше ничего настраивать не нужно!

## Доступные кошельки

### Всегда доступны (без настройки)
- MetaMask
- Coinbase Wallet
- Brave Wallet
- Trust Wallet (если установлен как расширение)
- Любые браузерные Web3 кошельки

### С WalletConnect ID
Все вышеперечисленные + мобильные кошельки через QR код

## Приоритет конфигурации

1. NEXT_PUBLIC_SEPOLIA_RPC_URL в .env.local (если есть)
2. SEPOLIA_RPC_URL из ../ethereum/.env
3. Fallback: https://rpc.sepolia.org
