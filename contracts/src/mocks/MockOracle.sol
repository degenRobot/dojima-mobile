// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IOracle} from "../interfaces/IOracle.sol";

/// @title MockOracle
/// @notice Mock oracle for testing perpetual contracts
contract MockOracle is IOracle {
    uint256 private latestPrice;
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(uint256 _initialPrice) {
        owner = msg.sender;
        latestPrice = _initialPrice;
        emit PriceUpdated(_initialPrice, block.timestamp);
    }
    
    /// @inheritdoc IOracle
    function getLatestPrice() external view returns (uint256) {
        return latestPrice;
    }
    
    /// @inheritdoc IOracle
    function setLatestPrice(uint256 price) external onlyOwner {
        latestPrice = price;
        emit PriceUpdated(price, block.timestamp);
    }
}