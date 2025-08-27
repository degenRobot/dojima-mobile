// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {UnifiedCLOBV2} from "../src/UnifiedCLOBV2.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract DeployUnifiedCLOBV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy tokens with correct decimals
        MintableERC20 usdc = new MintableERC20("USD Coin", "USDC", 6);
        MintableERC20 weth = new MintableERC20("Wrapped Ether", "WETH", 18);
        MintableERC20 wbtc = new MintableERC20("Wrapped Bitcoin", "WBTC", 8);

        console.log("USDC deployed at:", address(usdc));
        console.log("WETH deployed at:", address(weth));
        console.log("WBTC deployed at:", address(wbtc));

        // Deploy UnifiedCLOBV2
        UnifiedCLOBV2 clob = new UnifiedCLOBV2();
        console.log("UnifiedCLOBV2 deployed at:", address(clob));

        // Create trading books
        clob.createBook(address(weth), address(usdc), "WETH/USDC");
        console.log("Created WETH/USDC book with ID: 1");

        clob.createBook(address(wbtc), address(usdc), "WBTC/USDC");
        console.log("Created WBTC/USDC book with ID: 2");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n================== Deployment Summary ==================");
        console.log("UnifiedCLOBV2:", address(clob));
        console.log("USDC:", address(usdc));
        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));
        console.log("\nTRADING_BOOKS:");
        console.log("  Book 1: WETH/USDC");
        console.log("  Book 2: WBTC/USDC");
        console.log("========================================================\n");
    }
}