// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {OrderBook} from "../../OrderBook.sol";
import {IPerp} from "../../interfaces/IPerp.sol";
import {IOrderBook} from "../../interfaces/IOrderBook.sol";
import {CollateralManager} from "./CollateralManager.sol";

/// @title PerpBook
/// @notice Order book for perpetual trading with collateral-based margin management
/// @dev Inherits OrderBook directly and manages collateral separately from spot tokens
contract PerpBook is OrderBook {
    IPerp public immutable perpContract;
    CollateralManager public immutable collateralManager;
    
    constructor(
        address _perpHook,
        address _perpContract,
        address _collateralManager
    ) OrderBook(_perpHook) {
        perpContract = IPerp(_perpContract);
        collateralManager = CollateralManager(_collateralManager);
    }
    
    /// @notice Place a perpetual order with margin check
    /// @dev Checks available margin before placing order via collateral system
    function placePerpOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) external returns (uint256 orderId) {
        // Calculate required margin for this order
        uint256 orderValue = uint256(amount) * uint256(price) / 1e18;
        uint256 requiredMargin = orderValue * perpContract.getMaintenanceMarginBps() / 10000;
        
        // Check available collateral
        (, uint256 availableMargin) = collateralManager.getUserCollateralValue(msg.sender);
        require(availableMargin >= requiredMargin, "Insufficient collateral");
        
        // Delegate to the parent placeOrder - PerpHook handles margin locking via CollateralManager
        return this.placeOrder(isBuy, price, amount, orderType);
    }
    
    /// @notice Get trader's perp positions
    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return perpContract.getTraderPositions(trader);
    }
    
    /// @notice Get P&L for a position
    function getPositionPnL(uint256 positionId) external view returns (int256) {
        return perpContract.calculatePnL(positionId);
    }
    
    /*//////////////////////////////////////////////////////////////
                        ABSTRACT IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Handle margin locking before placing order
    function _beforePlaceOrder(address trader, bool isBuy, uint128 amount) internal override {
        // Margin validation already done in placePerpOrder
        // Actual margin locking will be handled by PerpHook through CollateralManager
    }
    
    /// @dev Handle margin unlocking before canceling order  
    function _beforeCancelOrder(address trader, bool isBuy, uint128 amount) internal override {
        // Margin unlocking will be handled by PerpHook through CollateralManager
        // when the order is actually canceled
    }
    
    /// @dev Handle position updates after a match
    function _afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bool buyOrderIsTaker,
        uint128 feeOverride
    ) internal override {
        // Position updates, P&L calculations, and margin adjustments
        // are handled by PerpHook through CollateralManager and perpContract
    }
    
    /*//////////////////////////////////////////////////////////////
                        COLLATERAL OPERATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deposit collateral for trading
    /// @param token Collateral token address
    /// @param amount Amount to deposit
    function depositCollateral(address token, uint256 amount) external {
        collateralManager.depositCollateral(token, amount);
    }
    
    /// @notice Withdraw collateral
    /// @param token Collateral token address
    /// @param amount Amount to withdraw
    function withdrawCollateral(address token, uint256 amount) external {
        collateralManager.withdrawCollateral(token, amount);
    }
    
    /// @notice Get user's collateral status
    /// @param user User address
    /// @return totalValue Total collateral value in USD
    /// @return availableValue Available collateral value in USD
    function getUserCollateral(address user) external view returns (
        uint256 totalValue,
        uint256 availableValue
    ) {
        return collateralManager.getUserCollateralValue(user);
    }
    
    /// @notice Check if user's margin is healthy
    /// @param user User address
    /// @return isHealthy Whether the position is healthy
    /// @return marginRatio Current margin ratio
    function checkMarginHealth(address user) external view returns (
        bool isHealthy,
        uint256 marginRatio
    ) {
        // Get total position value from perpContract
        uint256[] memory positions = perpContract.getTraderPositions(user);
        uint256 totalPositionValue = 0;
        
        for (uint256 i = 0; i < positions.length; i++) {
            // This would need to be implemented based on the actual IPerp interface
            // For now, using a placeholder calculation
            totalPositionValue += 100e18; // Placeholder
        }
        
        return collateralManager.checkMarginHealth(user, totalPositionValue);
    }
}