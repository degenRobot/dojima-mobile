// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {UnifiedCLOB} from "../src/UnifiedCLOB.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract DeployUnifiedCLOB is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying from:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy tokens
        MintableERC20 usdc = new MintableERC20("USD Coin", "USDC", 6);
        console.log("USDC deployed at:", address(usdc));
        
        MintableERC20 weth = new MintableERC20("Wrapped Ether", "WETH", 18);
        console.log("WETH deployed at:", address(weth));
        
        MintableERC20 wbtc = new MintableERC20("Wrapped Bitcoin", "WBTC", 8);
        console.log("WBTC deployed at:", address(wbtc));
        
        // Deploy UnifiedCLOB
        UnifiedCLOB clob = new UnifiedCLOB();
        console.log("UnifiedCLOB deployed at:", address(clob));
        
        // Create trading books
        uint256 bookId1 = clob.createBook(address(weth), address(usdc), "WETH/USDC");
        console.log("Created book WETH/USDC with ID:", bookId1);
        
        uint256 bookId2 = clob.createBook(address(wbtc), address(usdc), "WBTC/USDC");
        console.log("Created book WBTC/USDC with ID:", bookId2);
        
        uint256 bookId3 = clob.createBook(address(weth), address(wbtc), "WETH/WBTC");
        console.log("Created book WETH/WBTC with ID:", bookId3);
        
        // Mint initial tokens for deployer (for testing)
        usdc.mint(deployer, 100000 * 10**6);  // 100,000 USDC
        weth.mint(deployer, 100 * 10**18);    // 100 WETH
        wbtc.mint(deployer, 10 * 10**8);      // 10 WBTC
        
        console.log("Initial tokens minted for deployer");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("USDC:", address(usdc));
        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));
        console.log("UnifiedCLOB:", address(clob));
        console.log("Owner:", deployer);
        console.log("Fee Collector:", deployer);
        console.log("\nTrading Books:");
        console.log("  Book 1: WETH/USDC");
        console.log("  Book 2: WBTC/USDC");
        console.log("  Book 3: WETH/WBTC");
    }
}