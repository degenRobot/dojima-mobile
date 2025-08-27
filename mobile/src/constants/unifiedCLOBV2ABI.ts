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
  }
] as const;