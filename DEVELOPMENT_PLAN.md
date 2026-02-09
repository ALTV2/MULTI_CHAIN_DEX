# MULTI_CHAIN_DEX - План развития

## Текущее состояние проекта

```
MULTI_CHAIN_DEX/
├── ethereum/           # Смарт-контракты Ethereum (Sepolia)
│   ├── contracts/      # TokenManager, OrderBook, Trade, TestERC20
│   ├── scripts/        # Деплой скрипты
│   └── test/           # Тесты на Hardhat
├── frontend/           # Next.js + React + Wagmi + RainbowKit
└── docs/
```

**Текущий функционал:**
- Peer-to-peer Order Book модель на Ethereum
- Создание/исполнение/отмена ордеров
- Поддержка ETH и ERC20 токенов
- Современный React фронтенд

---

## Целевая архитектура

```
MULTI_CHAIN_DEX/
├── ethereum/           # Смарт-контракты Ethereum
│   ├── contracts/
│   │   ├── core/       # Существующие контракты
│   │   └── htlc/       # HTLC контракты для кросс-чейн
│   └── ...
│
├── polygon/            # [NEW] Смарт-контракты Polygon
│   ├── contracts/
│   │   ├── core/       # TokenManager, OrderBook, Trade
│   │   └── htlc/       # HTLC контракты
│   ├── scripts/
│   └── test/
│
├── backend/            # [NEW] Java Backend (опциональный)
│   ├── src/main/java/
│   ├── src/main/resources/
│   └── docker-compose.yml
│
├── frontend/           # Обновленный фронтенд
│   ├── app/
│   │   ├── swap/       # [NEW] Кросс-чейн свопы
│   │   └── profile/    # [NEW] Личный кабинет
│   └── ...
│
└── shared/             # [NEW] Общие типы и утилиты
```

---

## Фаза 1: HTLC контракты для кросс-чейн свопов

### 1.1 Архитектура HTLC (Hash Time-Locked Contracts)

HTLC - это криптографический примитив, позволяющий атомарный обмен между блокчейнами без доверия третьей стороне.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTLC SWAP FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ETHEREUM                           POLYGON                     │
│  ─────────                          ───────                     │
│                                                                 │
│  1. Alice создает HTLC              2. Bob создает HTLC         │
│     ├─ hashlock = H(secret)            ├─ тот же hashlock       │
│     ├─ timelock = T1 (48h)             ├─ timelock = T2 (24h)   │
│     ├─ amount = 1 ETH                  ├─ amount = 1000 MATIC   │
│     └─ recipient = Bob                 └─ recipient = Alice     │
│                                                                 │
│  3. Alice раскрывает secret         4. Bob использует secret    │
│     на Polygon, получает MATIC         на Ethereum, получает ETH│
│                                                                 │
│  ВАЖНО: T1 > T2 (чтобы Alice могла сначала забрать)            │
│                                                                 │
│  ИЛИ: После T1/T2 - refund возвращает средства отправителю     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 HTLC контракт (для обеих сетей)

