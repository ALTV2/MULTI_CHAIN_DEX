export const tradeABI = [
  {
    inputs: [
      {
        internalType: 'address payable',
        name: '_orderBookAddress',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'CannotExecuteOwnOrder',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ETHSentWithERC20',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ETHTransferToCreatorFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ETHTransferToExecutorFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'IncorrectETHAmount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InsufficientAllowance',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidOrderBookAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OrderDoesNotExist',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OrderNotActive',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ReentrancyGuardReentrantCall',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenBuyTransferFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenSellTransferFailed',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'orderId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'executor',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'sellAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'buyAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'OrderExecuted',
    type: 'event',
  },
  {
    inputs: [],
    name: 'ORDER_BOOK',
    outputs: [
      {
        internalType: 'contract OrderBook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_orderId',
        type: 'uint256',
      },
    ],
    name: 'executeOrder',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEthBalance',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
] as const;
