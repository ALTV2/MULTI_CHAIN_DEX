# Полезные команды для Ethereum проекта

## Установка зависимостей

```bash
npm install
```

## Компиляция контрактов

```bash
# Компиляция всех контрактов
npm run compile

# Очистка артефактов и кеша
npm run clean

# Очистка и повторная компиляция
npm run clean && npm run compile
```

## Тестирование

```bash
# Запуск всех тестов
npm test

# Запуск тестов с отчетом о потреблении газа
npm run test:gas

# Запуск тестов с отчетом о покрытии кода
npm run test:coverage

# Запуск конкретного теста
npx hardhat test test/TestERC20.test.js

# Запуск тестов в режиме watch (с автоматическим перезапуском)
npx hardhat watch test
```

## Локальная разработка

```bash
# Запуск локальной Hardhat ноды
npm run node

# В другом терминале: деплой контрактов на локальную ноду
npm run deploy:local

# Деплой на встроенную Hardhat сеть (без отдельной ноды)
npm run deploy:hardhat
```

## Консоль Hardhat

```bash
# Запуск консоли для взаимодействия с контрактами
npx hardhat console

# Запуск консоли с подключением к локальной сети
npx hardhat console --network localhost
```

## Полезные Hardhat команды

```bash
# Просмотр доступных команд
npx hardhat help

# Просмотр списка аккаунтов
npx hardhat accounts

# Проверка конфигурации
npx hardhat config

# Очистка кеша
npx hardhat clean
```

## Деплой в тестовые сети

```bash
# Сначала настройте .env файл (скопируйте из .env.example)
cp .env.example .env

# Отредактируйте .env и добавьте:
# - PRIVATE_KEY (приватный ключ кошелька)
# - SEPOLIA_RPC_URL (URL RPC провайдера, например Infura или Alchemy)
# - ETHERSCAN_API_KEY (для верификации контрактов)

# Деплой в тестовую сеть Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Деплой в основную сеть (будьте осторожны!)
npx hardhat run scripts/deploy.js --network mainnet
```

## Верификация контрактов

```bash
# Верификация контракта на Etherscan
npx hardhat verify --network sepolia АДРЕС_КОНТРАКТА "Аргумент1" "Аргумент2"

# Пример для TestERC20
npx hardhat verify --network sepolia 0x123... "Test Token" "TEST"
```

## Анализ и отчеты

```bash
# Отчет о размере контрактов
npx hardhat size-contracts

# Проверка безопасности зависимостей
npm audit

# Автоматическое исправление уязвимостей
npm audit fix
```

## Работа с npm

```bash
# Обновление зависимостей
npm update

# Проверка устаревших пакетов
npm outdated

# Установка дополнительного пакета
npm install --save-dev ИМЯ_ПАКЕТА

# Удаление пакета
npm uninstall ИМЯ_ПАКЕТА
```

## Примеры использования Hardhat консоли

```javascript
// Получить список аккаунтов
const accounts = await ethers.getSigners();
console.log(accounts[0].address);

// Получить баланс
const balance = await ethers.provider.getBalance(accounts[0].address);
console.log(ethers.formatEther(balance));

// Деплой контракта из консоли
const TestERC20 = await ethers.getContractFactory("TestERC20");
const token = await TestERC20.deploy("My Token", "MTK");
await token.waitForDeployment();
console.log("Token deployed to:", await token.getAddress());

// Взаимодействие с контрактом
await token.mint(accounts[0].address, ethers.parseEther("1000"));
const balance = await token.balanceOf(accounts[0].address);
console.log("Balance:", ethers.formatEther(balance));
```

## Отладка

```bash
# Запуск тестов с выводом логов консоли
npx hardhat test --logs

# Запуск с трассировкой стека
npx hardhat test --stack-traces

# Включение verbose режима
npx hardhat test --verbose
```

## Git команды для контрактов

```bash
# Добавить изменения
git add .

# Коммит изменений
git commit -m "Add TestERC20 contract"

# Отправить в репозиторий
git push

# Проверить статус
git status

# Посмотреть изменения
git diff
```

## Полезные ссылки

- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Solidity Documentation](https://docs.soliditylang.org/)