```solidity
// contracts/htlc/HTLC.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SwapStatus { Empty, Active, Withdrawn, Refunded }

    struct Swap {
        address initiator;      // Кто создал своп
        address participant;    // Кто получит средства
        address token;          // address(0) для native token
        uint256 amount;
        bytes32 hashlock;       // keccak256(secret)
        uint256 timelock;       // Unix timestamp для refund
        SwapStatus status;
    }

    mapping(bytes32 => Swap) public swaps;  // swapId => Swap

    event SwapCreated(
        bytes32 indexed swapId,
        address indexed initiator,
        address indexed participant,
        address token,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock
    );

    event SwapWithdrawn(bytes32 indexed swapId, bytes32 secret);
    event SwapRefunded(bytes32 indexed swapId);

    error SwapAlreadyExists();
    error SwapNotActive();
    error InvalidHashlock();
    error TimelockNotExpired();
    error TimelockExpired();
    error InvalidAmount();
    error NotParticipant();

    /// @notice Создание HTLC свопа
    /// @param _swapId Уникальный ID свопа
    /// @param _participant Адрес получателя
    /// @param _hashlock Hash от секрета (keccak256)
    /// @param _timelock Время до которого можно withdraw
    /// @param _token Адрес токена (address(0) для ETH/MATIC)
    /// @param _amount Сумма (игнорируется для native token, берется msg.value)
    function createSwap(
        bytes32 _swapId,
        address _participant,
        bytes32 _hashlock,
        uint256 _timelock,
        address _token,
        uint256 _amount
    ) external payable nonReentrant {
        if (swaps[_swapId].status != SwapStatus.Empty) revert SwapAlreadyExists();
        if (_timelock <= block.timestamp) revert TimelockExpired();

        uint256 finalAmount;

        if (_token == address(0)) {
            // Native token (ETH/MATIC)
            if (msg.value == 0) revert InvalidAmount();
            finalAmount = msg.value;
        } else {
            // ERC20 token
            if (_amount == 0) revert InvalidAmount();
            finalAmount = _amount;
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }

        swaps[_swapId] = Swap({
            initiator: msg.sender,
            participant: _participant,
            token: _token,
            amount: finalAmount,
            hashlock: _hashlock,
            timelock: _timelock,
            status: SwapStatus.Active
        });

        emit SwapCreated(
            _swapId,
            msg.sender,
            _participant,
            _token,
            finalAmount,
            _hashlock,
            _timelock
        );
    }

    /// @notice Получение средств с раскрытием секрета
    /// @param _swapId ID свопа
    /// @param _secret Секрет (preimage от hashlock)
    function withdraw(bytes32 _swapId, bytes32 _secret) external nonReentrant {
        Swap storage swap = swaps[_swapId];

        if (swap.status != SwapStatus.Active) revert SwapNotActive();
        if (swap.timelock < block.timestamp) revert TimelockExpired();
        if (keccak256(abi.encodePacked(_secret)) != swap.hashlock) {
            revert InvalidHashlock();
        }

        swap.status = SwapStatus.Withdrawn;

        if (swap.token == address(0)) {
            payable(swap.participant).transfer(swap.amount);
        } else {
            IERC20(swap.token).safeTransfer(swap.participant, swap.amount);
        }

        emit SwapWithdrawn(_swapId, _secret);
    }

    /// @notice Возврат средств после истечения timelock
    /// @param _swapId ID свопа
    function refund(bytes32 _swapId) external nonReentrant {
        Swap storage swap = swaps[_swapId];

        if (swap.status != SwapStatus.Active) revert SwapNotActive();
        if (swap.timelock > block.timestamp) revert TimelockNotExpired();

        swap.status = SwapStatus.Refunded;

        if (swap.token == address(0)) {
            payable(swap.initiator).transfer(swap.amount);
        } else {
            IERC20(swap.token).safeTransfer(swap.initiator, swap.amount);
        }

        emit SwapRefunded(_swapId);
    }

    /// @notice Получение информации о свопе
    function getSwap(bytes32 _swapId) external view returns (Swap memory) {
        return swaps[_swapId];
    }

    /// @notice Проверка hashlock
    function checkHashlock(bytes32 _secret) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret));
    }
}
```

### 1.3 Cross-Chain Order Book контракт

