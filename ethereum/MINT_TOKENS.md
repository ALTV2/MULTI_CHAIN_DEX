# Минт тестовых токенов

Скрипт для начисления тестовых токенов TKA и TKB на любой адрес.

## Быстрый старт

### 1. Показать доступные токены

```bash
npm run mint
```

Покажет:
```
📋 Available Test Tokens:
1. TestTokenA: 0x16eb4f1a13dC130074360a14ec5ee01632e87584
2. TestTokenB: 0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644
```

### 2. Минт токенов себе (deployer)

```bash
# Минт 1000 TKA себе
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 AMOUNT=1000 npm run mint

# Минт 5000 TKB себе
TOKEN_ADDRESS=0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644 AMOUNT=5000 npm run mint
```

### 3. Минт токенов другому адресу

```bash
# Минт 1000 TKA на адрес 0x742d35Cc6634C0532925a3b844Bc9e3b3aB2
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
RECIPIENT=0x742d35Cc6634C0532925a3b844Bc9e3b3aB2 \
AMOUNT=1000 \
npm run mint
```

## Параметры

| Параметр | Описание | Обязательный | По умолчанию |
|----------|----------|--------------|--------------|
| `TOKEN_ADDRESS` | Адрес контракта токена | ✅ Да | - |
| `RECIPIENT` | Адрес получателя | ❌ Нет | Deployer (из .env) |
| `AMOUNT` | Количество токенов | ❌ Нет | 1000 |

## Примеры использования

### Пример 1: Минт TKA для тестирования DEX

```bash
# Минт 10000 TKA себе для создания ордеров
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
AMOUNT=10000 \
npm run mint
```

Вывод:
```
🪙 Minting Test Tokens
=====================
Deployer: 0x7C26774eC3c296510f73abFB04E6e5892E372CF9

📝 Mint Parameters:
Token Contract: 0x16eb4f1a13dC130074360a14ec5ee01632e87584
Recipient: 0x7C26774eC3c296510f73abFB04E6e5892E372CF9
Amount: 10000 tokens

🪙 Token Info:
Name: Test Token A
Symbol: TKA
Decimals: 18

💰 Balance Before: 0.0 TKA
⏳ Minting tokens...
✅ Transaction confirmed
💰 Balance After: 10000.0 TKA
💸 Minted: 10000.0 TKA

✅ Successfully minted 10000 TKA
```

### Пример 2: Раздать токены нескольким пользователям

```bash
# Пользователь 1
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
RECIPIENT=0x7C26774eC3c296510f73abFB04E6e5892E372CF9 \
AMOUNT=5000 \
npm run mint

# Пользователь 2
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
RECIPIENT=0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199 \
AMOUNT=5000 \
npm run mint
```

### Пример 3: Минт обоих токенов

```bash
# TKA
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
AMOUNT=10000 \
npm run mint

# TKB
TOKEN_ADDRESS=0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644 \
AMOUNT=10000 \
npm run mint
```

### Пример 4: Большие суммы для liquidity

```bash
# 1 миллион TKA
TOKEN_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584 \
AMOUNT=1000000 \
npm run mint
```

## Использование с deployment-info.json

Скрипт автоматически читает адреса из `deployment-info.json`:

```bash
# Вместо полного адреса можно использовать переменные
TOKEN_A=$(node -p "require('./deployment-info.json').contracts.TestTokenA")
TOKEN_B=$(node -p "require('./deployment-info.json').contracts.TestTokenB")

# Минт TKA
TOKEN_ADDRESS=$TOKEN_A AMOUNT=1000 npm run mint

# Минт TKB
TOKEN_ADDRESS=$TOKEN_B AMOUNT=5000 npm run mint
```

## Алиасы для удобства (опционально)

Добавьте в `~/.zshrc` или `~/.bashrc`:

```bash
# Sepolia Test Tokens
export TKA_ADDRESS=0x16eb4f1a13dC130074360a14ec5ee01632e87584
export TKB_ADDRESS=0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644

# Функции для быстрого минта
mint-tka() {
  TOKEN_ADDRESS=$TKA_ADDRESS AMOUNT=${1:-1000} npm run mint
}

mint-tkb() {
  TOKEN_ADDRESS=$TKB_ADDRESS AMOUNT=${1:-1000} npm run mint
}

mint-tka-to() {
  TOKEN_ADDRESS=$TKA_ADDRESS RECIPIENT=$1 AMOUNT=${2:-1000} npm run mint
}
```

Использование:
```bash
mint-tka 5000              # Минт 5000 TKA себе
mint-tkb 10000             # Минт 10000 TKB себе
mint-tka-to 0x742d... 1000 # Минт 1000 TKA на адрес
```

## Требования

1. **Private Key**: В `.env` должен быть `PRIVATE_KEY` владельца токенов
2. **ETH для gas**: На счету deployer должно быть ETH для оплаты gas
3. **Права**: Deployer должен быть `owner` токенов

## Проверка баланса

После минта проверьте баланс:

### В MetaMask
1. Добавить токен → Custom Token
2. Вставить адрес: `0x16eb4f1a13dC130074360a14ec5ee01632e87584` (TKA)
3. Баланс появится автоматически

### Через Etherscan
```
https://sepolia.etherscan.io/token/0x16eb4f1a13dC130074360a14ec5ee01632e87584?a=ваш_адрес
```

### Через hardhat console
```bash
npx hardhat console --network sepolia

const token = await ethers.getContractAt("TestERC20", "0x16eb4f1a13dC130074360a14ec5ee01632e87584")
const balance = await token.balanceOf("0x742d35Cc6634C0532925a3b844Bc9e3b3aB2")
console.log(ethers.formatUnits(balance, 18))
```

## Troubleshooting

### Error: OwnableUnauthorizedAccount

**Причина**: Deployer не является владельцем контракта

**Решение**: Используйте private key владельца токенов (тот же, что использовался при деплое)

### Error: Invalid TOKEN_ADDRESS

**Причина**: Неправильный формат адреса

**Решение**: Проверьте адрес, должен начинаться с `0x` и содержать 40 hex символов

### Error: Insufficient funds for gas

**Причина**: Недостаточно ETH на счету для gas

**Решение**: Получите ETH с faucet:
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia

## Deployed Tokens (Sepolia)

```
TestTokenA (TKA): 0x16eb4f1a13dC130074360a14ec5ee01632e87584
TestTokenB (TKB): 0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644
```

## Etherscan Links

- **TKA**: https://sepolia.etherscan.io/token/0x16eb4f1a13dC130074360a14ec5ee01632e87584
- **TKB**: https://sepolia.etherscan.io/token/0xAc5dA2ccba32ec2EA81F9301fb89fb59edE44644
