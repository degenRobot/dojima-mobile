import { createConfig } from "ponder";

import { erc20ABI } from "./abis/erc20ABI";
import { unifiedCLOBV2ABI } from "./abis/UnifiedCLOBV2";
import { enhancedSpotBookABI } from "./abis/EnhancedSpotBook";
import { spotFactoryABI } from "./abis/SpotFactory";

export default createConfig({
  database: {
    kind: "pglite",
  },
  chains: {
    rise: {
      id: 11155931,
      rpc: process.env.PONDER_RPC_URL_1 || "https://indexing.testnet.riselabs.xyz",
    },
  },
  contracts: {
    // UnifiedCLOBV2 - our main contract
    UnifiedCLOBV2: {
      chain: "rise",
      abi: unifiedCLOBV2ABI,
      address: "0x92025983Ab5641378893C3932A1a43e214e7446D",
      startBlock: 18000000, // Approximate deployment block (need to verify)
    },
    
    // MintableERC20 tokens
    USDC: {
      chain: "rise",
      abi: erc20ABI,
      address: "0xaE3A504B9Fe27cf2ff3Ed3e36bE037AD36a1a48a",
      startBlock: 18000000,
    },
    WETH: {
      chain: "rise",
      abi: erc20ABI,
      address: "0x3Af2aed9FFA29b2a0e387a2Fb45a540A66f4D2b4",
      startBlock: 18000000,
    },
    WBTC: {
      chain: "rise",
      abi: erc20ABI,
      address: "0x30301403f92915c8731880eF595c20C8C6059369",
      startBlock: 18000000,
    },
    
    // Legacy contracts (keeping for historical data)
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
      startBlock: 17756000,
    },
    SpotFactory: {
      chain: "rise",
      abi: spotFactoryABI,
      address: "0xb4d719B6131E9E924d693321c0c4cCE03041d2f2",
      startBlock: 17756000,
    },
  },
});