```solidity
// contracts/htlc/CrossChainOrderBook.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CrossChainOrderBook
/// @notice Хранит намерения на кросс-чейн обмен (on-chain discovery)
contract CrossChainOrderBook is ReentrancyGuard {

    enum OrderStatus { Active, Matched, Completed, Cancelled }

    struct CrossChainOrder {
        uint256 id;
        address creator;

        // Что отдаем (на текущем чейне)
        address sellToken;      // address(0) для native
        uint256 sellAmount;
        uint256 sourceChainId;

        // Что хотим получить (на другом чейне)
        address buyToken;
        uint256 buyAmount;
        uint256 targetChainId;

        // Дополнительно
        address targetAddress;  // Адрес на целевом чейне для получения
        uint256 expiresAt;
        OrderStatus status;
    }

    uint256 public nextOrderId = 1;
    mapping(uint256 => CrossChainOrder) public orders;

    // Индексы для поиска
    mapping(uint256 => uint256[]) public ordersBySourceChain;
    mapping(uint256 => uint256[]) public ordersByTargetChain;

    event CrossChainOrderCreated(
        uint256 indexed orderId,
        address indexed creator,
        uint256 sourceChainId,
        uint256 targetChainId,
        address sellToken,
        uint256 sellAmount,
        address buyToken,
        uint256 buyAmount
    );

    event CrossChainOrderMatched(uint256 indexed orderId, address matcher);
    event CrossChainOrderCompleted(uint256 indexed orderId);
    event CrossChainOrderCancelled(uint256 indexed orderId);

    /// @notice Создание кросс-чейн ордера (только декларация намерения)
    function createCrossChainOrder(
        address _sellToken,
        uint256 _sellAmount,
        address _buyToken,
        uint256 _buyAmount,
        uint256 _targetChainId,
        address _targetAddress,
        uint256 _expiresAt
    ) external returns (uint256 orderId) {
        require(_expiresAt > block.timestamp, "Invalid expiry");
        require(_sellAmount > 0 && _buyAmount > 0, "Invalid amounts");
        require(_targetChainId != block.chainid, "Same chain not allowed");

        orderId = nextOrderId++;

        orders[orderId] = CrossChainOrder({
            id: orderId,
            creator: msg.sender,
            sellToken: _sellToken,
            sellAmount: _sellAmount,
            sourceChainId: block.chainid,
            buyToken: _buyToken,
            buyAmount: _buyAmount,
            targetChainId: _targetChainId,
            targetAddress: _targetAddress,
            expiresAt: _expiresAt,
            status: OrderStatus.Active
        });

        ordersBySourceChain[block.chainid].push(orderId);
        ordersByTargetChain[_targetChainId].push(orderId);

        emit CrossChainOrderCreated(
            orderId,
            msg.sender,
            block.chainid,
            _targetChainId,
            _sellToken,
            _sellAmount,
            _buyToken,
            _buyAmount
        );
    }

    /// @notice Отметить ордер как matched (для UI tracking)
    function markAsMatched(uint256 _orderId) external {
        CrossChainOrder storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Not active");
        require(order.creator == msg.sender, "Not creator");

        order.status = OrderStatus.Matched;
        emit CrossChainOrderMatched(_orderId, msg.sender);
    }

    /// @notice Отменить ордер
    function cancelOrder(uint256 _orderId) external {
        CrossChainOrder storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Not active");
        require(order.creator == msg.sender, "Not creator");

        order.status = OrderStatus.Cancelled;
        emit CrossChainOrderCancelled(_orderId);
    }

    /// @notice Получить все активные ордера для целевого чейна
    function getOrdersForTargetChain(uint256 _chainId)
        external view returns (CrossChainOrder[] memory)
    {
        uint256[] memory ids = ordersByTargetChain[_chainId];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            if (orders[ids[i]].status == OrderStatus.Active) {
                activeCount++;
            }
        }

        CrossChainOrder[] memory result = new CrossChainOrder[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (orders[ids[i]].status == OrderStatus.Active) {
                result[j++] = orders[ids[i]];
            }
        }

        return result;
    }
}
```

---

## Фаза 2: Структура каталога Polygon

### 2.1 Создание каталога polygon/

```bash
mkdir -p polygon/{contracts/{core,htlc},scripts,test}
```

### 2.2 Файловая структура

```
polygon/
├── contracts/
│   ├── core/
│   │   ├── TokenManager.sol      # Копия из ethereum с адаптацией
│   │   ├── OrderBook.sol         # Копия из ethereum
│   │   └── Trade.sol             # Копия из ethereum
│   │
│   ├── htlc/
│   │   ├── HTLC.sol              # Идентичен ethereum версии
│   │   └── CrossChainOrderBook.sol
│   │
│   └── tokens/
│       └── TestERC20.sol         # Тестовые токены для Polygon
│
├── scripts/
│   ├── deploy.js                 # Деплой всех контрактов
│   ├── deploy-htlc.js            # Деплой только HTLC
│   └── verify.js                 # Верификация на PolygonScan
│
├── test/
│   ├── HTLC.test.js
│   ├── CrossChainOrderBook.test.js
│   └── integration/
│       └── htlc-flow.test.js     # Симуляция кросс-чейн
│
├── hardhat.config.js
├── package.json
└── .env.example
```

