import { createConfig } from "ponder";

import { erc20ABI } from "./abis/erc20ABI";
import { unifiedCLOBV2ABI } from "./abis/UnifiedCLOBV2";

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
    // UnifiedCLOBV2 - our main contract (LATEST DEPLOYMENT)
    UnifiedCLOBV2: {
      chain: "rise",
      abi: unifiedCLOBV2ABI,
      address: "0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C",
      startBlock: 21181053, // Exact deployment block
    },
    
    // MintableERC20 tokens (LATEST DEPLOYMENT)
    USDC: {
      chain: "rise",
      abi: erc20ABI,
      address: "0xC23b6B892c947746984474d52BBDF4ADd25717B3",
      startBlock: 21181053,
    },
    WETH: {
      chain: "rise",
      abi: erc20ABI,
      address: "0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4",
      startBlock: 21181053,
    },
    WBTC: {
      chain: "rise",
      abi: erc20ABI,
      address: "0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA",
      startBlock: 21181053,
    },
  },
});