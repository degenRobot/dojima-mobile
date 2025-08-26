// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @title MintableERC20
/// @notice Demo ERC20 token with one-time mint function for testing
/// @dev Each address can mint tokens only once
contract MintableERC20 is ERC20 {
    uint256 public constant MINT_AMOUNT = 1000 * 10**18; // 1000 tokens
    
    mapping(address => bool) public hasMinted;
    
    uint8 private immutable _decimals;
    
    event TokensMinted(address indexed account, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    /// @notice Mint tokens to the caller (can only be called once per address)
    /// @dev Mints a fixed amount of tokens to simplify testing
    function mintOnce() external {
        require(!hasMinted[msg.sender], "Already minted");
        hasMinted[msg.sender] = true;
        
        uint256 amount = MINT_AMOUNT;
        if (_decimals < 18) {
            // Adjust amount for tokens with fewer decimals (like USDC with 6)
            amount = 1000 * 10**_decimals;
        }
        
        _mint(msg.sender, amount);
        emit TokensMinted(msg.sender, amount);
    }
    
    /// @notice Get the number of decimals for this token
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /// @notice Mint tokens to a specific address (for initial setup/testing)
    /// @dev Only for demo purposes - in production this would be restricted
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}