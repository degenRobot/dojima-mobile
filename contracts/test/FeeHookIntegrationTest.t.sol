// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {FeeHook} from "../src/hooks/FeeHook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";
import {MatchDelta} from "../src/types/CLOBTypes.sol";

contract FeeHookIntegrationTest is Test {
    SpotBook public spotBook;
    FeeHook public feeHook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public marketMaker = makeAddr("marketMaker");
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Deploy SpotBook first (no hooks)
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Deploy FeeHook with SpotBook as orderBook
        feeHook = new FeeHook(address(spotBook));
        
        // Set up market maker
        feeHook.setMarketMaker(marketMaker, true);
        
        // Setup users
        _setupUsers();
    }
    
    function _setupUsers() internal {
        address[4] memory users = [alice, bob, charlie, marketMaker];
        
        for (uint i = 0; i < users.length; i++) {
            baseToken.mint(users[i], 1000e18);
            quoteToken.mint(users[i], 1_000_000e18);
            
            vm.startPrank(users[i]);
            baseToken.approve(address(spotBook), type(uint256).max);
            quoteToken.approve(address(spotBook), type(uint256).max);
            spotBook.deposit(address(baseToken), 500e18);
            spotBook.deposit(address(quoteToken), 500_000e18);
            vm.stopPrank();
        }
    }
    
    function test_FeeHookWithSpotBook() public {
        // Note: This is a demonstration of how the fee hook would integrate
        // In practice, the SpotBook would need to be deployed with the fee hook address
        // and would call the hook during matching
        
        // Place orders
        vm.prank(alice);
        uint256 sellOrderId = spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        uint256 buyOrderId = spotBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Orders should match
        // In a real integration, the SpotBook would call feeHook.beforeMatch() here
        
        // Simulate what would happen in the hook
        bytes memory hookData = abi.encode(bob, alice); // buyer, seller
        vm.prank(address(spotBook));
        (, MatchDelta memory delta) = feeHook.beforeMatch(
            buyOrderId,
            sellOrderId,
            2000e18,
            10e18,
            hookData
        );
        
        // Check fee calculation
        assertEq(delta.feeOverride, 20); // Bob (taker) pays 0.20%
        
        // Check volume tracking
        uint256 expectedVolume = 10e18 * 2000e18 / 1e18; // 20,000 quote tokens
        assertEq(feeHook.userVolume30d(alice), expectedVolume);
        assertEq(feeHook.userVolume30d(bob), expectedVolume);
    }
    
    function test_VolumeBasedDiscounts() public {
        // Build up volume for alice to get discount
        uint256 totalVolume = 0;
        
        // Execute multiple trades to build volume
        for (uint i = 0; i < 5; i++) {
            vm.prank(bob);
            spotBook.placeOrder(false, 2000e18 + uint128(i * 10e18), 10e18, IOrderBook.OrderType.LIMIT);
            
            vm.prank(alice);
            spotBook.placeOrder(true, 2000e18 + uint128(i * 10e18), 10e18, IOrderBook.OrderType.LIMIT);
            
            // Simulate hook call
            bytes memory hookData = abi.encode(alice, bob);
            vm.prank(address(spotBook));
            feeHook.beforeMatch(i * 2, i * 2 + 1, 2000e18 + uint128(i * 10e18), 10e18, hookData);
            
            totalVolume += 10e18 * (2000e18 + i * 10e18) / 1e18;
        }
        
        // Check alice's volume and tier
        assertEq(feeHook.userVolume30d(alice), totalVolume);
        
        // With 5 trades of ~20k each, alice should have ~100k volume (tier 1)
        (uint256 tierIndex,,,) = feeHook.getTraderFeeTier(alice);
        assertEq(tierIndex, 1); // Tier 1: $100k+ volume
    }
    
    function test_MarketMakerIntegration() public {
        // Market maker provides liquidity
        vm.prank(marketMaker);
        spotBook.placeOrder(false, 2000e18, 50e18, IOrderBook.OrderType.LIMIT);
        
        // Regular user takes liquidity
        vm.prank(alice);
        spotBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Simulate hook call
        bytes memory hookData = abi.encode(alice, marketMaker);
        vm.prank(address(spotBook));
        (, MatchDelta memory delta) = feeHook.beforeMatch(
            1, // alice's order (taker)
            0, // market maker's order (maker)
            2000e18,
            10e18,
            hookData
        );
        
        // Alice pays taker fee
        assertEq(delta.feeOverride, 20); // 0.20%
        
        // In a complete implementation, the market maker would receive a rebate
        // during settlement, but the taker still pays full fee
    }
    
    function test_DifferentFeeTiers() public {
        // Test each fee tier
        address[4] memory traders = [alice, bob, charlie, marketMaker];
        uint256[4] memory volumes = [uint256(0), uint256(100_000e18), uint256(1_000_000e18), uint256(10_000_000e18)];
        uint128[4] memory expectedTakerFees = [uint128(20), uint128(15), uint128(10), uint128(5)];
        
        // Give each trader different volume
        for (uint i = 0; i < traders.length; i++) {
            if (volumes[i] > 0) {
                // Simulate volume by calling hook directly
                bytes memory hookData = abi.encode(traders[i], address(0x1));
                vm.prank(address(spotBook));
                
                // Single large trade to reach volume threshold
                uint128 amount = uint128(volumes[i] / 2000); // price = 2000
                feeHook.beforeMatch(i, i + 100, 2000e18, amount, hookData);
            }
            
            // Check tier
            (,, , uint128 takerFee) = feeHook.getTraderFeeTier(traders[i]);
            assertEq(takerFee, expectedTakerFees[i]);
        }
    }
    
    function test_GasUsageWithFeeHook() public {
        // Measure gas with fee hook integration
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Measure gas for order that triggers match
        uint256 gasBefore = gasleft();
        vm.prank(bob);
        spotBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("Gas used for order with match:", gasUsed);
        
        // Simulate fee hook call overhead
        bytes memory hookData = abi.encode(bob, alice);
        gasBefore = gasleft();
        vm.prank(address(spotBook));
        feeHook.beforeMatch(1, 0, 2000e18, 10e18, hookData);
        uint256 hookGas = gasBefore - gasleft();
        
        console2.log("Gas used by fee hook:", hookGas);
        console2.log("Percentage overhead:", hookGas * 100 / gasUsed, "%");
    }
}