// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {CLOBFactoryModular} from "../src/CLOBFactoryModular.sol";
import {SpotFactory} from "../src/factories/SpotFactory.sol";
import {MockToken} from "../src/mocks/MockToken.sol";
import {EnhancedSpotBook} from "../src/EnhancedSpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";

contract ModularFactoryTest is Test {
    uint160 constant BEFORE_MATCH_FLAG = 1 << 159;
    uint160 constant AFTER_MATCH_FLAG = 1 << 158;
    CLOBRegistry registry;
    GlobalFeeHook hook;
    FeeDistributor feeDistributor;
    CLOBFactoryModular factory;
    SpotFactory spotFactory;
    
    MockToken weth;
    MockToken usdc;
    
    address alice = address(0xABCD);
    address treasury = address(0x1234);
    
    function setUp() public {
        // Deploy infrastructure
        registry = new CLOBRegistry();
        
        // For testing, we'll deploy hook normally and just verify functionality
        // In production, use CREATE2 with proper salt
        hook = new GlobalFeeHook(address(registry));
        
        // Check if hook would have correct permissions (for awareness)
        uint160 addressBits = uint160(address(hook));
        uint160 targetPermissions = BEFORE_MATCH_FLAG | AFTER_MATCH_FLAG;
        bool hasCorrectPermissions = (addressBits & targetPermissions) == targetPermissions;
        console.log("Hook address:", address(hook));
        console.log("Hook has correct permission bits:", hasCorrectPermissions);
        // Note: In tests, we might not have correct bits, but functionality should still work
        
        feeDistributor = new FeeDistributor(address(hook), treasury);
        factory = new CLOBFactoryModular(address(registry));
        spotFactory = new SpotFactory(
            address(factory),
            address(registry),
            address(hook),
            address(feeDistributor)
        );
        
        // Configure
        registry.addFactory(address(spotFactory)); // Register spotFactory
        registry.authorizeHook(address(hook));
        hook.addFactory(address(spotFactory));
        hook.setFeeDistributor(address(feeDistributor));
        feeDistributor.addFactory(address(spotFactory));
        factory.setSpotFactory(address(spotFactory));
        registry.initializeOwnerSignup();
        
        // Deploy mock tokens
        weth = new MockToken("Wrapped ETH", "WETH", 18);
        usdc = new MockToken("USD Coin", "USDC", 6);
    }
    
    function test_CreateSpotPair() public {
        // Create spot pair (factory is the owner of spotFactory)
        address spotPair = factory.createSpotPair(address(weth), address(usdc));
        
        // Verify deployment
        assertTrue(spotPair != address(0), "Spot pair not deployed");
        assertTrue(factory.spotPairExists(address(weth), address(usdc)), "Pair not registered");
        assertEq(factory.getSpotPair(address(weth), address(usdc)), spotPair, "Wrong pair address");
        
        // Verify it's an EnhancedSpotBook
        EnhancedSpotBook book = EnhancedSpotBook(spotPair);
        assertEq(book.baseToken(), address(weth), "Wrong base token");
        assertEq(book.quoteToken(), address(usdc), "Wrong quote token");
        assertEq(address(book.globalFeeHook()), address(hook), "Wrong hook");
        
        // Verify registry
        assertTrue(registry.pairIdByAddress(spotPair) > 0, "Not registered in registry");
    }
    
    function test_CannotCreateDuplicatePair() public {
        // Create first pair (factory is the owner)
        factory.createSpotPair(address(weth), address(usdc));
        
        // Try to create duplicate
        vm.expectRevert("Pair exists");
        factory.createSpotPair(address(weth), address(usdc));
    }
    
    function test_BasicTrading() public {
        // Create spot pair (factory is the owner)
        address spotPair = factory.createSpotPair(address(weth), address(usdc));
        EnhancedSpotBook book = EnhancedSpotBook(spotPair);
        
        // Get tokens from faucet for alice
        vm.startPrank(alice);
        // Call faucet multiple times to get enough tokens
        for(uint i = 0; i < 10; i++) {
            weth.faucet(); // Gets 1000 WETH each time
        }
        for(uint i = 0; i < 20; i++) {
            usdc.faucet(); // Gets 1000 USDC each time
        }
        
        // Approve and deposit
        weth.approve(spotPair, type(uint256).max);
        usdc.approve(spotPair, type(uint256).max);
        
        book.deposit(address(weth), 5000 ether);  // Deposit 5000 WETH
        book.deposit(address(usdc), 10000 * 10**6); // Deposit 10,000 USDC
        
        // Place orders - alice is calling from her address
        // Price is in quote units per base unit with 18 decimals
        // So 2000 USDC per ETH = 2000 * 10^6 / 10^18 * 10^18 = 2000 * 10^6
        uint256 buyOrderId = book.placeOrder(true, 2000 * 10**6, 0.1 ether, IOrderBook.OrderType.LIMIT); // Buy 0.1 ETH at $2000
        uint256 sellOrderId = book.placeOrder(false, 2000 * 10**6, 0.1 ether, IOrderBook.OrderType.LIMIT); // Sell 0.1 ETH at $2000
        
        // Orders should match - verify through order data
        IOrderBook.Order memory buyOrder = book.getOrder(buyOrderId);
        IOrderBook.Order memory sellOrder = book.getOrder(sellOrderId);
        assertEq(buyOrder.amount, 0, "Buy order not filled"); // Amount = 0 means filled
        assertEq(sellOrder.amount, 0, "Sell order not filled");
        
        vm.stopPrank();
    }
}