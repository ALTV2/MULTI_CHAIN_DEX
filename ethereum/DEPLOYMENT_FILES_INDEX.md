# 📁 Индекс файлов для деплоя

## Документация

| Файл | Описание | Время чтения | Для кого |
|------|----------|--------------|----------|
| **[START_HERE.md](START_HERE.md)** | Главная точка входа | 2 мин | Все |
| **[QUICK_DEPLOY_GUIDE.md](QUICK_DEPLOY_GUIDE.md)** | Быстрая инструкция | 5 мин | Опытные |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Полное руководство | 30 мин | Новички |
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Чеклист для контроля | 10 мин | Все |
| **[README_DEPLOYMENT.md](README_DEPLOYMENT.md)** | Техническая справка | 15 мин | Разработчики |

## Скрипты

| Файл | Команда | Описание |
|------|---------|----------|
| `scripts/deploy.js` | `npm run deploy:sepolia` | Основной скрипт деплоя |
| `scripts/check-balance.js` | `npm run check-balance` | Проверка баланса ETH |
| `scripts/verify-deployment.js` | `npm run verify-deployment` | Проверка деплоя |
| `scripts/generate-verification-commands.js` | `node scripts/generate-verification-commands.js` | Генерация команд верификации |

## Конфигурация

| Файл | Описание | Коммитить? |
|------|----------|------------|
| `.env.example` | Пример конфигурации | ✅ Да |
| `.env` | Ваши секретные ключи | ❌ Нет |
| `hardhat.config.js` | Настройки Hardhat | ✅ Да |
| `package.json` | Зависимости и скрипты | ✅ Да |
| `.gitignore` | Игнорируемые файлы | ✅ Да |

## Генерируемые файлы

| Файл | Создается когда | Описание | Коммитить? |
|------|-----------------|----------|------------|
| `deployment-info.json` | После деплоя | Адреса контрактов | ❌ Нет |
| `verify-commands.sh` | После генерации | Команды верификации | ❌ Нет |
| `gas-report.txt` | При тестах с газом | Отчет по газу | ❌ Нет |
| `coverage/` | При coverage тестах | Покрытие тестами | ❌ Нет |

## Структура проекта

```
ethereum/
├── contracts/              # Solidity контракты
│   ├── OrderBook.sol
│   ├── Trade.sol
│   ├── TokenManager.sol
│   └── TestERC20.sol
│
├── test/                   # Тесты
│   ├── OrderBook.test.js
│   ├── Trade.test.js
│   ├── TokenManager.test.js
│   └── TestERC20.test.js
│
├── scripts/                # Скрипты деплоя
│   ├── deploy.js
│   ├── check-balance.js
│   ├── verify-deployment.js
│   └── generate-verification-commands.js
│
├── artifacts/              # Скомпилированные контракты
├── cache/                  # Кэш Hardhat
│
└── Documentation/          # Документация
    ├── START_HERE.md
    ├── QUICK_DEPLOY_GUIDE.md
    ├── DEPLOYMENT_GUIDE.md
    ├── DEPLOYMENT_CHECKLIST.md
    └── README_DEPLOYMENT.md
```

## Команды npm

| Команда | Описание |
|---------|----------|
| `npm install` | Установка зависимостей |
| `npm run compile` | Компиляция контрактов |
| `npm test` | Запуск всех тестов |
| `npm run test:coverage` | Тесты с coverage |
| `npm run test:gas` | Тесты с gas report |
| `npm run check-balance` | Проверка баланса Sepolia |
| `npm run deploy:sepolia` | Деплой в Sepolia |
| `npm run verify-deployment` | Проверка деплоя |
| `npm run clean` | Очистка артефактов |

## Порядок использования файлов

### Первый деплой:
1. **START_HERE.md** → Обзор
2. **QUICK_DEPLOY_GUIDE.md** → Быстрые команды
3. **DEPLOYMENT_CHECKLIST.md** → Отметить выполненное

### Если возникли проблемы:
1. **DEPLOYMENT_GUIDE.md** → Troubleshooting
2. **README_DEPLOYMENT.md** → Подробные команды

### После деплоя:
1. `deployment-info.json` → Сохранить адреса
2. `verify-commands.sh` → Верифицировать контракты

## Быстрый доступ

### Нужно получить ETH?
👉 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) → "Получение тестовых ETH"

### Нужно настроить Alchemy?
👉 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) → "Регистрация на Alchemy"

### Нужно получить приватный ключ?
👉 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) → "Настройка .env файла"

### Деплой не работает?
👉 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) → "Troubleshooting"
👉 [README_DEPLOYMENT.md](README_DEPLOYMENT.md) → "Troubleshooting"

### Нужны команды верификации?
👉 Запустите: `node scripts/generate-verification-commands.js`

## Полезные ссылки

| Ресурс | URL | Для чего |
|--------|-----|----------|
| Sepolia Faucet | https://sepoliafaucet.com/ | Тестовые ETH |
| Alchemy | https://www.alchemy.com/ | RPC endpoint |
| Etherscan | https://etherscan.io/ | API ключ |
| Sepolia Explorer | https://sepolia.etherscan.io/ | Просмотр контрактов |
| Hardhat Docs | https://hardhat.org/ | Документация |
| OpenZeppelin | https://docs.openzeppelin.com/ | Библиотеки |

---

**Обновлено:** 2026-01-13  
**Версия:** 1.0.0
