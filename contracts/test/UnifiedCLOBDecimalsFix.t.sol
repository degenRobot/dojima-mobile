// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {UnifiedCLOB} from "../src/UnifiedCLOB.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract UnifiedCLOBDecimalsFixTest is Test {
    UnifiedCLOB public clob;
    MintableERC20 public usdc;
    MintableERC20 public weth;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public admin = makeAddr("admin");
    
    uint256 constant BOOK_WETH_USDC = 1;
    
    function setUp() public {
        // Deploy tokens with REALISTIC decimals
        usdc = new MintableERC20("USD Coin", "USDC", 6);  // 6 decimals like real USDC
        weth = new MintableERC20("Wrapped Ether", "WETH", 18); // 18 decimals
        
        // Deploy CLOB
        vm.prank(admin);
        clob = new UnifiedCLOB();
        
        // Create trading book
        vm.prank(admin);
        clob.createBook(address(weth), address(usdc), "WETH/USDC");
        
        // Mint and approve
        vm.prank(alice);
        usdc.mintOnce(); // 1000 * 10^6 USDC
        vm.prank(alice);
        weth.mintOnce(); // 1000 * 10^18 WETH
        vm.prank(alice);
        usdc.approve(address(clob), type(uint256).max);
        vm.prank(alice);
        weth.approve(address(clob), type(uint256).max);
        
        vm.prank(bob);
        usdc.mintOnce();
        vm.prank(bob);
        weth.mintOnce();
        vm.prank(bob);
        usdc.approve(address(clob), type(uint256).max);
        vm.prank(bob);
        weth.approve(address(clob), type(uint256).max);
    }
    
    function test_ProperDecimalHandling() public {
        console.log("=== Understanding the Decimal Problem ===");
        
        // The problem: We want to trade 0.1 WETH for 200 USDC
        // WETH has 18 decimals, USDC has 6 decimals
        
        uint256 wethAmount = 10**17; // 0.1 WETH in 18 decimals
        
        // Price should represent: "How many quote tokens for 1 base token"
        // We want 2000 USDC for 1 WETH
        // Since USDC has 6 decimals: 2000 * 10^6 = 2000000000
        // But the contract expects price in 18 decimals for uniformity
        // So we need to scale the USDC amount to 18 decimals: 2000 * 10^18
        
        // The issue is in the calculation:
        // quoteAmount = (amount * price) / 10^18
        // = (0.1 * 10^18 * 2000 * 10^18) / 10^18
        // = 200 * 10^18
        
        // But USDC only has 6 decimals, so we actually need 200 * 10^6
        
        // SOLUTION: Adjust the price to account for decimal difference
        // Price = 2000 USDC * 10^6 (not 10^18)
        // This gives us the price in USDC's native decimals
        uint256 adjustedPrice = 2000 * 10**6; // 2000 USDC in 6 decimals
        
        console.log("WETH amount (0.1):", wethAmount);
        console.log("Adjusted price (2000 USDC in 6 decimals):", adjustedPrice);
        
        // Now the calculation:
        // quoteAmount = (0.1 * 10^18 * 2000 * 10^6) / 10^18
        // = 200 * 10^6
        uint256 quoteNeeded = (wethAmount * adjustedPrice) / 10**18;
        console.log("Quote amount needed:", quoteNeeded);
        console.log("Expected (200 USDC in 6 decimals):", uint256(200 * 10**6));
        
        assertEq(quoteNeeded, 200 * 10**6, "Quote calculation should give 200 USDC");
        
        // Deposit and place order with adjusted price
        vm.prank(alice);
        clob.deposit(address(usdc), 500 * 10**6); // 500 USDC
        
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            adjustedPrice, // Use adjusted price!
            wethAmount
        );
        
        console.log("Order placed successfully with ID:", orderId);
        
        // Check locked amount
        (, uint256 locked) = clob.getBalance(alice, address(usdc));
        console.log("Locked USDC:", locked);
        assertEq(locked, 200 * 10**6, "Should lock 200 USDC");
    }
    
    function test_MatchingWithAdjustedPrices() public {
        console.log("=== Testing Matching with Proper Decimals ===");
        
        // Deposit tokens
        vm.prank(alice);
        clob.deposit(address(usdc), 500 * 10**6); // 500 USDC
        
        vm.prank(bob);
        clob.deposit(address(weth), 10**18); // 1 WETH
        
        // Trade 0.1 WETH for 200 USDC
        uint256 amount = 10**17; // 0.1 WETH
        uint256 price = 2000 * 10**6; // 2000 USDC per WETH (in USDC decimals)
        
        console.log("Alice placing buy order...");
        vm.prank(alice);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            price,
            amount
        );
        
        console.log("Bob placing sell order...");
        vm.prank(bob);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            price,
            amount
        );
        
        // Check final balances
        (uint256 aliceUsdc,) = clob.getBalance(alice, address(usdc));
        (uint256 aliceWeth,) = clob.getBalance(alice, address(weth));
        (uint256 bobUsdc,) = clob.getBalance(bob, address(usdc));
        (uint256 bobWeth,) = clob.getBalance(bob, address(weth));
        
        console.log("\nFinal Balances:");
        console.log("Alice USDC:", aliceUsdc);
        console.log("Alice WETH:", aliceWeth);
        console.log("Bob USDC:", bobUsdc);
        console.log("Bob WETH:", bobWeth);
        
        // Alice should have:
        // - Started with 500 USDC, spent 200
        // - Gained 0.0999 WETH (0.1 - 0.1% fee)
        uint256 expectedAliceWeth = amount - (amount * 10 / 10000);
        console.log("Expected Alice WETH:", expectedAliceWeth);
        assertEq(aliceWeth, expectedAliceWeth, "Alice should receive WETH minus fee");
        
        // Bob should have:
        // - Started with 0 USDC
        // - Gained 199.6 USDC (200 - 0.2% fee)
        uint256 expectedBobUsdc = (200 * 10**6) - ((200 * 10**6) * 20 / 10000);
        console.log("Expected Bob USDC:", expectedBobUsdc);
        assertEq(bobUsdc, expectedBobUsdc, "Bob should receive USDC minus fee");
    }
    
    function test_RealWorldExample() public {
        console.log("=== Real World Example ===");
        console.log("Alice wants to buy 0.5 WETH at 1850 USDC per WETH");
        console.log("Bob wants to sell 0.5 WETH at 1850 USDC per WETH");
        
        // Deposit
        vm.prank(alice);
        clob.deposit(address(usdc), 1000 * 10**6); // 1000 USDC
        
        vm.prank(bob);
        clob.deposit(address(weth), 10**18); // 1 WETH
        
        uint256 amount = 5 * 10**17; // 0.5 WETH
        uint256 price = 1850 * 10**6; // 1850 USDC per WETH in USDC decimals
        
        uint256 totalUsdcNeeded = (amount * price) / 10**18;
        console.log("Total USDC needed for 0.5 WETH:", totalUsdcNeeded);
        console.log("In human readable:", totalUsdcNeeded / 10**6, "USDC");
        
        // Place orders
        vm.prank(alice);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOB.OrderType.BUY, price, amount);
        
        vm.prank(bob);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOB.OrderType.SELL, price, amount);
        
        // Check results
        (uint256 aliceWeth,) = clob.getBalance(alice, address(weth));
        (uint256 bobUsdc,) = clob.getBalance(bob, address(usdc));
        
        console.log("\nAfter trade:");
        console.log("Alice received WETH:", aliceWeth);
        console.log("Alice received WETH (human):", aliceWeth / 10**16, "/ 100"); // Display as 0.XX
        console.log("Bob received USDC:", bobUsdc);
        console.log("Bob received USDC (human):", bobUsdc / 10**6, "USDC");
        
        // Verify fees were applied correctly
        uint256 expectedAliceWeth = amount - (amount * 10 / 10000); // 0.5 - 0.05% maker fee
        uint256 expectedBobUsdc = (925 * 10**6) - ((925 * 10**6) * 20 / 10000); // 925 - 0.2% taker fee
        
        assertEq(aliceWeth, expectedAliceWeth, "Alice WETH with maker fee");
        assertEq(bobUsdc, expectedBobUsdc, "Bob USDC with taker fee");
    }
}