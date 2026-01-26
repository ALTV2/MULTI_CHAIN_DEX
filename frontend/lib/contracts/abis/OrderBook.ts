export const orderBookABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenManagerAddress',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'ETHReturnFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ETHSentWithERC20',
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
    name: 'InvalidAmounts',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NotOrderCreator',
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
    name: 'SameAssetTrade',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenNotSupported',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TokenTransferFailed',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'id',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'OrderCancelled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'id',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'creator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'tokenToSell',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'tokenToBuy',
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
        indexed: true,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'OrderCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'id',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'OrderExecuted',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_orderId',
        type: 'uint256',
      },
    ],
    name: 'cancelOrder',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenToSell',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_tokenToBuy',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_sellAmount',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_buyAmount',
        type: 'uint256',
      },
    ],
    name: 'createOrder',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'payable',
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
    name: 'getOrder',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'address',
            name: 'creator',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'tokenToSell',
            type: 'address',
          },
          {
            internalType: 'address',
            name: 'tokenToBuy',
            type: 'address',
          },
          {
            internalType: 'uint256',
            name: 'sellAmount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'buyAmount',
            type: 'uint256',
          },
          {
            internalType: 'enum OrderBook.OrderStatus',
            name: 'status',
            type: 'uint8',
          },
        ],
        internalType: 'struct OrderBook.Order',
        name: '',
        type: 'tuple',
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
    name: 'isOrderActive',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'orderCounter',
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
] as const;
