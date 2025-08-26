// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {CLOBFactoryModular} from "../src/CLOBFactoryModular.sol";
import {SpotFactory} from "../src/factories/SpotFactory.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {EnhancedSpotBook} from "../src/EnhancedSpotBook.sol";
import {HookPermissions} from "../src/types/CLOBTypes.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/// @title CREATE2FullIntegrationTest
/// @notice Full integration test demonstrating CREATE2 deployment for production
contract CREATE2FullIntegrationTest is Test {
    // Core contracts
    CLOBRegistry registry;
    CLOBFactoryModular factory;
    SpotFactory spotFactory;
    GlobalFeeHook globalFeeHook;
    FeeDistributor feeDistributor;
    
    // Tokens
    MockERC20 usdc;
    MockERC20 weth;
    MockERC20 wbtc;
    
    // Trading pairs
    EnhancedSpotBook ethUsdcSpot;
    EnhancedSpotBook btcUsdcSpot;
    
    // Users
    address alice = address(0x1);
    address bob = address(0x2);
    address charlie = address(0x3);
    address david = address(0x4);
    address treasury = address(0x5);
    address stakingPool = address(0x6);
    
    /// @notice Deploy complete CLOB system using CREATE2 for hooks
    function test_FullSystemDeploymentWithCREATE2() public {
        // Step 1: Deploy CLOBRegistry first
        registry = new CLOBRegistry();
        console2.log("CLOBRegistry deployed at:", address(registry));
        
        // Step 2: Find suitable salt for GlobalFeeHook with BEFORE_MATCH + AFTER_MATCH permissions
        uint160 targetPermissions = HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG;
        
        (bytes32 salt, address predictedHookAddress) = findSuitableSalt(
            address(registry),
            targetPermissions,
            100000 // max attempts
        );
        
        console2.log("Found suitable salt:", uint256(salt));
        console2.log("Predicted hook address:", predictedHookAddress);
        
        // Step 3: Deploy GlobalFeeHook using CREATE2
        globalFeeHook = new GlobalFeeHook{salt: salt}(address(registry));
        assertEq(address(globalFeeHook), predictedHookAddress, "Hook deployed at wrong address");
        console2.log("GlobalFeeHook deployed at:", address(globalFeeHook));
        
        // Step 4: Deploy FeeDistributor
        feeDistributor = new FeeDistributor(address(globalFeeHook), treasury);
        console2.log("FeeDistributor deployed at:", address(feeDistributor));
        
        // Step 5: Deploy Modular Factory System
        factory = new CLOBFactoryModular(address(registry));
        console2.log("CLOBFactoryModular deployed at:", address(factory));
        
        spotFactory = new SpotFactory(
            address(factory),
            address(registry),
            address(globalFeeHook),
            address(feeDistributor)
        );
        console2.log("SpotFactory deployed at:", address(spotFactory));
        
        // Step 6: Configure all contracts
        registry.addFactory(address(spotFactory));
        registry.authorizeHook(address(globalFeeHook));
        registry.initializeOwnerSignup();
        
        globalFeeHook.addFactory(address(spotFactory));
        globalFeeHook.setFeeDistributor(address(feeDistributor));
        
        feeDistributor.addFactory(address(spotFactory));
        feeDistributor.setStakingPool(stakingPool);
        
        factory.setSpotFactory(address(spotFactory));
        
        // Step 7: Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        wbtc = new MockERC20("Wrapped BTC", "WBTC", 18);
        
        // Step 8: Create trading pairs
        vm.startPrank(factory.owner());
        address ethUsdcAddress = factory.createSpotPair(address(weth), address(usdc));
        ethUsdcSpot = EnhancedSpotBook(ethUsdcAddress);
        
        address btcUsdcAddress = factory.createSpotPair(address(wbtc), address(usdc));
        btcUsdcSpot = EnhancedSpotBook(btcUsdcAddress);
        vm.stopPrank();
        
        console2.log("ETH/USDC pair deployed at:", address(ethUsdcSpot));
        console2.log("BTC/USDC pair deployed at:", address(btcUsdcSpot));
        
        // Step 9: Setup test users and execute trades
        setupUsersAndTrade();
        
        // Step 10: Verify the system works correctly
        verifySystemFunctionality();
    }
    
    /// @notice Find a suitable salt for CREATE2 deployment
    function findSuitableSalt(
        address registryAddress,
        uint160 requiredPermissions,
        uint256 maxAttempts
    ) internal view returns (bytes32 salt, address hookAddress) {
        bytes memory bytecode = abi.encodePacked(
            type(GlobalFeeHook).creationCode,
            abi.encode(registryAddress)
        );
        
        bytes32 bytecodeHash = keccak256(bytecode);
        
        for (uint256 i = 0; i < maxAttempts; i++) {
            salt = bytes32(i);
            hookAddress = Create2.computeAddress(salt, bytecodeHash, address(this));
            
            uint160 addressBits = uint160(hookAddress);
            if ((addressBits & requiredPermissions) == requiredPermissions) {
                return (salt, hookAddress);
            }
        }
        
        revert("Could not find suitable salt");
    }
    
    /// @notice Setup users and execute test trades
    function setupUsersAndTrade() internal {
        // Mint tokens to users
        uint256 usdcAmount = 1_000_000e18;
        uint256 ethAmount = 100e18;
        uint256 btcAmount = 10e18;
        
        address[4] memory users = [alice, bob, charlie, david];
        for (uint i = 0; i < users.length; i++) {
            usdc.mint(users[i], usdcAmount);
            weth.mint(users[i], ethAmount);
            wbtc.mint(users[i], btcAmount);
        }
        
        // Setup referral relationships
        vm.prank(charlie);
        registry.registerReferral(address(this));
        
        vm.prank(david);
        registry.registerReferral(charlie);
        
        // Alice trades ETH/USDC
        vm.startPrank(alice);
        usdc.approve(address(ethUsdcSpot), type(uint256).max);
        weth.approve(address(ethUsdcSpot), type(uint256).max);
        ethUsdcSpot.deposit(address(usdc), 500_000e18);
        ethUsdcSpot.deposit(address(weth), 50e18);
        ethUsdcSpot.placeOrder(true, 2000e18, 2e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Bob provides liquidity
        vm.startPrank(bob);
        usdc.approve(address(ethUsdcSpot), type(uint256).max);
        weth.approve(address(ethUsdcSpot), type(uint256).max);
        ethUsdcSpot.deposit(address(usdc), 500_000e18);
        ethUsdcSpot.deposit(address(weth), 50e18);
        ethUsdcSpot.placeOrder(false, 2000e18, 2e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Match orders
        ethUsdcSpot.matchOrders(1);
        
        // David trades with referrer
        vm.startPrank(david);
        usdc.approve(address(btcUsdcSpot), type(uint256).max);
        wbtc.approve(address(btcUsdcSpot), type(uint256).max);
        btcUsdcSpot.deposit(address(usdc), 500_000e18);
        btcUsdcSpot.deposit(address(wbtc), 5e18);
        btcUsdcSpot.placeOrder(true, 40000e18, 0.1e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Charlie provides liquidity
        vm.startPrank(charlie);
        usdc.approve(address(btcUsdcSpot), type(uint256).max);
        wbtc.approve(address(btcUsdcSpot), type(uint256).max);
        btcUsdcSpot.deposit(address(usdc), 500_000e18);
        btcUsdcSpot.deposit(address(wbtc), 5e18);
        btcUsdcSpot.placeOrder(false, 40000e18, 0.1e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Match orders
        btcUsdcSpot.matchOrders(1);
    }
    
    /// @notice Verify all system components work correctly
    function verifySystemFunctionality() internal {
        console2.log("\n=== System Verification ===");
        
        // 1. Verify volume tracking
        uint256 aliceVolume = registry.getTotalVolume(alice);
        uint256 bobVolume = registry.getTotalVolume(bob);
        uint256 davidVolume = registry.getTotalVolume(david);
        uint256 charlieVolume = registry.getTotalVolume(charlie);
        
        console2.log("Alice total volume:", aliceVolume);
        console2.log("Bob total volume:", bobVolume);
        console2.log("David total volume:", davidVolume);
        console2.log("Charlie total volume:", charlieVolume);
        
        assertGt(aliceVolume, 0, "Alice should have trading volume");
        assertGt(bobVolume, 0, "Bob should have trading volume");
        assertGt(davidVolume, 0, "David should have trading volume");
        assertGt(charlieVolume, 0, "Charlie should have trading volume");
        
        // 2. Verify referral tracking
        uint256 charlieReferralVolume = registry.getReferralVolume(charlie);
        console2.log("Charlie's referral volume:", charlieReferralVolume);
        assertEq(charlieReferralVolume, davidVolume, "Charlie should have David's volume as referral");
        
        // 3. Verify fee collection
        ethUsdcSpot.forwardFeesToDistributor(true, true);
        btcUsdcSpot.forwardFeesToDistributor(true, true);
        
        uint256 totalUsdcFees = feeDistributor.getAccumulatedFees(address(usdc));
        uint256 totalWethFees = feeDistributor.getAccumulatedFees(address(weth));
        uint256 totalWbtcFees = feeDistributor.getAccumulatedFees(address(wbtc));
        
        console2.log("Total USDC fees collected:", totalUsdcFees);
        console2.log("Total WETH fees collected:", totalWethFees);
        console2.log("Total WBTC fees collected:", totalWbtcFees);
        
        assertGt(totalUsdcFees + totalWethFees + totalWbtcFees, 0, "Fees should be collected");
        
        // 4. Verify fee distribution
        if (totalUsdcFees > 0) {
            uint256 treasuryBefore = usdc.balanceOf(treasury);
            uint256 stakingBefore = usdc.balanceOf(stakingPool);
            
            feeDistributor.distributeAccumulatedFees(address(usdc));
            
            uint256 treasuryAfter = usdc.balanceOf(treasury);
            uint256 stakingAfter = usdc.balanceOf(stakingPool);
            
            console2.log("Treasury received:", treasuryAfter - treasuryBefore);
            console2.log("Staking pool received:", stakingAfter - stakingBefore);
            
            assertGt(treasuryAfter, treasuryBefore, "Treasury should receive fees");
            assertGt(stakingAfter, stakingBefore, "Staking pool should receive fees");
        }
        
        // 5. Verify fee tiers
        (uint256 tierIndex, , , , uint256 currentVolume) = globalFeeHook.getUserFeeTier(alice);
        console2.log("Alice's fee tier:", tierIndex);
        console2.log("Alice's volume for tier:", currentVolume);
        
        // Higher volume traders should have better fee tiers
        if (aliceVolume >= 10_000e18) {
            assertGt(tierIndex, 0, "High volume trader should have better tier");
        }
        
        console2.log("\n[SUCCESS] All system components working correctly!");
    }
    
    /// @notice Test calculating CREATE2 addresses for different deployers
    function test_CREATE2AddressCalculation() public view {
        // Show how addresses change with different deployers and salts
        address[] memory deployers = new address[](3);
        deployers[0] = address(this);
        deployers[1] = 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2; // RISE CREATE2 factory
        deployers[2] = address(0x1234);
        
        bytes32[] memory salts = new bytes32[](3);
        salts[0] = bytes32(uint256(0));
        salts[1] = bytes32(uint256(9)); // Salt found in our test
        salts[2] = bytes32(uint256(42));
        
        console2.log("\n=== CREATE2 Address Calculations ===");
        
        for (uint i = 0; i < deployers.length; i++) {
            console2.log("\nDeployer:", deployers[i]);
            
            for (uint j = 0; j < salts.length; j++) {
                bytes memory bytecode = abi.encodePacked(
                    type(GlobalFeeHook).creationCode,
                    abi.encode(address(0x1234)) // Example registry address
                );
                
                address predicted = Create2.computeAddress(
                    salts[j],
                    keccak256(bytecode),
                    deployers[i]
                );
                
                uint160 addressBits = uint160(predicted);
                bool hasBeforeMatch = (addressBits & HookPermissions.BEFORE_MATCH_FLAG) != 0;
                bool hasAfterMatch = (addressBits & HookPermissions.AFTER_MATCH_FLAG) != 0;
                
                console2.log("  Salt", uint256(salts[j]), "->", predicted);
                console2.log("    BEFORE_MATCH:", hasBeforeMatch, "AFTER_MATCH:", hasAfterMatch);
            }
        }
    }
}