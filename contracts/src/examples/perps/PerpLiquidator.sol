// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IPerp} from "../../interfaces/IPerp.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title PerpLiquidator
/// @notice Handles liquidations for perpetual positions
/// @dev Implements partial and full liquidation logic with liquidator incentives
contract PerpLiquidator {
    using FixedPointMathLib for uint256;
    
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Health factor below this triggers liquidation (1.2 = 120%)
    uint256 public constant LIQUIDATION_THRESHOLD = 1.2e18;
    
    /// @notice Liquidator receives this percentage of liquidated position (5%)
    uint256 public constant LIQUIDATOR_REWARD = 0.05e18;
    
    /// @notice Maximum position that can be liquidated in one tx (50%)
    uint256 public constant MAX_LIQUIDATION_PERCENT = 0.5e18;
    
    /// @notice Minimum health factor improvement required
    uint256 public constant MIN_HEALTH_IMPROVEMENT = 0.1e18;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Reference to the Perp contract
    IPerp public immutable perp;
    
    /// @notice Insurance fund to cover bad debt
    address public insuranceFund;
    
    /// @notice Total liquidations executed
    uint256 public totalLiquidations;
    
    /// @notice Liquidation events
    event PositionLiquidated(
        address indexed account,
        address indexed liquidator,
        uint256 positionId,
        uint256 amountLiquidated,
        uint256 liquidatorReward,
        uint256 healthFactorBefore,
        uint256 healthFactorAfter
    );
    
    event BadDebtCovered(
        address indexed account,
        uint256 amount
    );
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(address _perp, address _insuranceFund) {
        perp = IPerp(_perp);
        insuranceFund = _insuranceFund;
    }
    
    /*//////////////////////////////////////////////////////////////
                          LIQUIDATION LOGIC
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Check if an account is liquidatable
    /// @param account The account to check
    /// @return liquidatable Whether the account can be liquidated
    /// @return healthFactor The current health factor
    function isLiquidatable(address account) public view returns (bool liquidatable, uint256 healthFactor) {
        // Get account health from Perp contract
        IPerp.AccountHealth memory health = perp.getAccountHealth(account);
        
        // Account is liquidatable if health factor < threshold
        if (health.marginUsed == 0) return (false, type(uint256).max);
        
        // Health factor = totalValue / marginUsed
        // If totalValue is negative, health factor is 0
        if (health.totalValue <= 0) {
            return (true, 0);
        }
        
        healthFactor = uint256(health.totalValue).divWad(health.marginUsed);
        liquidatable = healthFactor < LIQUIDATION_THRESHOLD;
    }
    
    /// @notice Liquidate a position
    /// @param account The account to liquidate
    /// @param positionId The position to liquidate
    /// @param maxAmount Maximum amount to liquidate
    function liquidatePosition(
        address account,
        uint256 positionId,
        uint256 maxAmount
    ) external {
        // Check if liquidatable
        (bool liquidatable, uint256 healthBefore) = isLiquidatable(account);
        require(liquidatable, "Account not liquidatable");
        
        // Get position details
        IPerp.Position memory position = perp.getPosition(positionId);
        require(position.trader == account, "Position not owned by account");
        require(position.size > 0, "Position already closed");
        
        // Calculate liquidation amount (max 50% of position)
        uint256 liquidationAmount = uint256(position.size).mulWad(MAX_LIQUIDATION_PERCENT);
        if (maxAmount < liquidationAmount) {
            liquidationAmount = maxAmount;
        }
        
        // Calculate liquidator reward
        uint256 liquidatorReward = liquidationAmount.mulWad(LIQUIDATOR_REWARD);
        
        // Execute liquidation in Perp contract
        perp.liquidatePosition(positionId, liquidationAmount, msg.sender);
        
        // Check health improvement
        (, uint256 healthAfter) = isLiquidatable(account);
        require(
            healthAfter > healthBefore + MIN_HEALTH_IMPROVEMENT || healthAfter >= LIQUIDATION_THRESHOLD,
            "Insufficient health improvement"
        );
        
        // Update stats
        totalLiquidations++;
        
        emit PositionLiquidated(
            account,
            msg.sender,
            positionId,
            liquidationAmount,
            liquidatorReward,
            healthBefore,
            healthAfter
        );
    }
    
    /// @notice Liquidate all positions of an account
    /// @param account The account to liquidate
    function liquidateAccount(address account) external {
        // Check if liquidatable
        (bool liquidatable, ) = isLiquidatable(account);
        require(liquidatable, "Account not liquidatable");
        
        // Get all positions
        uint256[] memory positionIds = perp.getAccountPositions(account);
        
        // Liquidate each position
        for (uint256 i = 0; i < positionIds.length; i++) {
            IPerp.Position memory position = perp.getPosition(positionIds[i]);
            if (position.size > 0) {
                this.liquidatePosition(account, positionIds[i], position.size);
            }
        }
    }
    
    /// @notice Cover bad debt using insurance fund
    /// @param account The account with bad debt
    function coverBadDebt(address account) external {
        // Get account health
        IPerp.AccountHealth memory health = perp.getAccountHealth(account);
        
        // Only cover if account has negative value
        require(health.totalValue < 0, "No bad debt to cover");
        
        uint256 badDebt = uint256(-health.totalValue);
        
        // Transfer from insurance fund to cover bad debt
        // Note: In production, this would interact with insurance fund contract
        perp.coverBadDebt(account, badDebt);
        
        emit BadDebtCovered(account, badDebt);
    }
    
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Calculate liquidation price for a position
    /// @param positionId The position ID
    /// @return liquidationPrice The price at which position becomes liquidatable
    function getLiquidationPrice(uint256 positionId) external view returns (uint256 liquidationPrice) {
        IPerp.Position memory position = perp.getPosition(positionId);
        require(position.size > 0, "Position closed");
        
        // Liquidation price depends on:
        // 1. Position size and direction
        // 2. Account's total collateral
        // 3. Other positions
        
        // Simplified calculation for single position
        // Real implementation would consider all positions
        uint256 maintenanceMargin = uint256(position.size).mulWad(perp.getMaintenanceMarginBps() * 1e14);
        
        if (position.isLong) {
            // Long position liquidated when price falls
            // Liquidation Price = Entry Price - (Collateral - Maintenance Margin) / Size
            liquidationPrice = position.entryPrice - 
                ((position.margin - maintenanceMargin).divWad(position.size));
        } else {
            // Short position liquidated when price rises
            // Liquidation Price = Entry Price + (Collateral - Maintenance Margin) / Size
            liquidationPrice = position.entryPrice + 
                ((position.margin - maintenanceMargin).divWad(position.size));
        }
    }
    
    /// @notice Get liquidatable accounts
    /// @param limit Maximum number of accounts to return
    /// @return accounts Array of liquidatable accounts
    function getLiquidatableAccounts(uint256 limit) external view returns (address[] memory accounts) {
        // In production, this would query an off-chain index
        // For now, return empty array
        accounts = new address[](0);
    }
}