# Руководство по деплою контрактов DEX в Polygon Amoy

## Предварительные требования

### 1. Установленное ПО
- Node.js (v16 или выше)
- npm или yarn
- MetaMask или другой Ethereum-совместимый кошелек

### 2. Получение тестовых MATIC

**Что это:** Тестовые MATIC нужны для оплаты gas fees при деплое контрактов в сети Polygon Amoy.

**Где получить:**
1. Перейдите на https://faucet.polygon.technology/
2. Выберите сеть: **Polygon Amoy**
3. Введите адрес вашего кошелька
4. Получите тестовые MATIC

**Альтернативные faucets:**
- https://www.alchemy.com/faucets/polygon-amoy (требует аккаунт Alchemy)
- https://faucet.quicknode.com/polygon/amoy

### 3. Регистрация на Alchemy

**Зачем:** Alchemy предоставляет надежный RPC endpoint для подключения к Polygon Amoy.

**Шаги:**
1. Зарегистрируйтесь на https://www.alchemy.com/
2. Нажмите "Create new app"
3. Заполните:
   - Name: Multi-Chain DEX Polygon
   - Chain: **Polygon**
   - Network: **Polygon Amoy**
4. Нажмите "Create app"
5. На странице приложения нажмите "View Key"
6. Скопируйте "HTTPS" URL (будет вида: `https://polygon-amoy.g.alchemy.com/v2/YOUR-API-KEY`)

### 4. Получение PolygonScan API ключа (опционально, но рекомендуется)

**Зачем:** Для верификации кода контрактов на PolygonScan.

**Шаги:**
1. Зарегистрируйтесь на https://polygonscan.com/
2. Перейдите в Profile → API Keys
3. Нажмите "Add" и создайте новый ключ
4. Скопируйте API ключ

**Примечание:** Один и тот же API ключ работает для mainnet и testnet (Amoy).

## Настройка проекта

### Шаг 1: Установка зависимостей

```bash
cd polygon
npm install
```

**Что устанавливается:**
- Hardhat - фреймворк для разработки
- OpenZeppelin - библиотеки контрактов
- ethers.js - библиотека для взаимодействия с блокчейном
- dotenv - для работы с переменными окружения

### Шаг 2: Настройка .env файла

**Создайте файл `.env` в папке `polygon/`:**

```bash
# Скопируйте пример
cp .env.example .env

# Откройте в редакторе
nano .env
# или
code .env
```

**Заполните следующие поля:**

```env
# Приватный ключ из MetaMask (БЕЗ префикса 0x)
PRIVATE_KEY=ваш_приватный_ключ_здесь

# URL от Alchemy для Polygon Amoy
POLYGON_AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/ваш-api-ключ

# API ключ от PolygonScan (опционально)
POLYGONSCAN_API_KEY=ваш_polygonscan_ключ
```

**⚠️ ВАЖНО:**
- Никогда не коммитьте .env файл в git!
- Файл .env уже добавлен в .gitignore

**Как получить приватный ключ из MetaMask:**
1. Откройте MetaMask
2. Нажмите на три точки (⋮) → Account details
3. Нажмите "Show private key"
4. Введите пароль MetaMask
5. Скопируйте ключ БЕЗ префикса "0x"

### Шаг 3: Добавление сети Polygon Amoy в MetaMask

**Параметры сети:**
- **Network Name:** Polygon Amoy Testnet
- **RPC URL:** https://rpc-amoy.polygon.technology (или ваш Alchemy URL)
- **Chain ID:** 80002
- **Currency Symbol:** MATIC
- **Block Explorer:** https://amoy.polygonscan.com

**Автоматическое добавление:**
Посетите https://chainlist.org/?testnets=true&search=amoy и нажмите "Add to MetaMask"

### Шаг 4: Проверка конфигурации

**Проверьте настройки Hardhat:**

```bash
cat hardhat.config.js
```

