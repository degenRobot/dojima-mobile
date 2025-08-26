// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {CLOBFactory} from "../src/CLOBFactory.sol";
import {CLOBFactoryModular} from "../src/CLOBFactoryModular.sol";
import {SpotFactory} from "../src/factories/SpotFactory.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";

contract ContractSizeTest is Test {
    function test_contractSizes() public {
        // Deploy contracts to check sizes
        CLOBRegistry registry = new CLOBRegistry();
        GlobalFeeHook hook = new GlobalFeeHook(address(registry));
        FeeDistributor feeDistributor = new FeeDistributor(address(hook), address(this));
        
        // Check original factory size (this will fail due to size)
        console.log("=== Contract Sizes ===");
        
        // Deploy modular contracts
        CLOBFactoryModular modularFactory = new CLOBFactoryModular(address(registry));
        SpotFactory spotFactory = new SpotFactory(
            address(modularFactory),
            address(registry),
            address(hook),
            address(feeDistributor)
        );
        
        // Get deployed bytecode sizes
        uint256 modularFactorySize = address(modularFactory).code.length;
        uint256 spotFactorySize = address(spotFactory).code.length;
        uint256 registrySize = address(registry).code.length;
        uint256 hookSize = address(hook).code.length;
        uint256 feeDistributorSize = address(feeDistributor).code.length;
        
        console.log("CLOBRegistry size:", registrySize, "bytes");
        console.log("GlobalFeeHook size:", hookSize, "bytes");
        console.log("FeeDistributor size:", feeDistributorSize, "bytes");
        console.log("CLOBFactoryModular size:", modularFactorySize, "bytes");
        console.log("SpotFactory size:", spotFactorySize, "bytes");
        console.log("Total modular factories:", modularFactorySize + spotFactorySize, "bytes");
        
        // Check against 24KB limit
        uint256 limit = 24576; // 24KB
        console.log("\nContract size limits (24KB =", limit, "bytes):");
        
        assertTrue(modularFactorySize < limit, "Modular factory too large");
        assertTrue(spotFactorySize < limit, "Spot factory too large");
        
        console.log("Modular factory:", modularFactorySize < limit ? "PASS" : "FAIL");
        console.log("Spot factory:", spotFactorySize < limit ? "PASS" : "FAIL");
    }
}