### 2.3 Hardhat конфигурация для Polygon

```javascript
// polygon/hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // Polygon Mumbai Testnet (deprecated, use Amoy)
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    },
    // Polygon Mainnet
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137
    }
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonAmoy: process.env.POLYGONSCAN_API_KEY
    }
  }
};
```

---

## Фаза 3: Backend (Java 21 + Spring Boot + PostgreSQL)

### 3.1 Назначение Backend

> **ВАЖНО:** Backend - ОПЦИОНАЛЬНЫЙ компонент. DEX работает полностью децентрализованно без него.

Backend предоставляет:
1. **Личные кабинеты** - регистрация/авторизация пользователей
2. **Хранение кошельков** - зашифрованные данные кошельков
3. **Кэширование ордеров** - ускорение UI (но данные всегда из блокчейна)
4. **Push-уведомления** - о статусе свопов
5. **Аналитика** - история транзакций

### 3.2 Структура каталога backend/

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/multichain/dex/
│   │   │   ├── MultiChainDexApplication.java
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.java
│   │   │   │   ├── Web3Config.java
│   │   │   │   └── CorsConfig.java
│   │   │   │
│   │   │   ├── domain/
│   │   │   │   ├── entity/
│   │   │   │   │   ├── User.java
│   │   │   │   │   ├── Wallet.java
│   │   │   │   │   ├── SwapHistory.java
│   │   │   │   │   └── NotificationPreference.java
│   │   │   │   │
│   │   │   │   └── enums/
│   │   │   │       ├── ChainType.java
│   │   │   │       └── SwapStatus.java
│   │   │   │
│   │   │   ├── repository/
│   │   │   │   ├── UserRepository.java
│   │   │   │   ├── WalletRepository.java
│   │   │   │   └── SwapHistoryRepository.java
│   │   │   │
│   │   │   ├── service/
│   │   │   │   ├── AuthService.java
│   │   │   │   ├── WalletService.java
│   │   │   │   ├── BlockchainService.java
│   │   │   │   ├── SwapService.java
│   │   │   │   └── NotificationService.java
│   │   │   │
│   │   │   ├── controller/
│   │   │   │   ├── AuthController.java
│   │   │   │   ├── WalletController.java
│   │   │   │   ├── SwapController.java
│   │   │   │   └── UserController.java
│   │   │   │
│   │   │   ├── dto/
│   │   │   │   ├── request/
│   │   │   │   └── response/
│   │   │   │
│   │   │   └── security/
│   │   │       ├── JwtTokenProvider.java
│   │   │       ├── Web3AuthFilter.java
│   │   │       └── SignatureVerifier.java
│   │   │
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-dev.yml
│   │       └── db/migration/        # Flyway migrations
│   │           ├── V1__init_schema.sql
│   │           └── V2__add_swap_history.sql
│   │
│   └── test/java/
│
├── Dockerfile
├── docker-compose.yml
├── pom.xml
└── README.md
```

### 3.3 Ключевые сущности

```java
// domain/entity/User.java
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true)
    private String email;  // Optional, for notifications

    @Column(unique = true, nullable = false)
    private String primaryWalletAddress;  // Main wallet for auth

    private String passwordHash;  // Optional password for extra security

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<Wallet> wallets;

    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
}

// domain/entity/Wallet.java
@Entity
@Table(name = "wallets")
public class Wallet {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    private ChainType chain;  // ETHEREUM, POLYGON

    private String address;

    private String encryptedPrivateKey;  // AES-256 encrypted, nullable

    private String label;  // "Main Wallet", "Trading", etc.

    private boolean isImported;  // true if user imported private key

    private LocalDateTime createdAt;
}

// domain/entity/SwapHistory.java
@Entity
@Table(name = "swap_history")
public class SwapHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    private User user;

    private String swapId;  // On-chain swap ID (bytes32)

    @Enumerated(EnumType.STRING)
    private ChainType sourceChain;

    @Enumerated(EnumType.STRING)
    private ChainType targetChain;

    private String sourceToken;
    private BigDecimal sourceAmount;

    private String targetToken;
    private BigDecimal targetAmount;

    @Enumerated(EnumType.STRING)
    private SwapStatus status;

    private String txHashSource;
    private String txHashTarget;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