**Должны быть настроены:**
- ✅ polygonAmoy network с вашим RPC URL
- ✅ PolygonScan API для верификации
- ✅ Оптимизация Solidity компилятора

### Шаг 5: Компиляция контрактов

**Скомпилируйте контракты:**

```bash
npm run compile
```

**Что происходит:**
- Solidity код компилируется в bytecode
- Генерируются ABI (Application Binary Interface)
- Проверяются ошибки компиляции

**Ожидаемый результат:**
```
Compiled 7 Solidity files successfully
```

### Шаг 6: Запуск тестов (опционально, но рекомендуется)

**Проверьте работоспособность контрактов:**

```bash
npm test
```

**Ожидаемый результат:**
```
47 passing
```

## Деплой контрактов

### Шаг 7: Проверка баланса

**Проверьте баланс перед деплоем:**

```bash
npx hardhat run scripts/check-balance.js --network polygonAmoy
```

**Минимальный баланс:** ~0.5 MATIC (рекомендуется 1 MATIC)

### Шаг 8: Деплой контрактов

**Запустите скрипт деплоя:**

```bash
npx hardhat run scripts/deploy.js --network polygonAmoy
```

**Что происходит:**
1. ✅ Деплой TokenManager
2. ✅ Деплой OrderBook
3. ✅ Деплой Trade
4. ✅ Настройка Trade в OrderBook
5. ✅ Деплой HTLC
6. ✅ Деплой CrossChainOrderBook
7. ✅ Добавление Ethereum Sepolia как поддерживаемой сети
8. ✅ Деплой тестовых токенов (pTKA, pTKB)

**Время деплоя:** 3-5 минут

**Ожидаемый вывод:**
```
Starting deployment to Polygon network...
Network: polygonAmoy
Chain ID: 80002

Deployer address: 0x1234...
Deployer balance: 1.0 MATIC

1. Deploying TokenManager...
TokenManager deployed to: 0xABC...

2. Deploying OrderBook...
OrderBook deployed to: 0xDEF...

3. Deploying Trade...
Trade deployed to: 0x123...

4. Setting Trade contract in OrderBook...
Trade contract set in OrderBook

5. Deploying HTLC...
HTLC deployed to: 0x456...

6. Deploying CrossChainOrderBook...
CrossChainOrderBook deployed to: 0x789...

7. Adding Ethereum Sepolia as supported chain...
Ethereum Sepolia added as supported chain

8. Deploying test tokens...
TestTokenA deployed to: 0xAAA...
TestTokenB deployed to: 0xBBB...

Deployment info saved to deployment-info.json

========== DEPLOYMENT SUMMARY ==========
TokenManager: 0xABC...
OrderBook: 0xDEF...
Trade: 0x123...
HTLC: 0x456...
CrossChainOrderBook: 0x789...
TestTokenA: 0xAAA...
TestTokenB: 0xBBB...
=========================================
```

### Шаг 9: Сохранение адресов контрактов

**Адреса сохраняются в файл `deployment-info.json`:**

```json
{
  "network": "polygonAmoy",
  "chainId": 80002,
  "deployer": "0x...",
  "contracts": {
    "TokenManager": "0x...",
    "OrderBook": "0x...",
    "Trade": "0x...",
    "HTLC": "0x...",
    "CrossChainOrderBook": "0x...",
    "TestTokenA": "0x...",
    "TestTokenB": "0x..."
  },
  "deployedAt": "2026-01-15T..."
}
```

**⚠️ ВАЖНО:** Сохраните этот файл! В нем адреса ваших контрактов.

## Верификация контрактов на PolygonScan

### Шаг 10: Верификация кода

**Зачем:** Чтобы пользователи могли видеть исходный код на PolygonScan.

**Команды для верификации:**

