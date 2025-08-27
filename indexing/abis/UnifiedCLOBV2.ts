export const unifiedCLOBV2ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "bookId", "type": "uint256" },
      { "indexed": false, "name": "baseToken", "type": "address" },
      { "indexed": false, "name": "quoteToken", "type": "address" },
      { "indexed": false, "name": "name", "type": "string" }
    ],
    "name": "BookCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": true, "name": "token", "type": "address" },
      { "indexed": false, "name": "amount", "type": "uint256" }
    ],
    "name": "Deposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "token", "type": "address" },
      { "indexed": false, "name": "amount", "type": "uint256" }
    ],
    "name": "FeesCollected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "orderId", "type": "uint256" },
      { "indexed": true, "name": "trader", "type": "address" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "OrderCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "buyOrderId", "type": "uint256" },
      { "indexed": true, "name": "sellOrderId", "type": "uint256" },
      { "indexed": true, "name": "bookId", "type": "uint256" },
      { "indexed": false, "name": "buyer", "type": "address" },
      { "indexed": false, "name": "seller", "type": "address" },
      { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "amount", "type": "uint256" },
      { "indexed": false, "name": "buyerFee", "type": "uint256" },
      { "indexed": false, "name": "sellerFee", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "OrderMatched",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "orderId", "type": "uint256" },
      { "indexed": true, "name": "bookId", "type": "uint256" },
      { "indexed": true, "name": "trader", "type": "address" },
      { "indexed": false, "name": "orderType", "type": "uint8" },
      { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "amount", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "OrderPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "orderId", "type": "uint256" },
      { "indexed": false, "name": "oldStatus", "type": "uint8" },
      { "indexed": false, "name": "newStatus", "type": "uint8" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "OrderStatusChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "bookId", "type": "uint256" },
      { "indexed": false, "name": "price", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "PriceUpdate",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "bookId", "type": "uint256" },
      { "indexed": false, "name": "volume", "type": "uint256" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "VolumeUpdate",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "user", "type": "address" },
      { "indexed": true, "name": "token", "type": "address" },
      { "indexed": false, "name": "amount", "type": "uint256" }
    ],
    "name": "Withdrawn",
    "type": "event"
  },
  {
    "inputs": [
      { "name": "orderId", "type": "uint256" }
    ],
    "name": "cancelOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "baseToken", "type": "address" },
      { "name": "quoteToken", "type": "address" },
      { "name": "name", "type": "string" }
    ],
    "name": "createBook",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "user", "type": "address" },
      { "name": "token", "type": "address" }
    ],
    "name": "getBalance",
    "outputs": [
      { "name": "available", "type": "uint256" },
      { "name": "locked", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "orderId", "type": "uint256" }
    ],
    "name": "getOrder",
    "outputs": [
      {
        "components": [
          { "name": "id", "type": "uint256" },
          { "name": "trader", "type": "address" },
          { "name": "bookId", "type": "uint256" },
          { "name": "orderType", "type": "uint8" },
          { "name": "price", "type": "uint256" },
          { "name": "amount", "type": "uint256" },
          { "name": "filled", "type": "uint256" },
          { "name": "status", "type": "uint8" },
          { "name": "timestamp", "type": "uint256" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "bookId", "type": "uint256" }
    ],
    "name": "getOrderBook",
    "outputs": [
      { "name": "buyOrders", "type": "uint256[]" },
      { "name": "sellOrders", "type": "uint256[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "bookId", "type": "uint256" }
    ],
    "name": "getTradingBook",
    "outputs": [
      {
        "components": [
          { "name": "baseToken", "type": "address" },
          { "name": "quoteToken", "type": "address" },
          { "name": "active", "type": "bool" },
          { "name": "name", "type": "string" },
          { "name": "totalVolume", "type": "uint256" },
          { "name": "lastPrice", "type": "uint256" },
          { "name": "buyOrderCount", "type": "uint256" },
          { "name": "sellOrderCount", "type": "uint256" }
        ],
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "bookId", "type": "uint256" },
      { "name": "maxMatches", "type": "uint256" }
    ],
    "name": "matchOrders",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "bookId", "type": "uint256" },
      { "name": "orderType", "type": "uint8" },
      { "name": "price", "type": "uint256" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "placeOrder",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;