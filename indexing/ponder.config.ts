import { createConfig } from "ponder";

import { erc20ABI } from "./abis/erc20ABI";
import { enhancedSpotBookABI } from "./abis/EnhancedSpotBook";
import { spotFactoryABI } from "./abis/SpotFactory";

export default createConfig({
  database: {
    kind: "pglite",
  },
  chains: {
    rise: {
      id: 11155931,
      rpc: process.env.PONDER_RPC_URL_1!,
    },
  },
  contracts: {
    ERC20: {
      chain: "rise",
      abi: erc20ABI,
      address: "0x6f127dc335c98a621111a686d0f2a6c0f4f5ea05",
      startBlock: 17897000,
    },
    EnhancedSpotBook: {
      chain: "rise",
      abi: enhancedSpotBookABI,
      address: "0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222",
      startBlock: 17756000, // Original deployment block to catch all orders
    },
    SpotFactory: {
      chain: "rise",
      abi: spotFactoryABI,
      address: "0xb4d719B6131E9E924d693321c0c4cCE03041d2f2",
      startBlock: 17756000, // Same as EnhancedSpotBook to catch factory events
    },
  },
});
