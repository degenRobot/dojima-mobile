// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {UnifiedCLOB} from "../src/UnifiedCLOB.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract UnifiedCLOBDecimalsTest is Test {
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
        
        // Mint tokens - using mintOnce() like in our deployment
        vm.prank(alice);
        usdc.mintOnce(); // Should give 1000 USDC with 6 decimals = 1000 * 10^6
        
        vm.prank(alice);
        weth.mintOnce(); // Should give 1000 WETH with 18 decimals = 1000 * 10^18
        
        vm.prank(bob);
        usdc.mintOnce();
        
        vm.prank(bob);
        weth.mintOnce();
        
        // Approve CLOB
        vm.prank(alice);
        usdc.approve(address(clob), type(uint256).max);
        vm.prank(alice);
        weth.approve(address(clob), type(uint256).max);
        
        vm.prank(bob);
        usdc.approve(address(clob), type(uint256).max);
        vm.prank(bob);
        weth.approve(address(clob), type(uint256).max);
    }
    
    function test_TokenBalancesAfterMint() public {
        console.log("Alice USDC balance:", usdc.balanceOf(alice));
        console.log("Alice WETH balance:", weth.balanceOf(alice));
        console.log("Bob USDC balance:", usdc.balanceOf(bob));
        console.log("Bob WETH balance:", weth.balanceOf(bob));
        
        assertEq(usdc.balanceOf(alice), 1000 * 10**6, "Alice should have 1000 USDC");
        assertEq(weth.balanceOf(alice), 1000 * 10**18, "Alice should have 1000 WETH");
    }
    
    function test_DepositWithRealDecimals() public {
        uint256 depositUsdcAmount = 500 * 10**6; // 500 USDC with 6 decimals
        uint256 depositWethAmount = 1 * 10**18; // 1 WETH with 18 decimals
        
        console.log("Depositing USDC amount:", depositUsdcAmount);
        console.log("Depositing WETH amount:", depositWethAmount);
        
        vm.prank(alice);
        clob.deposit(address(usdc), depositUsdcAmount);
        
        vm.prank(alice);
        clob.deposit(address(weth), depositWethAmount);
        
        (uint256 availableUsdc, uint256 lockedUsdc) = clob.getBalance(alice, address(usdc));
        (uint256 availableWeth, uint256 lockedWeth) = clob.getBalance(alice, address(weth));
        
        console.log("Alice CLOB USDC available:", availableUsdc);
        console.log("Alice CLOB USDC locked:", lockedUsdc);
        console.log("Alice CLOB WETH available:", availableWeth);
        console.log("Alice CLOB WETH locked:", lockedWeth);
        
        assertEq(availableUsdc, depositUsdcAmount, "USDC should be available");
        assertEq(availableWeth, depositWethAmount, "WETH should be available");
    }
    
    function test_PlaceOrderWithRealDecimals() public {
        // Deposit first
        vm.prank(alice);
        clob.deposit(address(usdc), 500 * 10**6); // 500 USDC
        
        // Try to place a buy order for 0.1 WETH at 2000 USDC per WETH
        uint256 amount = 10**17; // 0.1 WETH (0.1 * 10^18)
        uint256 price = 2000 * 10**18; // Price is always in 18 decimals
        
        console.log("=== Placing Buy Order ===");
        console.log("Amount (0.1 WETH):", amount);
        console.log("Price (2000 USDC per WETH):", price);
        
        // Calculate expected quote amount
        uint256 expectedQuoteAmount = (amount * price) / 10**18;
        console.log("Expected quote amount needed:", expectedQuoteAmount);
        uint256 aliceAvailableUsdc = 500 * 10**6;
        console.log("Alice's available USDC:", aliceAvailableUsdc);
        
        // This should work if quote amount <= available balance
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            price,
            amount
        );
        
        console.log("Order ID:", orderId);
        
        // Check balance after order
        (uint256 availableUsdc, uint256 lockedUsdc) = clob.getBalance(alice, address(usdc));
        console.log("After order - Available USDC:", availableUsdc);
        console.log("After order - Locked USDC:", lockedUsdc);
        
        assertEq(lockedUsdc, expectedQuoteAmount, "Locked amount should match expected");
    }
    
    function test_OrderMatchingWithRealDecimals() public {
        // Setup: Both users deposit
        vm.prank(alice);
        clob.deposit(address(usdc), 500 * 10**6); // Alice deposits 500 USDC
        
        vm.prank(bob);
        clob.deposit(address(weth), 1 * 10**18); // Bob deposits 1 WETH
        
        console.log("\n=== Initial Balances ===");
        (uint256 aliceUsdcAvail, uint256 aliceUsdcLocked) = clob.getBalance(alice, address(usdc));
        (uint256 bobWethAvail, uint256 bobWethLocked) = clob.getBalance(bob, address(weth));
        console.log("Alice USDC available:", aliceUsdcAvail);
        console.log("Bob WETH available:", bobWethAvail);
        
        // Alice places buy order for 0.1 WETH at 2000 USDC
        uint256 amount = 10**17; // 0.1 * 10^18
        uint256 price = 2000 * 10**18;
        
        console.log("\n=== Alice Places Buy Order ===");
        console.log("Buying 0.1 WETH at 2000 USDC per WETH");
        console.log("Quote needed: (0.1 * 2000) =", (amount * price) / 10**18);
        
        vm.prank(alice);
        uint256 buyOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            price,
            amount
        );
        
        // Check Alice's balance after placing order
        (aliceUsdcAvail, aliceUsdcLocked) = clob.getBalance(alice, address(usdc));
        console.log("After buy order - Alice USDC available:", aliceUsdcAvail);
        console.log("After buy order - Alice USDC locked:", aliceUsdcLocked);
        
        // Bob places matching sell order
        console.log("\n=== Bob Places Sell Order ===");
        vm.prank(bob);
        uint256 sellOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            price,
            amount
        );
        
        // Check final balances
        console.log("\n=== After Matching ===");
        
        (uint256 aliceFinalUsdcAvail,) = clob.getBalance(alice, address(usdc));
        (uint256 aliceFinalWethAvail,) = clob.getBalance(alice, address(weth));
        (uint256 bobFinalUsdcAvail,) = clob.getBalance(bob, address(usdc));
        (uint256 bobFinalWethAvail,) = clob.getBalance(bob, address(weth));
        
        console.log("Alice USDC:", aliceFinalUsdcAvail);
        console.log("Alice WETH:", aliceFinalWethAvail);
        console.log("Bob USDC:", bobFinalUsdcAvail);
        console.log("Bob WETH:", bobFinalWethAvail);
        
        // Alice should have:
        // - Lost 200 USDC (0.1 * 2000)
        // - Gained 0.0999 WETH (0.1 - 0.1% maker fee)
        // Bob should have:
        // - Gained 199.6 USDC (200 - 0.2% taker fee)
        // - Lost 0.1 WETH
        
        uint256 expectedAliceWeth = amount - (amount * 10 / 10000); // 0.1 - 0.1% fee
        uint256 expectedBobUsdc = ((amount * price) / 10**18) - (((amount * price) / 10**18) * 20 / 10000); // 200 - 0.2% fee
        
        console.log("\nExpected Alice WETH:", expectedAliceWeth);
        console.log("Expected Bob USDC:", expectedBobUsdc);
        
        assertEq(aliceFinalWethAvail, expectedAliceWeth, "Alice should receive WETH minus maker fee");
        assertEq(bobFinalUsdcAvail, expectedBobUsdc, "Bob should receive USDC minus taker fee");
    }
    
    function test_DebugQuoteCalculation() public {
        // Test the exact calculation that happens in placeOrder
        uint256 amount = 10**17; // 0.1 WETH (0.1 * 10^18)
        uint256 price = 2000 * 10**18; // 2000 USDC per WETH
        
        uint256 quoteAmount = (amount * price) / 10**18;
        
        console.log("=== Quote Calculation Debug ===");
        console.log("Amount (0.1 WETH in wei):", amount);
        console.log("Price (2000 in wei):", price);
        console.log("Quote amount calculated:", quoteAmount);
        console.log("Quote amount in USDC decimals:", quoteAmount / 10**12); // Convert to 6 decimals for display
        
        // The issue: quoteAmount is 200 * 10^18, but USDC only has 6 decimals!
        // So we're trying to lock 200 * 10^18 when we only have 500 * 10^6
        
        assertEq(quoteAmount, 200 * 10**18, "Quote calculation issue");
    }
}