```

### 3.4 Web3 Аутентификация (Sign-In with Ethereum)

```java
// security/SignatureVerifier.java
@Component
public class SignatureVerifier {

    public boolean verifySignature(String message, String signature, String address) {
        try {
            // Восстановить адрес из подписи
            byte[] messageHash = Hash.sha3(
                ("\u0019Ethereum Signed Message:\n" + message.length() + message).getBytes()
            );

            Sign.SignatureData signatureData = parseSignature(signature);
            BigInteger publicKey = Sign.signedMessageHashToKey(messageHash, signatureData);
            String recoveredAddress = "0x" + Keys.getAddress(publicKey);

            return recoveredAddress.equalsIgnoreCase(address);
        } catch (Exception e) {
            return false;
        }
    }
}

// controller/AuthController.java
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/nonce")
    public NonceResponse getNonce(@RequestBody NonceRequest request) {
        // Генерация nonce для подписи
        String nonce = UUID.randomUUID().toString();
        nonceCache.put(request.getAddress(), nonce);

        return new NonceResponse(
            "Sign this message to authenticate: " + nonce,
            nonce
        );
    }

    @PostMapping("/verify")
    public AuthResponse verifySignature(@RequestBody VerifyRequest request) {
        String expectedNonce = nonceCache.get(request.getAddress());
        String message = "Sign this message to authenticate: " + expectedNonce;

        if (signatureVerifier.verifySignature(message, request.getSignature(), request.getAddress())) {
            User user = userService.findOrCreate(request.getAddress());
            String jwt = jwtTokenProvider.generateToken(user);

            return new AuthResponse(jwt, user);
        }

        throw new AuthenticationException("Invalid signature");
    }
}
```

### 3.5 Docker Compose

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://db:5432/multichain_dex
      SPRING_DATASOURCE_USERNAME: ${DB_USER:-dex}
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD:-dex_password}
      ETHEREUM_RPC_URL: ${ETHEREUM_RPC_URL}
      POLYGON_RPC_URL: ${POLYGON_RPC_URL}
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: multichain_dex
      POSTGRES_USER: ${DB_USER:-dex}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dex_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3.6 pom.xml (основные зависимости)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <groupId>com.multichain</groupId>
    <artifactId>dex-backend</artifactId>
    <version>1.0.0-SNAPSHOT</version>

    <properties>
        <java.version>21</java.version>
        <web3j.version>4.10.3</web3j.version>
    </properties>

    <dependencies>
        <!-- Spring Boot -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Database -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <!-- Web3 -->
        <dependency>
            <groupId>org.web3j</groupId>
            <artifactId>core</artifactId>
            <version>${web3j.version}</version>
        </dependency>

        <!-- JWT -->
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>0.12.5</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>0.12.5</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>0.12.5</version>
            <scope>runtime</scope>
        </dependency>

        <!-- Utilities -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

---

## Фаза 4: Обновление Frontend

### 4.1 Новые страницы

```
frontend/app/
├── page.tsx                    # Home (существует)
├── trade/page.tsx              # Single-chain trade (существует)
├── orders/page.tsx             # My orders (существует)
│
├── swap/                       # [NEW] Cross-chain swap
│   ├── page.tsx                # Swap interface
│   └── [swapId]/page.tsx       # Swap details/tracking
│
├── cross-chain/                # [NEW] Cross-chain order book
│   └── page.tsx                # Browse cross-chain orders
│
└── profile/                    # [NEW] Personal cabinet
    ├── page.tsx                # Profile overview
    ├── wallets/page.tsx        # Wallet management
    ├── history/page.tsx        # Swap history
    └── settings/page.tsx       # Settings
```

### 4.2 Новые компоненты

```typescript
// components/swap/
├── CrossChainSwapForm.tsx      // Форма для создания кросс-чейн свопа
├── SwapProgress.tsx            // Прогресс HTLC свопа (шаги)
├── ChainSelector.tsx           // Выбор source/target chain
├── HTLCStatus.tsx              // Статус HTLC контракта
└── SecretReveal.tsx            // UI для раскрытия секрета

