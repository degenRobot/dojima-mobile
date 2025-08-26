// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {FeeHook} from "../src/hooks/FeeHook.sol";
import {BaseCLOBHook} from "../src/hooks/BaseCLOBHook.sol";
import {ICLOBHooks} from "../src/interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../src/types/CLOBTypes.sol";

contract FeeHookTest is Test {
    FeeHook public feeHook;
    
    address public orderBook = makeAddr("orderBook");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public marketMaker = makeAddr("marketMaker");
    
    function setUp() public {
        // Deploy fee hook
        vm.prank(address(this));
        feeHook = new FeeHook(orderBook);
        
        // Set up market maker
        feeHook.setMarketMaker(marketMaker, true);
    }
    
    function test_DefaultFeeTiers() public {
        // Check default tiers are set correctly
        (uint256 threshold0, uint128 maker0, uint128 taker0) = feeHook.feeTiers(0);
        assertEq(threshold0, 0);
        assertEq(maker0, 10); // 0.10%
        assertEq(taker0, 20); // 0.20%
        
        (uint256 threshold1, uint128 maker1, uint128 taker1) = feeHook.feeTiers(1);
        assertEq(threshold1, 100_000e18);
        assertEq(maker1, 8);  // 0.08%
        assertEq(taker1, 15); // 0.15%
        
        (uint256 threshold2, uint128 maker2, uint128 taker2) = feeHook.feeTiers(2);
        assertEq(threshold2, 1_000_000e18);
        assertEq(maker2, 5);  // 0.05%
        assertEq(taker2, 10); // 0.10%
        
        (uint256 threshold3, uint128 maker3, uint128 taker3) = feeHook.feeTiers(3);
        assertEq(threshold3, 10_000_000e18);
        assertEq(maker3, 2);  // 0.02%
        assertEq(taker3, 5);  // 0.05%
    }
    
    function test_BeforeMatch_UpdatesVolume() public {
        uint128 matchPrice = 2000e18;
        uint128 matchAmount = 10e18;
        bytes memory hookData = abi.encode(alice, bob);
        
        // Call beforeMatch
        vm.prank(orderBook);
        (bytes4 selector, MatchDelta memory delta) = feeHook.beforeMatch(
            1, // buyOrderId
            2, // sellOrderId
            matchPrice,
            matchAmount,
            hookData
        );
        
        // Check return values
        assertEq(selector, ICLOBHooks.beforeMatch.selector);
        assertEq(delta.feeOverride, 20); // Alice (buyer/taker) pays 0.20%
        assertEq(delta.priceAdjustment, 0);
        
        // Check volumes updated
        uint256 expectedVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        assertEq(feeHook.userVolume30d(alice), expectedVolume);
        assertEq(feeHook.userVolume30d(bob), expectedVolume);
    }
    
    function test_VolumeBasedFeeTiers() public {
        // Give alice some volume history to qualify for tier 1
        vm.startPrank(orderBook);
        
        // Execute trades to build volume
        bytes memory hookData = abi.encode(alice, bob);
        
        // First trade: $50k volume
        feeHook.beforeMatch(1, 2, 2000e18, 25e18, hookData);
        
        // Check alice still in tier 0
        (uint256 tierIndex,,, uint128 takerFee) = feeHook.getTraderFeeTier(alice);
        assertEq(tierIndex, 0);
        assertEq(takerFee, 20);
        
        // Second trade: another $50k (total $100k)
        feeHook.beforeMatch(3, 4, 2000e18, 25e18, hookData);
        
        // Check alice now in tier 1
        (tierIndex,,, takerFee) = feeHook.getTraderFeeTier(alice);
        assertEq(tierIndex, 1);
        assertEq(takerFee, 15); // Reduced to 0.15%
        
        vm.stopPrank();
    }
    
    function test_MarketMakerRebate() public {
        // Test 1: Market maker as maker (seller), alice as taker (buyer)
        bytes memory hookData = abi.encode(alice, marketMaker);
        
        vm.prank(orderBook);
        (, MatchDelta memory delta) = feeHook.beforeMatch(
            1, // buyOrderId (alice - taker)
            2, // sellOrderId (marketMaker - maker)
            2000e18,
            10e18,
            hookData
        );
        
        // When market maker is the maker, they get rebate
        // Fee calculation: maker fee (10) - rebate (5) = 5
        // But the effective fee returned is what the taker pays (20)
        assertEq(delta.feeOverride, 20); // Taker fee for alice
        
        // Test 2: Regular trader as maker
        hookData = abi.encode(alice, bob);
        
        vm.prank(orderBook);
        (, delta) = feeHook.beforeMatch(
            3, // buyOrderId (alice - taker)
            4, // sellOrderId (bob - maker)
            2000e18,
            10e18,
            hookData
        );
        
        // Regular trader doesn't get rebate, taker pays full fee
        assertEq(delta.feeOverride, 20); // Taker fee
    }
    
    function test_SetFeeTier() public {
        // Add new tier
        feeHook.setFeeTier(4, 50_000_000e18, 1, 3);
        
        (uint256 threshold, uint128 makerFee, uint128 takerFee) = feeHook.feeTiers(4);
        assertEq(threshold, 50_000_000e18);
        assertEq(makerFee, 1);
        assertEq(takerFee, 3);
        
        // Update existing tier
        feeHook.setFeeTier(0, 0, 15, 25);
        
        (threshold, makerFee, takerFee) = feeHook.feeTiers(0);
        assertEq(threshold, 0);
        assertEq(makerFee, 15);
        assertEq(takerFee, 25);
    }
    
    function test_SetMarketMaker() public {
        assertEq(feeHook.isMarketMaker(charlie), false);
        
        // Set charlie as market maker
        feeHook.setMarketMaker(charlie, true);
        assertEq(feeHook.isMarketMaker(charlie), true);
        
        // Remove market maker status
        feeHook.setMarketMaker(charlie, false);
        assertEq(feeHook.isMarketMaker(charlie), false);
    }
    
    function test_OnlyOwnerFunctions() public {
        vm.prank(alice);
        vm.expectRevert("Only owner");
        feeHook.setFeeTier(0, 0, 5, 10);
        
        vm.prank(alice);
        vm.expectRevert("Only owner");
        feeHook.setMarketMaker(alice, true);
    }
    
    function test_OnlyOrderBookCanCallBeforeMatch() public {
        bytes memory hookData = abi.encode(alice, bob);
        
        vm.prank(alice);
        vm.expectRevert("Only orderbook");
        feeHook.beforeMatch(1, 2, 2000e18, 10e18, hookData);
    }
    
    function test_MaxFeeLimit() public {
        // Try to set fee above max
        vm.expectRevert("Fee too high");
        feeHook.setFeeTier(0, 0, 1001, 500); // 10.01% maker fee
        
        vm.expectRevert("Fee too high");
        feeHook.setFeeTier(0, 0, 500, 1001); // 10.01% taker fee
    }
    
    function test_ComplexVolumeScenario() public {
        vm.startPrank(orderBook);
        
        // Alice trades with different counterparties to build volume
        bytes memory hookData1 = abi.encode(alice, bob);
        bytes memory hookData2 = abi.encode(alice, charlie);
        bytes memory hookData3 = abi.encode(alice, marketMaker);
        
        // Trade 1: $30k
        feeHook.beforeMatch(1, 2, 3000e18, 10e18, hookData1);
        assertEq(feeHook.userVolume30d(alice), 30_000e18);
        
        // Trade 2: $40k (total $70k)
        feeHook.beforeMatch(3, 4, 4000e18, 10e18, hookData2);
        assertEq(feeHook.userVolume30d(alice), 70_000e18);
        
        // Trade 3: $35k (total $105k - crosses tier 1 threshold)
        feeHook.beforeMatch(5, 6, 3500e18, 10e18, hookData3);
        assertEq(feeHook.userVolume30d(alice), 105_000e18);
        
        // Verify alice is now in tier 1
        (uint256 tierIndex,,,) = feeHook.getTraderFeeTier(alice);
        assertEq(tierIndex, 1);
        
        vm.stopPrank();
    }
    
    function test_GetTraderFeeTier() public {
        // Default tier for new user
        (uint256 tierIndex, uint256 threshold, uint128 makerFee, uint128 takerFee) = 
            feeHook.getTraderFeeTier(alice);
        
        assertEq(tierIndex, 0);
        assertEq(threshold, 0);
        assertEq(makerFee, 10);
        assertEq(takerFee, 20);
        
        // Give alice volume for tier 2
        vm.prank(orderBook);
        bytes memory hookData = abi.encode(alice, bob);
        
        // Trade to reach $1M volume
        feeHook.beforeMatch(1, 2, 10_000e18, 100e18, hookData); // $1M trade
        
        (tierIndex, threshold, makerFee, takerFee) = feeHook.getTraderFeeTier(alice);
        assertEq(tierIndex, 2);
        assertEq(threshold, 1_000_000e18);
        assertEq(makerFee, 5);
        assertEq(takerFee, 10);
    }
    
    function testFuzz_VolumeTracking(
        uint128 price,
        uint128 amount,
        uint8 numTrades
    ) public {
        vm.assume(price > 0 && price < 1e30);
        vm.assume(amount > 0 && amount < 1e25);
        vm.assume(numTrades > 0 && numTrades <= 10);
        
        vm.startPrank(orderBook);
        
        uint256 totalVolume = 0;
        bytes memory hookData = abi.encode(alice, bob);
        
        for (uint8 i = 0; i < numTrades; i++) {
            feeHook.beforeMatch(i, i + 100, price, amount, hookData);
            totalVolume += uint256(amount) * uint256(price) / 1e18;
        }
        
        assertEq(feeHook.userVolume30d(alice), totalVolume);
        assertEq(feeHook.userVolume30d(bob), totalVolume);
        
        vm.stopPrank();
    }
}