// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SafeTransferLib} from "lib/solady/src/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "lib/solady/src/utils/FixedPointMathLib.sol";

/// @title CollateralManager
/// @notice Manages collateral deposits, withdrawals, and margin calculations for perpetual trading
/// @dev Gas-optimized collateral management with support for multiple collateral types
contract CollateralManager {
    using SafeTransferLib for address;
    using FixedPointMathLib for uint256;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    // Packed collateral info for gas efficiency
    struct CollateralInfo {
        uint128 deposited;      // Total deposited amount
        uint128 locked;         // Amount locked in positions
    }
    
    // Collateral configuration
    struct CollateralConfig {
        uint128 marginValue;    // Value in USD per token (18 decimals)
        uint128 liquidationThreshold; // Liquidation threshold (basis points)
        bool enabled;           // Whether this collateral is enabled
    }
    
    // User collateral balances: user => token => info
    mapping(address => mapping(address => CollateralInfo)) public userCollateral;
    
    // Supported collateral tokens
    mapping(address => CollateralConfig) public collateralConfigs;
    address[] public supportedTokens;
    
    // Position collateral requirements: positionId => required margin
    mapping(uint256 => uint256) public positionMargins;
    
    // Access control
    address public owner;
    mapping(address => bool) public perpBooks; // Authorized perp books
    
    // Constants
    uint128 private constant BPS_BASE = 10000;
    uint128 private constant USD_DECIMALS = 18;
    
    // Events
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount);
    event MarginLocked(address indexed user, uint256 positionId, uint256 amount);
    event MarginUnlocked(address indexed user, uint256 positionId, uint256 amount);
    event CollateralConfigured(address indexed token, uint128 marginValue, uint128 liquidationThreshold);
    
    // Errors
    error NotOwner();
    error NotAuthorized();
    error InvalidToken();
    error InsufficientCollateral();
    error InvalidAmount();
    error InvalidConfig();
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor() {
        owner = msg.sender;
    }
    
    /*//////////////////////////////////////////////////////////////
                          ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    modifier onlyAuthorized() {
        if (!perpBooks[msg.sender] && msg.sender != owner) revert NotAuthorized();
        _;
    }
    
    /// @notice Add authorized perp book
    function addPerpBook(address perpBook) external onlyOwner {
        perpBooks[perpBook] = true;
    }
    
    /// @notice Remove authorized perp book  
    function removePerpBook(address perpBook) external onlyOwner {
        perpBooks[perpBook] = false;
    }
    
    /*//////////////////////////////////////////////////////////////
                      COLLATERAL CONFIGURATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Configure a collateral token
    /// @param token Token address
    /// @param marginValue USD value per token (18 decimals)
    /// @param liquidationThreshold Liquidation threshold in basis points
    function configureCollateral(
        address token,
        uint128 marginValue,
        uint128 liquidationThreshold
    ) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        if (liquidationThreshold > BPS_BASE) revert InvalidConfig();
        
        bool isNew = !collateralConfigs[token].enabled;
        
        collateralConfigs[token] = CollateralConfig({
            marginValue: marginValue,
            liquidationThreshold: liquidationThreshold,
            enabled: true
        });
        
        if (isNew) {
            supportedTokens.push(token);
        }
        
        emit CollateralConfigured(token, marginValue, liquidationThreshold);
    }
    
    /// @notice Disable a collateral token
    function disableCollateral(address token) external onlyOwner {
        collateralConfigs[token].enabled = false;
    }
    
    /*//////////////////////////////////////////////////////////////
                        COLLATERAL OPERATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deposit collateral
    /// @param token Collateral token address
    /// @param amount Amount to deposit
    function depositCollateral(address token, uint256 amount) external {
        if (!collateralConfigs[token].enabled) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        
        // Update user balance
        userCollateral[msg.sender][token].deposited += uint128(amount);
        
        // Transfer tokens
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        emit CollateralDeposited(msg.sender, token, amount);
    }
    
    /// @notice Withdraw collateral
    /// @param token Collateral token address  
    /// @param amount Amount to withdraw
    function withdrawCollateral(address token, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        
        CollateralInfo storage info = userCollateral[msg.sender][token];
        uint128 available = info.deposited - info.locked;
        
        if (available < amount) revert InsufficientCollateral();
        
        // Update balance
        info.deposited -= uint128(amount);
        
        // Transfer tokens
        token.safeTransfer(msg.sender, amount);
        
        emit CollateralWithdrawn(msg.sender, token, amount);
    }
    
    /// @notice Lock margin for a position (called by PerpBook)
    /// @param user Trader address
    /// @param positionId Position ID
    /// @param marginRequired Required margin in USD (18 decimals)
    function lockMargin(
        address user,
        uint256 positionId, 
        uint256 marginRequired
    ) external onlyAuthorized {
        // Find best collateral to lock (highest value first)
        address bestToken;
        uint256 bestValue;
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            CollateralConfig memory config = collateralConfigs[token];
            
            if (!config.enabled) continue;
            
            CollateralInfo memory info = userCollateral[user][token];
            uint256 available = info.deposited - info.locked;
            
            if (available > 0) {
                uint256 value = available * config.marginValue / 1e18;
                if (value > bestValue && value >= marginRequired) {
                    bestToken = token;
                    bestValue = value;
                }
            }
        }
        
        if (bestToken == address(0)) revert InsufficientCollateral();
        
        // Calculate tokens needed
        uint256 tokensNeeded = marginRequired * 1e18 / collateralConfigs[bestToken].marginValue;
        
        // Lock the margin
        userCollateral[user][bestToken].locked += uint128(tokensNeeded);
        positionMargins[positionId] = marginRequired;
        
        emit MarginLocked(user, positionId, tokensNeeded);
    }
    
    /// @notice Unlock margin for a position (called by PerpBook)
    /// @param user Trader address
    /// @param positionId Position ID
    function unlockMargin(address user, uint256 positionId) external onlyAuthorized {
        uint256 marginRequired = positionMargins[positionId];
        if (marginRequired == 0) return;
        
        // Find which token was locked (iterate through to find locked amount)
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            CollateralInfo storage info = userCollateral[user][token];
            
            if (info.locked > 0) {
                uint256 tokensLocked = marginRequired * 1e18 / collateralConfigs[token].marginValue;
                
                if (info.locked >= tokensLocked) {
                    info.locked -= uint128(tokensLocked);
                    delete positionMargins[positionId];
                    
                    emit MarginUnlocked(user, positionId, tokensLocked);
                    return;
                }
            }
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get user's total collateral value in USD
    /// @param user User address
    /// @return totalValue Total collateral value
    /// @return availableValue Available (unlocked) collateral value
    function getUserCollateralValue(address user) external view returns (
        uint256 totalValue,
        uint256 availableValue
    ) {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            CollateralConfig memory config = collateralConfigs[token];
            
            if (!config.enabled) continue;
            
            CollateralInfo memory info = userCollateral[user][token];
            
            uint256 tokenValue = info.deposited * config.marginValue / 1e18;
            totalValue += tokenValue;
            
            uint256 availableTokens = info.deposited - info.locked;
            availableValue += availableTokens * config.marginValue / 1e18;
        }
    }
    
    /// @notice Check if user has sufficient margin for liquidation
    /// @param user User address
    /// @param totalPositionValue Total position value in USD
    /// @return isHealthy Whether the position is healthy
    /// @return marginRatio Current margin ratio (collateral / position value)
    function checkMarginHealth(
        address user,
        uint256 totalPositionValue
    ) external view returns (bool isHealthy, uint256 marginRatio) {
        (uint256 totalCollateral,) = this.getUserCollateralValue(user);
        
        if (totalPositionValue == 0) {
            return (true, type(uint256).max);
        }
        
        marginRatio = totalCollateral * BPS_BASE / totalPositionValue;
        
        // Use average liquidation threshold across all collateral
        uint256 weightedThreshold;
        uint256 totalWeight;
        
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            CollateralConfig memory config = collateralConfigs[token];
            
            if (!config.enabled) continue;
            
            uint256 tokenValue = userCollateral[user][token].deposited * config.marginValue / 1e18;
            weightedThreshold += config.liquidationThreshold * tokenValue;
            totalWeight += tokenValue;
        }
        
        uint256 avgThreshold = totalWeight > 0 ? weightedThreshold / totalWeight : 0;
        isHealthy = marginRatio >= avgThreshold;
    }
    
    /// @notice Get supported collateral tokens
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /// @notice Get user's collateral info for a specific token
    function getUserCollateralInfo(address user, address token) external view returns (
        uint128 deposited,
        uint128 locked,
        uint256 value
    ) {
        CollateralInfo memory info = userCollateral[user][token];
        CollateralConfig memory config = collateralConfigs[token];
        
        deposited = info.deposited;
        locked = info.locked;
        value = config.enabled ? deposited * config.marginValue / 1e18 : 0;
    }
}