```bash
# Замените адреса на ваши из deployment-info.json

# 1. TokenManager
npx hardhat verify --network polygonAmoy <TokenManager_ADDRESS> <DEPLOYER_ADDRESS>

# 2. OrderBook
npx hardhat verify --network polygonAmoy <OrderBook_ADDRESS> <TokenManager_ADDRESS>

# 3. Trade
npx hardhat verify --network polygonAmoy <Trade_ADDRESS> <OrderBook_ADDRESS>

# 4. HTLC (без аргументов)
npx hardhat verify --network polygonAmoy <HTLC_ADDRESS>

# 5. CrossChainOrderBook (без аргументов)
npx hardhat verify --network polygonAmoy <CrossChainOrderBook_ADDRESS>

# 6. Test Token A
npx hardhat verify --network polygonAmoy <TestTokenA_ADDRESS> "Test Token A Polygon" "pTKA" 18

# 7. Test Token B
npx hardhat verify --network polygonAmoy <TestTokenB_ADDRESS> "Test Token B Polygon" "pTKB" 18
```

**Пример:**
```bash
npx hardhat verify --network polygonAmoy 0x1234... 0x5678...
```

**Ожидаемый результат:**
```
Successfully verified contract on Etherscan.
https://amoy.polygonscan.com/address/0x1234...#code
```

## Проверка деплоя

### Шаг 11: Проверка на PolygonScan

1. Откройте https://amoy.polygonscan.com/
2. Вставьте адрес контракта из deployment-info.json
3. Проверьте:
   - ✅ Contract creation успешен
   - ✅ Код верифицирован (зеленая галочка)
   - ✅ Правильный баланс контракта

### Шаг 12: Проверка взаимодействия контрактов

**Проверьте связи:**

```bash
npx hardhat run scripts/verify-deployment.js --network polygonAmoy
```

**Что проверяется:**
- ✅ OrderBook знает о TokenManager
- ✅ OrderBook знает о Trade контракте
- ✅ Trade знает об OrderBook
- ✅ CrossChainOrderBook поддерживает Ethereum Sepolia (chainId: 11155111)

## Взаимодействие с контрактами

### Пример: Создание cross-chain ордера через PolygonScan

1. Откройте CrossChainOrderBook контракт на amoy.polygonscan.com
2. Перейдите на вкладку "Write Contract"
3. Нажмите "Connect to Web3" (подключите MetaMask)
4. Найдите функцию `createOrder`
5. Заполните параметры:
   - `_targetChainId`: 11155111 (Ethereum Sepolia)
   - `_sourceToken`: адрес pTKA
   - `_targetToken`: адрес токена на Ethereum
   - `_sourceAmount`: количество (в wei)
   - `_minTargetAmount`: минимальное количество
   - `_timelock`: время блокировки (рекомендуется 3600 - 1 час)
6. Нажмите "Write" и подтвердите транзакцию

### Пример: Создание HTLC

1. Откройте HTLC контракт на amoy.polygonscan.com
2. Перейдите на "Write Contract"
3. Подключите кошелек
4. Функция `createSwap`:
   - `_recipient`: адрес получателя
   - `_token`: адрес токена (или 0x0 для MATIC)
   - `_amount`: количество
   - `_hashlock`: keccak256 хеш секрета
   - `_timelock`: timestamp истечения
5. Нажмите "Write"

### Пример: Минт тестовых токенов

1. Откройте Test Token A (pTKA) на PolygonScan
2. Перейдите на "Write Contract"
3. Подключите кошелек
4. Функция `mint`:
   - `to`: ваш адрес
   - `amount`: 1000000000000000000000 (1000 токенов)
5. Нажмите "Write"

## Troubleshooting (Решение проблем)

### Ошибка: "insufficient funds"

**Проблема:** Недостаточно MATIC на кошельке.

**Решение:**
1. Получите больше тестовых MATIC с faucet
2. Проверьте баланс: `npx hardhat run scripts/check-balance.js --network polygonAmoy`

### Ошибка: "nonce too high"