// components/profile/
├── WalletList.tsx              // Список кошельков
├── AddWalletModal.tsx          // Добавление кошелька
├── SwapHistoryTable.tsx        // История свопов
└── ProfileSettings.tsx         // Настройки профиля
```

### 4.3 Новые hooks для HTLC

```typescript
// hooks/htlc/
├── useCreateHTLCSwap.ts        // Создание HTLC
├── useWithdrawHTLC.ts          // Withdraw с секретом
├── useRefundHTLC.ts            // Refund после timelock
├── useHTLCStatus.ts            // Статус свопа
└── useCrossChainOrder.ts       // Работа с CrossChainOrderBook

// hooks/profile/
├── useAuth.ts                  // Аутентификация через Web3
├── useProfile.ts               // Данные профиля
└── useWallets.ts               // Управление кошельками
```

### 4.4 Обновление конфигурации сетей

```typescript
// lib/constants/chains.ts
export const SUPPORTED_CHAINS = {
  ethereum: {
    id: 11155111,  // Sepolia
    name: 'Ethereum Sepolia',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.infura.io/v3/...'],
    blockExplorers: ['https://sepolia.etherscan.io'],
    contracts: {
      orderBook: '0x96c763c1Cb33e5be34c20980570Fe1614F3df05e',
      trade: '0x125B8201BFB93337b298Dc650F9729a2aa7E2061',
      htlc: '0x...',  // После деплоя
      crossChainOrderBook: '0x...'
    }
  },
  polygon: {
    id: 80002,  // Amoy testnet
    name: 'Polygon Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorers: ['https://amoy.polygonscan.com'],
    contracts: {
      orderBook: '0x...',
      trade: '0x...',
      htlc: '0x...',
      crossChainOrderBook: '0x...'
    }
  }
} as const;
```

---

## Фаза 5: Процесс Cross-Chain Swap (пользовательский flow)

### 5.1 Полностью децентрализованный режим (без backend)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DECENTRALIZED CROSS-CHAIN SWAP                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DISCOVERY (On-Chain)                                                │
│     ├─ Alice публикует CrossChainOrder на Ethereum                      │
│     │   "Хочу обменять 1 ETH на 1000 MATIC"                            │
│     └─ Bob видит ордер через CrossChainOrderBook.getOrdersForTargetChain│
│                                                                         │
│  2. NEGOTIATION (Off-Chain / Chat / Direct)                            │
│     ├─ Bob связывается с Alice (адрес в ордере)                        │
│     ├─ Согласовывают timelocks: ETH=48h, MATIC=24h                     │
│     └─ Alice генерирует secret, отправляет hashlock Bob'у              │
│                                                                         │
│  3. HTLC CREATION                                                       │
│     ├─ Alice создает HTLC на Ethereum:                                 │
│     │   createSwap(swapId, Bob, hashlock, now+48h, ETH, 1 ether)       │
│     │                                                                   │
│     └─ Bob создает HTLC на Polygon:                                    │
│         createSwap(swapId, Alice, hashlock, now+24h, MATIC, 1000)      │
│                                                                         │
│  4. ATOMIC EXECUTION                                                    │
│     ├─ Alice вызывает withdraw на Polygon с secret                     │
│     │   → Получает 1000 MATIC                                          │
│     │   → Secret становится публичным в транзакции                     │
│     │                                                                   │
│     └─ Bob видит secret в транзакции Alice                             │
│         → Вызывает withdraw на Ethereum с тем же secret                │
│         → Получает 1 ETH                                               │
│                                                                         │
│  5. FALLBACK (если что-то пошло не так)                                │
│     └─ После timelock любая сторона может вызвать refund()             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Режим с Backend (улучшенный UX)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND-ASSISTED CROSS-CHAIN SWAP                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DISCOVERY (Backend Cache + On-Chain)                               │
│     ├─ Backend индексирует события CrossChainOrderBook                 │
│     ├─ Быстрый поиск и фильтрация через REST API                       │
│     └─ UI получает ордера мгновенно (не ждет blockchain query)         │
│                                                                         │
│  2. MATCHING (Backend Orchestration)                                    │
│     ├─ Backend находит matching orders автоматически                   │
│     ├─ Уведомляет обе стороны о потенциальном match                    │
│     └─ Генерирует предложение со всеми параметрами                     │
│                                                                         │
│  3. HTLC CREATION (Backend Guided)                                     │
│     ├─ Backend генерирует secret и hashlock                            │
│     ├─ Отправляет инструкции обеим сторонам                            │
│     ├─ Отслеживает создание HTLC на обоих чейнах                       │
│     └─ Валидирует параметры (timelocks, amounts)                       │
│                                                                         │
│  4. EXECUTION (Backend Monitoring)                                      │
│     ├─ Backend мониторит оба блокчейна                                 │
│     ├─ Уведомляет о withdraw событиях                                  │
│     ├─ Показывает secret второй стороне в UI                           │
│     └─ Push-уведомления о статусе                                      │
│                                                                         │
│  5. HISTORY & ANALYTICS                                                 │
│     ├─ Сохраняет историю всех свопов пользователя                      │
│     └─ Статистика, графики, экспорт                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Фаза 6: Безопасность

### 6.1 Smart Contract Security

- [ ] Аудит HTLC контрактов (критично!)
- [ ] Fuzz testing с Foundry
- [ ] Slither static analysis
- [ ] Проверка на front-running атаки
- [ ] Timelock validation (T1 > T2)

### 6.2 Backend Security

- [ ] Rate limiting на API endpoints
- [ ] Input validation
- [ ] Encrypted storage для private keys (AES-256-GCM)
- [ ] Secure key derivation (Argon2id)
- [ ] JWT rotation
- [ ] CORS configuration
- [ ] SQL injection prevention (JPA/Hibernate)

### 6.3 Frontend Security

- [ ] Никогда не хранить private keys в localStorage
- [ ] CSP headers
- [ ] XSS prevention
- [ ] Secure wallet connection flow

---

## План реализации по этапам

### Этап 1: Инфраструктура (1 неделя)
- [ ] Создать структуру каталогов polygon/ и backend/
- [ ] Настроить Hardhat для Polygon
- [ ] Создать базовый Spring Boot проект
- [ ] Настроить Docker Compose

### Этап 2: HTLC контракты (2 недели)
- [ ] Разработать HTLC.sol
- [ ] Разработать CrossChainOrderBook.sol
- [ ] Написать comprehensive тесты
- [ ] Деплой на Sepolia и Polygon Amoy
- [ ] Верификация контрактов

### Этап 3: Backend MVP (2 недели)
- [ ] Реализовать Web3 аутентификацию
- [ ] Создать сущности и миграции БД
- [ ] API для управления кошельками
- [ ] API для истории свопов
- [ ] Event indexing для CrossChainOrderBook

### Этап 4: Frontend обновление (2 недели)
- [ ] Страница Cross-Chain Swap
- [ ] Компоненты для HTLC workflow
- [ ] Страница личного кабинета
- [ ] Multi-chain support в Wagmi config
- [ ] Интеграция с backend API

### Этап 5: Интеграция и тестирование (1 неделя)
- [ ] End-to-end тестирование cross-chain swap
- [ ] Security review
- [ ] Performance optimization
- [ ] Documentation

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря средств в HTLC | Средняя | Критическое | Тщательный аудит, timelocks |
| Сетевые задержки | Высокая | Среднее | Достаточные timelocks (24h+) |
| Front-running | Средняя | Высокое | Private mempool, commit-reveal |
| Backend компрометация | Низкая | Среднее | Backend не хранит незашифрованные ключи |

---

## Заключение

Данный план обеспечивает:

1. **Полную децентрализацию** - HTLC свопы работают без доверенной третьей стороны
2. **Опциональный backend** - улучшает UX, но не является обязательным
3. **Расширяемость** - легко добавить новые сети в будущем
4. **Безопасность** - время-блокировки защищают от потери средств

Следующий шаг: начать с создания структуры каталогов и базовых HTLC контрактов.
