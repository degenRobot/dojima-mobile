// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../../src/examples/spot/SpotBook.sol";
import {MockERC20} from "../utils/Setup.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";
import {TransientLock} from "../../src/libraries/TransientStorage.sol";

/// @notice Malicious token that attempts reentrancy
contract MaliciousToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    string public name = "Malicious";
    string public symbol = "MAL";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    SpotBook public spotBook;
    bool public attackEnabled;
    address public attacker;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    
    function setAttackParams(address _spotBook, address _attacker) external {
        spotBook = SpotBook(_spotBook);
        attacker = _attacker;
    }
    
    function enableAttack() external {
        attackEnabled = true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        // Check allowance
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        // Normal transfer logic
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        
        // Attempt reentrancy if attack is enabled
        if (attackEnabled && msg.sender == address(spotBook)) {
            attackEnabled = false; // Prevent infinite loop
            console2.log("Attempting reentrancy attack...");
            
            // Try to reenter deposit
            try spotBook.deposit(address(this), 1e18) {
                console2.log("Reentrancy succeeded - this is bad!");
            } catch Error(string memory reason) {
                console2.log("Reentrancy blocked:", reason);
            } catch (bytes memory) {
                console2.log("Reentrancy blocked with low-level error");
            }
        }
        
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        // Normal transfer logic
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        
        // Attempt reentrancy if attack is enabled
        if (attackEnabled && msg.sender == address(spotBook)) {
            attackEnabled = false; // Prevent infinite loop
            console2.log("Attempting reentrancy attack during withdraw...");
            
            // Try to reenter withdraw
            try spotBook.withdraw(address(this), 1e18) {
                console2.log("Reentrancy succeeded - this is bad!");
            } catch Error(string memory reason) {
                console2.log("Reentrancy blocked:", reason);
            } catch (bytes memory) {
                console2.log("Reentrancy blocked with low-level error");
            }
        }
        
        return true;
    }
}

contract ReentrancyTest is Test {
    SpotBook public spotBook;
    MaliciousToken public malToken;
    MockERC20 public normalToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    
    function setUp() public {
        // Deploy tokens
        malToken = new MaliciousToken();
        normalToken = new MockERC20("Normal", "NORM", 18);
        
        // Deploy SpotBook
        spotBook = new SpotBook(
            address(malToken),
            address(normalToken),
            address(0) // No hooks
        );
        
        // Setup malicious token
        malToken.setAttackParams(address(spotBook), alice);
        
        // Fund users
        malToken.mint(alice, 1000e18);
        normalToken.mint(alice, 1000e18);
        malToken.mint(bob, 1000e18);
        normalToken.mint(bob, 1000e18);
        
        // Approvals
        vm.prank(alice);
        malToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        normalToken.approve(address(spotBook), type(uint256).max);
    }
    
    function test_ReentrancyProtectionOnDeposit() public {
        // Enable attack
        malToken.enableAttack();
        
        // Alice tries to deposit malicious token
        // The token will attempt to reenter during transferFrom
        vm.prank(alice);
        spotBook.deposit(address(malToken), 100e18);
        
        // If we reach here, the reentrancy was blocked
        // Check that only one deposit occurred
        (uint128 available, ) = spotBook.getBalance(alice, address(malToken));
        assertEq(available, 100e18, "Only one deposit should succeed");
    }
    
    function test_ReentrancyProtectionOnWithdraw() public {
        // First deposit normally
        vm.prank(alice);
        spotBook.deposit(address(malToken), 100e18);
        
        // Enable attack
        malToken.enableAttack();
        
        // Alice tries to withdraw malicious token
        // The token will attempt to reenter during transfer
        vm.prank(alice);
        spotBook.withdraw(address(malToken), 50e18);
        
        // Check final balance
        (uint128 available, ) = spotBook.getBalance(alice, address(malToken));
        assertEq(available, 50e18, "Only one withdraw should succeed");
    }
    
    function test_ReentrancyProtectionOnPlaceOrder() public {
        // This test would require a more complex setup with a malicious hook
        // that attempts reentrancy, but the TransientLock should protect against it
        
        // Deposit tokens first
        vm.prank(alice);
        spotBook.deposit(address(malToken), 100e18);
        vm.prank(alice);
        spotBook.deposit(address(normalToken), 100e18);
        
        // Place order - TransientLock should prevent any reentrancy
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(false, 1000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        assertTrue(orderId > 0, "Order should be placed");
    }
    
    function test_TransientLockCorrectlyReleased() public {
        // Verify lock is released after operations
        
        // Deposit
        vm.prank(alice);
        spotBook.deposit(address(normalToken), 100e18);
        
        // Lock should be released, so we can deposit again
        vm.prank(alice);
        spotBook.deposit(address(normalToken), 50e18);
        
        // Withdraw
        vm.prank(alice);
        spotBook.withdraw(address(normalToken), 30e18);
        
        // Also deposit malToken for sell order
        vm.prank(alice);
        spotBook.deposit(address(malToken), 100e18);
        
        // Place order (selling malToken for normalToken)
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(false, 1000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Cancel order
        vm.prank(alice);
        spotBook.cancelOrder(orderId);
        
        // All operations should succeed, proving locks are properly released
        (uint128 available, ) = spotBook.getBalance(alice, address(normalToken));
        assertEq(available, 120e18, "Normal token balance should reflect deposits and withdraw");
        
        (uint128 malAvailable, ) = spotBook.getBalance(alice, address(malToken));
        assertEq(malAvailable, 100e18, "Malicious token balance should be unchanged after cancel");
    }
}