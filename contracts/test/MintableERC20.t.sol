// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract MintableERC20Test is Test {
    MintableERC20 public token;
    MintableERC20 public usdcToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    
    event TokensMinted(address indexed account, uint256 amount);
    
    function setUp() public {
        token = new MintableERC20("Test Token", "TEST", 18);
        usdcToken = new MintableERC20("USD Coin", "USDC", 6);
    }
    
    function test_TokenMetadata() public {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 18);
        
        assertEq(usdcToken.name(), "USD Coin");
        assertEq(usdcToken.symbol(), "USDC");
        assertEq(usdcToken.decimals(), 6);
    }
    
    function test_MintOnce() public {
        // Alice mints tokens
        vm.expectEmit(true, false, false, true);
        emit TokensMinted(alice, 1000e18);
        
        vm.prank(alice);
        token.mintOnce();
        
        assertEq(token.balanceOf(alice), 1000e18);
        assertTrue(token.hasMinted(alice));
    }
    
    function test_MintOnceWithDifferentDecimals() public {
        // Alice mints USDC (6 decimals)
        vm.expectEmit(true, false, false, true);
        emit TokensMinted(alice, 1000e6);
        
        vm.prank(alice);
        usdcToken.mintOnce();
        
        assertEq(usdcToken.balanceOf(alice), 1000e6);
        assertTrue(usdcToken.hasMinted(alice));
    }
    
    function test_CannotMintTwice() public {
        // Alice mints once
        vm.prank(alice);
        token.mintOnce();
        
        // Try to mint again - should fail
        vm.prank(alice);
        vm.expectRevert("Already minted");
        token.mintOnce();
    }
    
    function test_MultipleUsersCanMint() public {
        // Alice mints
        vm.prank(alice);
        token.mintOnce();
        assertEq(token.balanceOf(alice), 1000e18);
        
        // Bob mints
        vm.prank(bob);
        token.mintOnce();
        assertEq(token.balanceOf(bob), 1000e18);
        
        // Both have minted
        assertTrue(token.hasMinted(alice));
        assertTrue(token.hasMinted(bob));
        
        // Total supply is correct
        assertEq(token.totalSupply(), 2000e18);
    }
    
    function test_DirectMint() public {
        // Direct mint function (for testing/initial setup)
        token.mint(alice, 5000e18);
        assertEq(token.balanceOf(alice), 5000e18);
        
        // Can still use mintOnce after direct mint
        vm.prank(alice);
        token.mintOnce();
        assertEq(token.balanceOf(alice), 6000e18);
    }
    
    function test_TransferFunctionality() public {
        // Alice mints tokens
        vm.prank(alice);
        token.mintOnce();
        
        // Alice transfers to Bob
        vm.prank(alice);
        token.transfer(bob, 100e18);
        
        assertEq(token.balanceOf(alice), 900e18);
        assertEq(token.balanceOf(bob), 100e18);
    }
    
    function test_ApproveFunctionality() public {
        // Alice mints tokens
        vm.prank(alice);
        token.mintOnce();
        
        // Alice approves Bob
        vm.prank(alice);
        token.approve(bob, 500e18);
        
        assertEq(token.allowance(alice, bob), 500e18);
        
        // Bob transfers from Alice
        vm.prank(bob);
        token.transferFrom(alice, bob, 300e18);
        
        assertEq(token.balanceOf(alice), 700e18);
        assertEq(token.balanceOf(bob), 300e18);
        assertEq(token.allowance(alice, bob), 200e18);
    }
    
    function testFuzz_MintOnceAmount(uint8 decimals) public {
        vm.assume(decimals <= 18);
        
        MintableERC20 testToken = new MintableERC20("Fuzz Token", "FUZZ", decimals);
        
        vm.prank(alice);
        testToken.mintOnce();
        
        uint256 expectedAmount = decimals < 18 ? 1000 * 10**decimals : 1000e18;
        assertEq(testToken.balanceOf(alice), expectedAmount);
    }
}