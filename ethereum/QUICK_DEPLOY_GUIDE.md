# 🚀 Быстрый старт: Деплой в Sepolia

## Подготовка (5-10 минут)

### 1. Получите тестовые ETH
```
https://sepoliafaucet.com/
Введите адрес кошелька → Получите 0.5 ETH
```

### 2. Получите Alchemy API ключ
```
1. Регистрация: https://www.alchemy.com/
2. Create new app → Ethereum → Sepolia
3. Copy HTTPS URL
```

### 3. Настройте .env
```bash
cd ethereum
cp .env.example .env
nano .env
```

Заполните:
```env
PRIVATE_KEY=ваш_приватный_ключ_без_0x
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
ETHERSCAN_API_KEY=ваш_ключ_с_etherscan  # опционально
```

## Деплой (2-3 минуты)

### 1. Проверьте баланс
```bash
npm run check-balance
```

Должно быть: ≥ 0.05 ETH (рекомендуется 0.1 ETH)

### 2. Скомпилируйте контракты
```bash
npm run compile
```

Результат: `Compiled 4 Solidity files successfully`

### 3. Запустите деплой
```bash
npm run deploy:sepolia
```

**Время:** ~3-5 минут
**Стоимость:** ~0.04 ETH

### 4. Проверьте результат
```bash
npm run verify-deployment
```

Результат: все ✅ означает успех!

## Верификация (по желанию)

Скопируйте адреса из `deployment-info.json` и выполните:

```bash
npx hardhat verify --network sepolia <ADDR_TokenManager> <ADDR_Deployer>
npx hardhat verify --network sepolia <ADDR_OrderBook> <ADDR_TokenManager>
npx hardhat verify --network sepolia <ADDR_Trade> <ADDR_OrderBook>
npx hardhat verify --network sepolia <ADDR_TokenA> "Test Token A" "TKA"
npx hardhat verify --network sepolia <ADDR_TokenB> "Test Token B" "TKB"
```

## Готово! 🎉

Адреса контрактов сохранены в `deployment-info.json`

Просмотр на Etherscan:
```
https://sepolia.etherscan.io/address/<ВАШ_АДРЕС>
```

## Если что-то пошло не так

### Ошибка: "insufficient funds"
```bash
# Получите больше ETH с faucet
https://sepoliafaucet.com/
```

### Ошибка: "nonce too high"
```
MetaMask → Settings → Advanced → Clear activity tab data
```

### Ошибка: "invalid API key"
```bash
# Проверьте .env файл
cat .env
```

## Полное руководство

Для подробной информации смотрите: `DEPLOYMENT_GUIDE.md`
