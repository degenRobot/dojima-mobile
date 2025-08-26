// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IOracle
/// @notice Interface for price oracle used by perpetual contracts
interface IOracle {
    /// @notice Get the latest price
    /// @return price The latest price with 18 decimals
    function getLatestPrice() external view returns (uint256 price);
    
    /// @notice Set the latest price (only for testing)
    /// @param price The new price with 18 decimals
    function setLatestPrice(uint256 price) external;
    
    /// @notice Event emitted when price is updated
    event PriceUpdated(uint256 price, uint256 timestamp);
}