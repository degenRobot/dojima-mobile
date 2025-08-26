// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IPerp} from "../../interfaces/IPerp.sol";
import {IOracle} from "../../interfaces/IOracle.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title Perp
/// @notice Perpetual position management contract with liquidation support
contract Perp is IPerp {
    using FixedPointMathLib for uint256;
    using FixedPointMathLib for int256;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    IOracle public immutable oracle;
    uint256 public nextPositionId = 1;
    
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public traderPositions;
    mapping(address => mapping(bool => uint256)) public aggregatedPositions; // trader => isLong => positionId
    
    // Account health tracking
    mapping(address => AccountInfo) public accountInfo;
    
    // Risk parameters
    uint256 public constant initialMarginBps = 1000; // 10%
    uint256 public constant maintenanceMarginBps = 500; // 5%
    uint256 public constant maxLeverage = 10e18; // 10x
    
    // Liquidation tracking
    address public liquidator;
    
    // New structs for account management
    struct AccountInfo {
        uint256 collateral;
        int256 unrealizedPnL;
        uint256 marginUsed;
    }
    
    // Events
    event CollateralDeposited(address indexed trader, uint256 amount);
    event CollateralWithdrawn(address indexed trader, uint256 amount);
    event PositionLiquidated(uint256 indexed positionId, address indexed liquidator, uint256 sizeLiquidated);
    
    // Modifiers
    modifier onlyLiquidator() {
        require(msg.sender == liquidator, "Only liquidator");
        _;
    }
    
    // Constructor
    constructor(address _oracle) {
        oracle = IOracle(_oracle);
    }
    
    /// @inheritdoc IPerp
    function openPosition(
        address trader,
        uint128 size,
        uint128 price,
        bool isLong
    ) external returns (uint256 positionId) {
        require(size > 0, "Invalid size");
        require(price > 0, "Invalid price");
        
        // Check if trader has existing position in same direction
        positionId = aggregatedPositions[trader][isLong];
        
        if (positionId == 0) {
            // Create new position
            positionId = nextPositionId++;
            positions[positionId] = Position({
                size: size,
                entryPrice: price,
                isLong: isLong,
                timestamp: block.timestamp,
                unrealizedPnL: 0,
                trader: trader,
                margin: uint256(size).mulWad(price).mulWad(initialMarginBps * 1e14)
            });
            
            traderPositions[trader].push(positionId);
            aggregatedPositions[trader][isLong] = positionId;
            
            emit PositionOpened(positionId, trader, size, price, isLong);
        } else {
            // Add to existing position
            Position storage position = positions[positionId];
            
            // Calculate new average entry price
            uint256 totalValue = uint256(position.size).mulWad(position.entryPrice) + 
                                uint256(size).mulWad(price);
            uint256 newSize = uint256(position.size) + uint256(size);
            uint128 newAvgPrice = uint128(totalValue.divWad(newSize));
            
            position.size = uint128(newSize);
            position.entryPrice = newAvgPrice;
            
            emit PositionModified(positionId, position.size, newAvgPrice);
        }
    }
    
    /// @inheritdoc IPerp
    function getPosition(uint256 positionId) external view returns (Position memory) {
        Position memory position = positions[positionId];
        // Update unrealized PnL
        position.unrealizedPnL = _calculatePnL(position);
        return position;
    }
    
    /// @inheritdoc IPerp
    function calculatePnL(uint256 positionId) external view returns (int256) {
        return _calculatePnL(positions[positionId]);
    }
    
    /// @inheritdoc IPerp
    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }
    
    /// @dev Internal P&L calculation
    function _calculatePnL(Position memory position) internal view returns (int256 pnl) {
        if (position.size == 0) return 0;
        
        uint256 currentPrice = oracle.getLatestPrice();
        uint256 positionValue = uint256(position.size).mulWad(position.entryPrice);
        uint256 currentValue = uint256(position.size).mulWad(currentPrice);
        
        if (position.isLong) {
            // Long position: profit if price goes up
            pnl = int256(currentValue) - int256(positionValue);
        } else {
            // Short position: profit if price goes down
            pnl = int256(positionValue) - int256(currentValue);
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                        COLLATERAL MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deposit collateral
    function depositCollateral(uint256 amount) external {
        accountInfo[msg.sender].collateral += amount;
        emit CollateralDeposited(msg.sender, amount);
    }
    
    /// @notice Withdraw collateral
    function withdrawCollateral(uint256 amount) external {
        IPerp.AccountHealth memory health = getAccountHealth(msg.sender);
        require(health.availableMargin >= amount, "Insufficient available margin");
        
        accountInfo[msg.sender].collateral -= amount;
        emit CollateralWithdrawn(msg.sender, amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                          ACCOUNT HEALTH
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get account health metrics
    function getAccountHealth(address trader) public view returns (IPerp.AccountHealth memory health) {
        AccountInfo memory info = accountInfo[trader];
        
        // Calculate total unrealized PnL
        int256 totalPnL = 0;
        uint256[] memory positionIds = traderPositions[trader];
        uint256 totalMarginUsed = 0;
        
        for (uint256 i = 0; i < positionIds.length; i++) {
            Position memory pos = positions[positionIds[i]];
            if (pos.size > 0) {
                int256 pnl = _calculatePnL(pos);
                totalPnL += pnl;
                
                // Calculate margin used for this position
                uint256 marginRequired = uint256(pos.size).mulWad(pos.entryPrice).mulWad(initialMarginBps * 1e14);
                totalMarginUsed += marginRequired;
            }
        }
        
        // Total value = collateral + unrealized PnL
        health.totalValue = int256(info.collateral) + totalPnL;
        health.marginUsed = totalMarginUsed;
        
        // Available margin = total value - margin used
        if (health.totalValue > int256(totalMarginUsed)) {
            health.availableMargin = uint256(health.totalValue) - totalMarginUsed;
        } else {
            health.availableMargin = 0;
        }
        
        // Health factor = total value / margin used
        if (totalMarginUsed > 0) {
            if (health.totalValue <= 0) {
                health.healthFactor = 0;
            } else {
                health.healthFactor = uint256(health.totalValue).divWad(totalMarginUsed);
            }
        } else {
            health.healthFactor = type(uint256).max;
        }
    }
    
    /// @notice Get all positions for an account
    function getAccountPositions(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }
    
    /// @notice Get maintenance margin requirement
    function getMaintenanceMarginBps() external pure returns (uint256) {
        return maintenanceMarginBps;
    }
    
    /*//////////////////////////////////////////////////////////////
                            LIQUIDATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set liquidator address
    function setLiquidator(address _liquidator) external {
        require(liquidator == address(0), "Liquidator already set");
        liquidator = _liquidator;
    }
    
    /// @notice Liquidate a position
    function liquidatePosition(
        uint256 positionId,
        uint256 amountToLiquidate,
        address liquidatorAddress
    ) external onlyLiquidator {
        Position storage position = positions[positionId];
        require(position.size > 0, "Position closed");
        require(amountToLiquidate <= position.size, "Amount exceeds position");
        
        // Reduce position size
        position.size -= uint128(amountToLiquidate);
        
        // If position fully closed, clean up
        if (position.size == 0) {
            // Remove from trader's position list
            address trader = _findPositionOwner(positionId);
            _removePositionFromTrader(trader, positionId);
            
            // Clear aggregated position if needed
            if (aggregatedPositions[trader][position.isLong] == positionId) {
                aggregatedPositions[trader][position.isLong] = 0;
            }
        }
        
        emit PositionLiquidated(positionId, liquidatorAddress, amountToLiquidate);
    }
    
    /// @notice Cover bad debt (simplified version)
    function coverBadDebt(address account, uint256 amount) external onlyLiquidator {
        // In production, this would interact with insurance fund
        // For now, just reset the account
        accountInfo[account].collateral = 0;
        accountInfo[account].unrealizedPnL = 0;
        accountInfo[account].marginUsed = 0;
    }
    
    /*//////////////////////////////////////////////////////////////
                          INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Find position owner
    function _findPositionOwner(uint256 positionId) internal view returns (address) {
        // In production, we'd maintain a reverse mapping
        // For now, iterate (gas inefficient)
        // This is a simplified implementation
        return address(0);
    }
    
    /// @dev Remove position from trader's list
    function _removePositionFromTrader(address trader, uint256 positionId) internal {
        uint256[] storage positionIds = traderPositions[trader];
        for (uint256 i = 0; i < positionIds.length; i++) {
            if (positionIds[i] == positionId) {
                positionIds[i] = positionIds[positionIds.length - 1];
                positionIds.pop();
                break;
            }
        }
    }
}