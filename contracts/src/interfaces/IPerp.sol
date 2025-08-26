// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IPerp
/// @notice Interface for perpetual position management
interface IPerp {
    /// @notice Perpetual position details
    struct Position {
        uint128 size;          // Position size in base asset
        uint128 entryPrice;    // Average entry price
        bool isLong;           // True for long, false for short
        uint256 timestamp;     // Position open timestamp
        int256 unrealizedPnL;  // Current unrealized P&L
        address trader;        // Position owner
        uint256 margin;        // Margin/collateral for position
    }
    
    /// @notice Account health information
    struct AccountHealth {
        int256 totalValue;      // Collateral + unrealized P&L
        uint256 marginUsed;     // Margin locked in positions
        uint256 availableMargin; // Available for new orders
        uint256 healthFactor;   // totalValue / marginUsed
    }
    
    /// @notice Events
    event PositionOpened(uint256 indexed positionId, address indexed trader, uint128 size, uint128 price, bool isLong);
    event PositionClosed(uint256 indexed positionId, address indexed trader, int256 realizedPnL);
    event PositionModified(uint256 indexed positionId, uint128 newSize, uint128 newAvgPrice);
    
    /// @notice Open a new position or add to existing
    /// @param trader The trader address
    /// @param size Position size
    /// @param price Entry price
    /// @param isLong Whether long or short
    /// @return positionId The position ID
    function openPosition(
        address trader,
        uint128 size,
        uint128 price,
        bool isLong
    ) external returns (uint256 positionId);
    
    /// @notice Get position details
    /// @param positionId The position ID
    /// @return position The position details
    function getPosition(uint256 positionId) external view returns (Position memory position);
    
    /// @notice Calculate current P&L for a position
    /// @param positionId The position ID
    /// @return pnl The unrealized P&L
    function calculatePnL(uint256 positionId) external view returns (int256 pnl);
    
    /// @notice Get all positions for a trader
    /// @param trader The trader address
    /// @return positionIds Array of position IDs
    function getTraderPositions(address trader) external view returns (uint256[] memory positionIds);
    
    /// @notice Get account health information
    /// @param trader The trader address
    /// @return health Account health metrics
    function getAccountHealth(address trader) external view returns (AccountHealth memory health);
    
    /// @notice Get all positions for an account
    /// @param trader The trader address  
    /// @return positionIds Array of position IDs
    function getAccountPositions(address trader) external view returns (uint256[] memory positionIds);
    
    /// @notice Liquidate a position
    /// @param positionId The position to liquidate
    /// @param amountToLiquidate Amount to liquidate
    /// @param liquidatorAddress The liquidator address
    function liquidatePosition(uint256 positionId, uint256 amountToLiquidate, address liquidatorAddress) external;
    
    /// @notice Cover bad debt for an account
    /// @param account The account with bad debt
    /// @param amount The bad debt amount
    function coverBadDebt(address account, uint256 amount) external;
    
    /// @notice Get maintenance margin requirement in basis points
    function getMaintenanceMarginBps() external view returns (uint256);
}