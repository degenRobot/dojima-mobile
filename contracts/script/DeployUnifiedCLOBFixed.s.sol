// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {UnifiedCLOB} from "../src/UnifiedCLOB.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract DeployUnifiedCLOBFixed is Script {
    function run() external {
        vm.startBroadcast();
        
        // Deploy tokens with CORRECT decimals
        MintableERC20 usdc = new MintableERC20("USD Coin", "USDC", 6);
        MintableERC20 weth = new MintableERC20("Wrapped Ether", "WETH", 18);
        MintableERC20 wbtc = new MintableERC20("Wrapped Bitcoin", "WBTC", 8);
        
        console.log("USDC deployed at:", address(usdc));
        console.log("WETH deployed at:", address(weth));
        console.log("WBTC deployed at:", address(wbtc));
        
        // Deploy UnifiedCLOB
        UnifiedCLOB clob = new UnifiedCLOB();
        console.log("UnifiedCLOB deployed at:", address(clob));
        
        // Create trading books
        // IMPORTANT: The contract expects prices in 18 decimals
        // So when trading WETH/USDC, if price is 2000 USDC per WETH:
        // - In the contract: price = 2000 * 10^6 (USDC decimals, not 18!)
        // - This way: (amount * price) / 10^18 gives the correct USDC amount
        
        clob.createBook(address(weth), address(usdc), "WETH/USDC");
        clob.createBook(address(wbtc), address(usdc), "WBTC/USDC");
        clob.createBook(address(weth), address(wbtc), "WETH/WBTC");
        
        console.log("\nTrading books created:");
        console.log("Book 1: WETH/USDC - Price should be in USDC decimals (6)");
        console.log("Book 2: WBTC/USDC - Price should be in USDC decimals (6)");
        console.log("Book 3: WETH/WBTC - Price should be in WBTC decimals (8)");
        
        console.log("\n=== IMPORTANT DECIMAL HANDLING ===");
        console.log("When placing orders, use price in QUOTE TOKEN decimals:");
        console.log("- WETH/USDC: price = 2000 * 10^6 for 2000 USDC per WETH");
        console.log("- WBTC/USDC: price = 50000 * 10^6 for 50000 USDC per WBTC");
        console.log("- WETH/WBTC: price = 0.04 * 10^8 for 0.04 BTC per ETH");
        
        vm.stopBroadcast();
    }
}