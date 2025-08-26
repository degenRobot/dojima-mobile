export const spotFactoryABI = [
  {
    "type": "event",
    "name": "SpotPairCreated",
    "inputs": [
      {
        "name": "baseToken",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "quoteToken",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "pairAddress",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "pairId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  }
] as const;