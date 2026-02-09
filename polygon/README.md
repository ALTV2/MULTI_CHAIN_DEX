# Multi-Chain DEX - Polygon Contracts

Смарт-контракты для децентрализованной биржи (DEX) с поддержкой cross-chain свопов на Polygon.

## 📁 Структура проекта

```
polygon/
├── contracts/
│   ├── core/              # Основные контракты DEX
│   │   ├── TokenManager.sol
│   │   ├── OrderBook.sol
│   │   └── Trade.sol
│   ├── htlc/              # Cross-chain контракты
│   │   ├── HTLC.sol
│   │   └── CrossChainOrderBook.sol
│   ├── interfaces/        # Интерфейсы контрактов
│   └── tokens/            # Тестовые токены
│       └── TestERC20.sol
├── scripts/               # Скрипты деплоя и утилиты
│   ├── deploy.js
│   ├── deploy-htlc.js
│   ├── check-balance.js
│   └── verify-deployment.js
├── test/                  # Тесты контрактов
│   ├── OrderBook.test.js
│   └── CrossChainOrderBook.test.js
└── DEPLOYMENT_GUIDE.md    # Подробное руководство по деплою
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

Скопируйте и настройте файл `.env`:

```bash
cp .env.example .env
```

Заполните следующие поля:
- `PRIVATE_KEY` - приватный ключ из MetaMask (без 0x)
- `POLYGON_AMOY_RPC_URL` - Alchemy URL для Polygon Amoy
- `POLYGONSCAN_API_KEY` - API ключ от PolygonScan

### 3. Компиляция контрактов

```bash
npm run compile
```

### 4. Запуск тестов

```bash
npm test
```

Ожидаемый результат: **47 passing**

### 5. Проверка баланса

```bash
npm run check-balance
```

Убедитесь что на кошельке есть минимум **0.5 MATIC** (рекомендуется 1 MATIC).

### 6. Деплой в Polygon Amoy

```bash
npm run deploy:amoy
```

### 7. Проверка деплоя

```bash
npm run verify-deployment
```

## 📚 Документация

Подробная документация по деплою доступна в файле [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## 🛠 Доступные команды

### Компиляция и тестирование

```bash
npm run compile          # Компилировать контракты
npm test                 # Запустить тесты
npm run test:coverage    # Запустить тесты с coverage
npm run clean            # Очистить артефакты компиляции
```

### Деплой

```bash
npm run deploy:local     # Деплой в локальную сеть
npm run deploy:amoy      # Деплой в Polygon Amoy testnet
npm run deploy:polygon   # Деплой в Polygon mainnet
npm run deploy:htlc:amoy # Деплой только HTLC контрактов
```

### Утилиты

```bash
npm run check-balance       # Проверить баланс deployer кошелька
npm run verify-deployment   # Проверить корректность деплоя
npm run verify:amoy         # Верификация на PolygonScan
npm run node                # Запустить локальную Hardhat ноду
```

## 🔐 Основные контракты

### Core DEX Contracts

#### TokenManager
Управление токенами на платформе.
- Добавление/удаление поддерживаемых токенов
- Валидация токенов

#### OrderBook
Книга ордеров для размещения заявок на обмен.
- Создание limit ордеров
- Отмена ордеров
- Получение списка активных ордеров

#### Trade
Исполнение сделок между пользователями.
- Матчинг ордеров
- Обмен токенами
- Расчеты по сделкам

### Cross-Chain Contracts

#### HTLC (Hash Time-Locked Contract)
Атомарные свопы между разными блокчейнами.
- Создание HTLC контракта с хеш-локом
- Withdraw с секретом
- Refund после истечения времени

#### CrossChainOrderBook
Книга ордеров для cross-chain обменов.
- Создание cross-chain ордеров
- Поддержка нескольких сетей
- Координация свопов между сетями

## 🌐 Сети

### Polygon Amoy Testnet (рекомендуется)
- **Chain ID:** 80002
- **RPC URL:** https://rpc-amoy.polygon.technology
- **Explorer:** https://amoy.polygonscan.com
- **Faucet:** https://faucet.polygon.technology

### Polygon Mainnet
- **Chain ID:** 137
- **RPC URL:** https://polygon-rpc.com
- **Explorer:** https://polygonscan.com

## 🔗 Cross-Chain интеграция

Контракты на Polygon Amoy поддерживают взаимодействие с:
- **Ethereum Sepolia** (chainId: 11155111)

Для полноценной работы cross-chain свопов необходимо:
1. Задеплоить контракты на обеих сетях
2. Настроить backend для мониторинга событий
3. Координировать выполнение HTLC между сетями

## 📊 Стоимость деплоя

Примерная стоимость деплоя всех контрактов в Polygon Amoy (при gas price = 30 gwei):

| Контракт | Gas Used | Стоимость |
|----------|----------|-----------|
| TokenManager | ~250,000 | ~0.0075 MATIC |
| OrderBook | ~750,000 | ~0.0225 MATIC |
| Trade | ~500,000 | ~0.0150 MATIC |
| HTLC | ~800,000 | ~0.0240 MATIC |
| CrossChainOrderBook | ~1,200,000 | ~0.0360 MATIC |
| TestERC20 (x2) | ~400,000 | ~0.0120 MATIC |
| **ИТОГО** | **~3,900,000** | **~0.12 MATIC** |

## ✅ Тесты

Проект включает 47 тестов, покрывающих:

### OrderBook Tests (10 тестов)
- Деплой контрактов
- Создание ордеров
- Получение списка ордеров
- Отмена ордеров

### CrossChainOrderBook Tests (37 тестов)
- Деплой и инициализация
- Управление поддерживаемыми сетями
- Создание cross-chain ордеров
- Матчинг ордеров
- Завершение cross-chain свопов
- Отмена и реактивация ордеров
- View функции

Запуск тестов:
```bash
npm test
```

## 🔧 Troubleshooting

### Ошибка: "insufficient funds"
Получите тестовые MATIC с faucet:
- https://faucet.polygon.technology/
- https://www.alchemy.com/faucets/polygon-amoy

### Ошибка: "nonce too high"
Очистите историю транзакций в MetaMask:
Settings → Advanced → Clear activity tab data

### Ошибка при верификации
- Подождите 1-2 минуты после деплоя
- Проверьте POLYGONSCAN_API_KEY в .env
- Убедитесь что передали правильные constructor аргументы

## 📞 Полезные ссылки

- [Hardhat Documentation](https://hardhat.org/docs)
- [Polygon Documentation](https://docs.polygon.technology/)
- [Polygon Amoy PolygonScan](https://amoy.polygonscan.com/)
- [Polygon Faucet](https://faucet.polygon.technology/)
- [Alchemy](https://www.alchemy.com/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/)

## 📝 Лицензия

MIT
