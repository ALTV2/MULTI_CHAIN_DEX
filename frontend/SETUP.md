# Настройка DEX Frontend

## Автоматическая конфигурация

Фронтенд автоматически использует настройки из `ethereum/.env`:

- **SEPOLIA_RPC_URL** → Автоматически читается при запуске
- **Браузерные кошельки** → Работают без дополнительных настроек
- **WalletConnect** → Опциональный, только для мобильных кошельков

## Шаг 1: Установка зависимостей

```bash
cd frontend
npm install --legacy-peer-deps
```

## Шаг 2: Environment Variables (опционально)

### Вариант А: Стандартная настройка (рекомендуется)

Ничего не нужно настраивать! Просто запускайте:

```bash
npm run dev
```

Фронтенд автоматически:
1. Прочитает `SEPOLIA_RPC_URL` из `../ethereum/.env`
2. Подключит MetaMask и другие браузерные кошельки
3. Откроется на http://localhost:3000

### Вариант Б: С поддержкой WalletConnect

Для мобильных кошельков (Trust Wallet, Rainbow и др.):

#### 1. Получить WalletConnect Project ID

1. Зайти на https://cloud.walletconnect.com/
2. Sign Up (бесплатно)
3. Create New Project:
   - Name: `Multi-Chain DEX`
   - Type: `App`
4. Скопировать **Project ID**

#### 2. Создать .env.local

```bash
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=ваш_project_id_здесь
ENVEOF
```

### Вариант В: Переопределить RPC URL

Если хотите использовать другой RPC (не из ethereum/.env):

```bash
cat > .env.local << 'ENVEOF'
# Переопределить RPC URL
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ваш-custom-rpc-url

# Опционально: WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=ваш_id
ENVEOF
```

## Шаг 3: Запуск

```bash
# Development сервер
npm run dev

# Production build
npm run build
npm start
```

Откроется на: **http://localhost:3000**

## Шаг 4: Подключение кошелька

### MetaMask (рекомендуется)

1. **Установить MetaMask**:
   - Chrome: https://metamask.io/
   - Или использовать уже установленный

2. **Добавить Sepolia Testnet**:
   
   Если Sepolia нет в списке сетей:
   
   ```
   MetaMask → Settings → Networks → Add Network → Add network manually
   
   Network Name: Sepolia
   RPC URL: https://rpc.sepolia.org
   Chain ID: 11155111
   Currency Symbol: ETH
   Block Explorer: https://sepolia.etherscan.io
   ```

3. **Переключиться на Sepolia**:
   
   MetaMask → Верхний dropdown → Sepolia

4. **Получить тестовые ETH**:
   
   - https://sepoliafaucet.com/
   - https://www.alchemy.com/faucets/ethereum-sepolia
   - https://sepolia-faucet.pk910.de/

5. **Подключить на сайте**:
   
   Нажать "Connect Wallet" → Выбрать MetaMask → Approve

### Другие кошельки

#### Coinbase Wallet
- Установить расширение
- Переключить на Sepolia
- Подключить через "Connect Wallet"

#### Brave Wallet
- Встроенный в Brave браузер
- Переключить на Sepolia
- Подключить через "Connect Wallet"

#### WalletConnect (мобильные)
Требует настроенный `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`:
- Trust Wallet
- Rainbow
- Argent
- Zerion
- и другие

## Проверка настройки

### 1. Проверить RPC подключение

```bash
# В терминале при запуске dev сервера увидите:
> ready started server on 0.0.0.0:3000, url: http://localhost:3000
> Using Sepolia RPC: https://eth-sepolia.g.alchemy.com/v2/...
```

### 2. Проверить доступные кошельки

Нажмите "Connect Wallet" на сайте - увидите список:

**Без WalletConnect ID**:
- MetaMask
- Coinbase Wallet
- Injected (браузерные кошельки)

**С WalletConnect ID**:
- Все вышеперечисленные +
- WalletConnect (QR код для мобильных)

### 3. Проверить подключение к контрактам

После подключения кошелька:
1. Перейти на "Trade"
2. Должен загрузиться Order Book
3. Если ордеров нет - покажет "No active orders"

## Troubleshooting

### "Module not found" при npm install

```bash
# Очистить и переустановить
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### "Could not read SEPOLIA_RPC_URL from ethereum/.env"

**Проблема**: Файл ethereum/.env не найден или переменная не установлена

**Решение**:
```bash
# Проверить что файл существует
ls ../ethereum/.env

# Проверить содержимое
cat ../ethereum/.env | grep SEPOLIA_RPC_URL

# Если нет - создать:
cd ../ethereum
echo "SEPOLIA_RPC_URL=https://rpc.sepolia.org" >> .env
cd ../frontend
```

### "Network not supported" в MetaMask

**Решение**: Переключить MetaMask на Sepolia testnet

### WalletConnect не появляется в списке

**Причина**: Не установлен `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

**Решение**: Либо добавить Project ID, либо использовать MetaMask/другие браузерные кошельки

### Транзакции не проходят

1. **Проверить баланс ETH**: Должно быть минимум 0.01 ETH для gas
2. **Получить больше ETH**: Использовать faucets
3. **Проверить сеть**: Убедиться что MetaMask на Sepolia
4. **Увеличить gas**: В MetaMask → Advanced → Increase gas limit

### Order Book пустой

Это нормально если никто еще не создавал ордера! Создайте первый:
1. Trade page
2. Sell ETH → Buy TKA
3. Create Order

### Приложение не подключается к контрактам

**Проверить адреса контрактов**:
```bash
cat lib/contracts/addresses.ts
```

Должны совпадать с адресами из `../ethereum/deployment-info.json`

## Deployed Contracts (Sepolia)

```
OrderBook:    0x96c763c1Cb33e5be34c20980570Fe1614F3df05e
Trade:        0x125B8201BFB93337b298Dc650F9729a2aa7E2061
TokenManager: 0x7cDA5b87638d483F9621E658Cd8d5873bE698eb5
TestTokenA:   0x16eb4f1a13dC130074360a14ec5ee01632e87584
TestTokenB:   0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644
```

Проверить на Etherscan:
- https://sepolia.etherscan.io/address/0x96c763c1Cb33e5be34c20980570Fe1614F3df05e

## Production Deployment

### Vercel (Рекомендуется)

1. **Push на GitHub**:
```bash
git add .
git commit -m "Add DEX frontend"
git push
```

2. **Deploy на Vercel**:
   - Зайти на https://vercel.com/
   - Import repository
   - Vercel автоматически определит Next.js
   - Root Directory: `frontend`

3. **Добавить Environment Variables** в Vercel:
   ```
   NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id (опционально)
   ```

4. **Deploy!**

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --production --legacy-peer-deps
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build
docker build -t dex-frontend .

# Run
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SEPOLIA_RPC_URL=https://... \
  dex-frontend
```

## Полезные ссылки

- **MetaMask**: https://metamask.io/
- **WalletConnect Cloud**: https://cloud.walletconnect.com/
- **Sepolia Faucets**:
  - https://sepoliafaucet.com/
  - https://www.alchemy.com/faucets/ethereum-sepolia
  - https://sepolia-faucet.pk910.de/
- **Sepolia Explorer**: https://sepolia.etherscan.io/
- **Alchemy Dashboard**: https://dashboard.alchemy.com/