**Проблема:** Нарушена последовательность транзакций.

**Решение:**
1. Откройте MetaMask
2. Settings → Advanced → Clear activity tab data
3. Повторите деплой

### Ошибка: "invalid API key"

**Проблема:** Неверный Alchemy или PolygonScan API ключ.

**Решение:**
1. Проверьте .env файл
2. Убедитесь что ключи скопированы полностью
3. Проверьте отсутствие пробелов

### Контракт задеплоился, но не верифицируется

**Решение:**
1. Подождите 1-2 минуты после деплоя
2. Проверьте версию Solidity в hardhat.config.js (должна быть 0.8.20)
3. Убедитесь что передали правильные constructor аргументы
4. Проверьте что используете правильную сеть (polygonAmoy)

### Ошибка: "replacement transaction underpriced"

**Проблема:** Gas price слишком низкий для замены pending транзакции.

**Решение:**
1. Подождите пока pending транзакция подтвердится
2. Или увеличьте газ в hardhat.config.js:
```javascript
polygonAmoy: {
  gasPrice: 50000000000 // 50 gwei вместо 30
}
```

## Полезные ссылки

- Hardhat документация: https://hardhat.org/docs
- Polygon Amoy PolygonScan: https://amoy.polygonscan.com/
- Polygon Faucet: https://faucet.polygon.technology/
- Alchemy: https://www.alchemy.com/
- OpenZeppelin: https://docs.openzeppelin.com/
- Chainlist (добавление сетей): https://chainlist.org/

## Стоимость деплоя (примерная)

| Контракт              | Gas Used  | Примерная стоимость (gwei=30) |
|-----------------------|-----------|------------------------------|
| TokenManager          | ~250,000  | ~0.0075 MATIC               |
| OrderBook             | ~750,000  | ~0.0225 MATIC               |
| Trade                 | ~500,000  | ~0.0150 MATIC               |
| HTLC                  | ~800,000  | ~0.0240 MATIC               |
| CrossChainOrderBook   | ~1,200,000| ~0.0360 MATIC               |
| TestERC20 (x2)        | ~400,000  | ~0.0120 MATIC               |
| **ИТОГО**             | ~3,900,000| **~0.12 MATIC**             |

**Рекомендуемый баланс:** 0.5-1 MATIC (с запасом)

## Сравнение с Ethereum Sepolia

| Параметр          | Ethereum Sepolia | Polygon Amoy |
|-------------------|------------------|--------------|
| Chain ID          | 11155111         | 80002        |
| Валюта            | ETH              | MATIC        |
| Gas Price         | ~20 gwei         | ~30 gwei     |
| Explorer          | sepolia.etherscan.io | amoy.polygonscan.com |
| Faucet            | sepoliafaucet.com | faucet.polygon.technology |
| HTLC контракт     | Нет              | Да           |
| CrossChainOrderBook| Нет             | Да           |

## Cross-Chain интеграция

После деплоя на обеих сетях (Ethereum Sepolia и Polygon Amoy):

1. **На Polygon Amoy:** CrossChainOrderBook уже настроен для поддержки Ethereum Sepolia (chainId: 11155111)

2. **На Ethereum Sepolia:** Добавьте HTLC контракт и настройте поддержку Polygon Amoy:
```javascript
// В deploy скрипте Ethereum
const htlc = await HTLC.deploy();
await crossChainOrderBook.addSupportedChain(80002); // Polygon Amoy
```

3. **Backend координация:** Используйте backend сервис для мониторинга событий на обеих сетях и автоматического выполнения cross-chain свопов.

## Готово!

Ваши контракты задеплоены и готовы к использованию в тестовой сети Polygon Amoy!

Следующие шаги:
1. Задеплоить контракты в Ethereum Sepolia (если еще не сделано)
2. Настроить backend для мониторинга событий
3. Протестировать cross-chain свопы между сетями
