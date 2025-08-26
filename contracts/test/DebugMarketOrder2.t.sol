// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {EnhancedSpotBook} from "../src/EnhancedSpotBook.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";
import {HookPermissions} from "../src/types/CLOBTypes.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

contract DebugMarketOrder2Test is Test {
    EnhancedSpotBook ethUsdcSpot;
    CLOBRegistry registry;
    GlobalFeeHook globalFeeHook;
    FeeDistributor feeDistributor;
    
    MockERC20 usdc;
    MockERC20 weth;
    
    address alice = address(0x1);
    address bob = address(0x2);
    address charlie = address(0x3);
    address david = address(0x4);

    function setUp() public {
        // Deploy infrastructure
        registry = new CLOBRegistry();
        
        // Deploy GlobalFeeHook with CREATE2 to ensure proper permissions
        globalFeeHook = deployGlobalFeeHookWithPermissions();
        feeDistributor = new FeeDistributor(address(globalFeeHook), address(this));
        
        // Setup fee distributor
        globalFeeHook.setFeeDistributor(address(feeDistributor));
        feeDistributor.addFactory(address(this));
        
        // Deploy tokens with 18 decimals
        usdc = new MockERC20("USDC", "USDC", 18);
        weth = new MockERC20("WETH", "WETH", 18);
        
        // Deploy spot book
        ethUsdcSpot = new EnhancedSpotBook(
            address(weth),
            address(usdc),
            address(globalFeeHook),
            address(feeDistributor)
        );
        
        // Setup registry
        registry.addFactory(address(this));
        registry.registerPair(address(ethUsdcSpot), address(weth), address(usdc));
        registry.authorizeHook(address(globalFeeHook));
        registry.initializeOwnerSignup();
        
        // Setup hook
        globalFeeHook.addFactory(address(this));
        globalFeeHook.authorizePair(address(ethUsdcSpot));
        
        // Hook is now properly deployed with permissions via CREATE2
        
        // Setup referrals
        vm.prank(charlie);
        registry.registerReferral(address(this));
        
        vm.prank(david);
        registry.registerReferral(charlie);
        
        // Fund users
        uint256 amount = 1000 * 10**18;
        usdc.mint(alice, amount);
        weth.mint(alice, amount);
        usdc.mint(david, amount);
        weth.mint(david, amount);
        
        // Approve and deposit
        vm.startPrank(alice);
        usdc.approve(address(ethUsdcSpot), type(uint256).max);
        weth.approve(address(ethUsdcSpot), type(uint256).max);
        ethUsdcSpot.deposit(address(usdc), amount / 2);
        ethUsdcSpot.deposit(address(weth), amount);
        vm.stopPrank();
        
        vm.startPrank(david);
        usdc.approve(address(ethUsdcSpot), type(uint256).max);
        weth.approve(address(ethUsdcSpot), type(uint256).max);
        ethUsdcSpot.deposit(address(usdc), amount);
        ethUsdcSpot.deposit(address(weth), amount / 2);
        vm.stopPrank();
    }

    function test_SimpleMarketOrder() public {
        console2.log("=== Simple Market Order Test ===");
        
        // Alice places a limit sell order
        vm.prank(alice);
        uint256 sellOrderId = ethUsdcSpot.placeOrder(false, 2000 * 10**18, 1 * 10**18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed sell order:", sellOrderId);
        
        // Check order book state
        (uint128 bestAsk, uint256 askOrderId) = ethUsdcSpot.getBestAsk();
        console2.log("Best ask price:", bestAsk);
        console2.log("Best ask order ID:", askOrderId);
        
        // Check David's balances
        (uint128 davidUsdcAvail, uint128 davidUsdcLocked) = ethUsdcSpot.getBalance(david, address(usdc));
        (uint128 davidWethAvail, uint128 davidWethLocked) = ethUsdcSpot.getBalance(david, address(weth));
        console2.log("David USDC available:", davidUsdcAvail);
        console2.log("David USDC locked:", davidUsdcLocked);
        console2.log("David WETH available:", davidWethAvail);
        console2.log("David WETH locked:", davidWethLocked);
        
        uint256 requiredUsdc = uint256(1 * 10**18) * uint256(2000 * 10**18) / 1e18;
        console2.log("Required USDC for 1 WETH at 2000:", requiredUsdc);
        
        // Try smaller amount to ensure David has enough balance
        uint128 smallAmount = 0.1 * 10**18; // 0.1 ETH
        uint256 requiredSmall = uint256(smallAmount) * uint256(2000 * 10**18) / 1e18;
        console2.log("Required USDC for 0.1 WETH at 2000:", requiredSmall);
        
        // David places a market buy order
        vm.prank(david);
        uint256 buyOrderId = ethUsdcSpot.placeOrder(true, 2000 * 10**18, smallAmount, IOrderBook.OrderType.MARKET);
        console2.log("David placed market buy order:", buyOrderId);
        
        // Check if orders matched
        IOrderBook.Order memory sellOrder = ethUsdcSpot.getOrder(sellOrderId);
        IOrderBook.Order memory buyOrder = ethUsdcSpot.getOrder(buyOrderId);
        
        console2.log("Sell order status:", uint(sellOrder.status));
        console2.log("Sell order remaining:", sellOrder.amount);
        console2.log("Buy order status:", uint(buyOrder.status));
        console2.log("Buy order remaining:", buyOrder.amount);
        
        // Check volumes
        uint256 davidVolume = registry.getTotalVolume(david);
        uint256 charlieReferralVolume = registry.getReferralVolume(charlie);
        
        console2.log("David's volume:", davidVolume);
        console2.log("Charlie's referral volume:", charlieReferralVolume);
        
        // Assertions - adjust for smaller amount
        uint256 expectedVolume = 200 * 10**18; // 0.1 ETH * $2000
        assertEq(davidVolume, expectedVolume, "David should have volume");
        assertEq(charlieReferralVolume, expectedVolume, "Charlie should have referral volume");
    }
    
    /// @notice Deploy GlobalFeeHook with proper permissions using CREATE2
    function deployGlobalFeeHookWithPermissions() internal returns (GlobalFeeHook) {
        uint160 targetPermissions = HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG;
        
        // Find a suitable salt
        bytes32 salt;
        address predictedAddress;
        
        bytes memory bytecode = abi.encodePacked(
            type(GlobalFeeHook).creationCode,
            abi.encode(address(registry))
        );
        bytes32 bytecodeHash = keccak256(bytecode);
        
        // Try different salts until we find one that gives us the required permissions
        for (uint256 i = 0; i < 100000; i++) {
            salt = bytes32(i);
            predictedAddress = Create2.computeAddress(salt, bytecodeHash, address(this));
            
            uint160 addressBits = uint160(predictedAddress);
            if ((addressBits & targetPermissions) == targetPermissions) {
                break;
            }
        }
        
        // Deploy with the found salt
        GlobalFeeHook hook = new GlobalFeeHook{salt: salt}(address(registry));
        require(address(hook) == predictedAddress, "Hook deployed at wrong address");
        
        return hook;
    }
}