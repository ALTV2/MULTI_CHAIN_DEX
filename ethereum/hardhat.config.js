require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      // SMTChecker — встроенный в solc формальный верификатор на основе SMT-солверов.
      // Запускается во время compile, проверяет assert/require, переполнения, деление
      // на ноль и выход за границы массивов. Используется ограниченный модельный
      // верификатор (BMC, bound = 2): он быстро (секунды на контракт) даёт верифицируемый
      // результат для линейных свойств. Полный CHC-анализ инвариантов не используется,
      // поскольку требует значительно большего времени анализа. Включается флагом
      // окружения SMT_CHECK=1 (см. §4.2.1 ВКР).
      ...(process.env.SMT_CHECK === "1" && {
        modelChecker: {
          engine: "bmc",
          timeout: 10000,
          showProvedSafe: false,
          showUnproved: false,
          showUnsupported: false,
          targets: ["assert", "underflow", "overflow", "divByZero", "outOfBounds"]
        }
      })
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111
    },
    polygonAmoy: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002
    }
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
