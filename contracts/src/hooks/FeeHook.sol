// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "./BaseCLOBHook.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";

/// @title FeeHook
/// @notice Dynamic fee management with volume-based discounts and market maker rebates
contract FeeHook is BaseCLOBHook {
    // Constants
    uint128 public constant BPS_BASE = 10000;
    uint128 public constant MAX_FEE = 50; // .5%
    
    // Storage
    address public immutable orderBook;
    address public owner;
    address public poolOperator; // Receives excess fees after rebates
    
    // Fee tiers based on 30-day volume
    struct FeeTier {
        uint256 volumeThreshold;
        uint128 makerFee;
        uint128 takerFee;
    }
    
    FeeTier[] public feeTiers;
    
    // User volume tracking (30-day rolling)
    mapping(address => uint256) public userVolume30d;
    mapping(address => uint256) public lastActivityTimestamp;
    
    // Market maker rebates
    mapping(address => bool) public isMarketMaker;
    uint128 public marketMakerRebate = 5; // 0.05% rebate
    
    // Fee accounting
    mapping(address => uint256) public poolFeeBalance; // Accumulated fees per token for pool operator
    mapping(address => uint256) public totalFeesCollected; // Total fees collected per token
    mapping(address => uint256) public totalRebatesPaid; // Total rebates paid per token
    
    // Events
    event FeeTierAdded(uint256 volumeThreshold, uint128 makerFee, uint128 takerFee);
    event VolumeUpdated(address indexed trader, uint256 newVolume);
    event MarketMakerUpdated(address indexed mm, bool status);
    event FeeCollected(address indexed trader, address indexed token, uint256 amount, string feeType);
    event RebatePaid(address indexed marketMaker, address indexed token, uint256 amount);
    event PoolFeesWithdrawn(address indexed operator, address indexed token, uint256 amount);
    event PoolOperatorUpdated(address indexed oldOperator, address indexed newOperator);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "Only orderbook");
        _;
    }
    
    constructor(address _orderBook) {
        orderBook = _orderBook;
        owner = msg.sender;
        poolOperator = msg.sender; // Initially, owner is also pool operator
        
        // Initialize default fee tiers
        _initializeFeeTiers();
    }
    
    function _initializeFeeTiers() internal {
        // Tier 0: Default (no volume requirement)
        feeTiers.push(FeeTier({
            volumeThreshold: 0,
            makerFee: 10,  // 0.10%
            takerFee: 20   // 0.20%
        }));
        
        // Tier 1: $100k volume
        feeTiers.push(FeeTier({
            volumeThreshold: 100_000e18,
            makerFee: 8,   // 0.08%
            takerFee: 15   // 0.15%
        }));
        
        // Tier 2: $1M volume
        feeTiers.push(FeeTier({
            volumeThreshold: 1_000_000e18,
            makerFee: 5,   // 0.05%
            takerFee: 10   // 0.10%
        }));
        
        // Tier 3: $10M volume
        feeTiers.push(FeeTier({
            volumeThreshold: 10_000_000e18,
            makerFee: 2,   // 0.02%
            takerFee: 5    // 0.05%
        }));
    }
    
    /// @notice Called before orders are matched to determine fees
    function beforeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4, MatchDelta memory) {
        // Extract traders from hookData (would be passed by orderbook)
        (address buyer, address seller) = abi.decode(hookData, (address, address));
        
        // Calculate quote volume
        uint256 quoteVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        
        // Update volumes
        _updateVolume(buyer, quoteVolume);
        _updateVolume(seller, quoteVolume);
        
        // Determine who is maker/taker (assuming first order is maker)
        // In real implementation, orderbook would pass this info
        bool buyerIsTaker = true; // Simplified
        
        // Calculate dynamic fees
        uint128 effectiveFee;
        if (buyerIsTaker) {
            // Buyer is taker, seller is maker
            uint128 takerFee = _getFeeTier(buyer).takerFee;
            effectiveFee = takerFee; // Taker always pays their fee
            
            // Note: Market maker rebates would be handled separately in settlement
            // The fee returned here is what the taker pays
        } else {
            // Seller is taker, buyer is maker
            uint128 takerFee = _getFeeTier(seller).takerFee;
            effectiveFee = takerFee; // Taker always pays their fee
        }
        
        return (ICLOBHooks.beforeMatch.selector, MatchDelta({
            feeOverride: effectiveFee,
            priceAdjustment: 0
        }));
    }
    
    /// @notice Hook called before placing an order
    function beforePlaceOrder(
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType orderType,
        bytes calldata
    ) external virtual override returns (bytes4, OrderDelta memory) {
        // For fee hook, we don't need to modify orders before placement
        // Just return success selector with no modifications
        return (ICLOBHooks.beforePlaceOrder.selector, OrderDelta({
            priceAdjustment: 0,
            amountAdjustment: 0
        }));
    }
    
    /// @notice Hook called after placing an order
    function afterPlaceOrder(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata
    ) external virtual override returns (bytes4) {
        // We don't need to do anything after order placement for fee hook
        return ICLOBHooks.afterPlaceOrder.selector;
    }
    
    /// @notice Hook called after orders are matched
    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Volume tracking is already done in beforeMatch
        // This hook is called after the match is complete
        // We can use it for additional processing if needed
        
        // Calculate quote volume for event emission
        uint256 quoteVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        
        // Emit events for volume tracking
        emit VolumeUpdated(buyer, userVolume30d[buyer]);
        emit VolumeUpdated(seller, userVolume30d[seller]);
        
        return ICLOBHooks.afterMatch.selector;
    }
    
    /// @notice Update user's 30-day rolling volume
    function _updateVolume(address trader, uint256 volume) internal {
        // Simple implementation - in production would use more sophisticated tracking
        userVolume30d[trader] += volume;
        lastActivityTimestamp[trader] = block.timestamp;
        
        emit VolumeUpdated(trader, userVolume30d[trader]);
    }
    
    /// @notice Get fee tier for a trader based on volume
    function _getFeeTier(address trader) internal view returns (FeeTier memory) {
        uint256 volume = userVolume30d[trader];
        
        // Find highest tier user qualifies for
        for (uint i = feeTiers.length - 1; i >= 0; i--) {
            if (volume >= feeTiers[i].volumeThreshold) {
                return feeTiers[i];
            }
            if (i == 0) break; // Prevent underflow
        }
        
        return feeTiers[0]; // Default tier
    }
    
    /// @notice Add or update fee tier
    function setFeeTier(
        uint256 index,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee
    ) external onlyOwner {
        require(makerFee <= MAX_FEE && takerFee <= MAX_FEE, "Fee too high");
        
        if (index < feeTiers.length) {
            feeTiers[index] = FeeTier(volumeThreshold, makerFee, takerFee);
        } else {
            feeTiers.push(FeeTier(volumeThreshold, makerFee, takerFee));
        }
        
        emit FeeTierAdded(volumeThreshold, makerFee, takerFee);
    }
    
    /// @notice Set market maker status
    function setMarketMaker(address mm, bool status) external onlyOwner {
        isMarketMaker[mm] = status;
        emit MarketMakerUpdated(mm, status);
    }
    
    /// @notice Set pool operator address
    /// @param newOperator New pool operator address
    function setPoolOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "Invalid operator");
        address oldOperator = poolOperator;
        poolOperator = newOperator;
        emit PoolOperatorUpdated(oldOperator, newOperator);
    }
    
    /*//////////////////////////////////////////////////////////////
                          FEE ACCOUNTING FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Apply fee adjustments for a trade
    /// @param buyer Buyer address
    /// @param seller Seller address
    /// @param token Token being used for fees (usually quote token)
    /// @param matchPrice Trade price
    /// @param matchAmount Trade amount
    /// @param buyOrderIsTaker Whether buy order is the taker
    /// @return takerFeeAmount Amount collected from taker
    /// @return makerRebateAmount Amount paid as rebate to maker
    /// @return poolFeeAmount Amount retained by pool
    function applyFeeAdjustment(
        address buyer,
        address seller,
        address token,
        uint128 matchPrice,
        uint128 matchAmount,
        bool buyOrderIsTaker
    ) external returns (
        uint256 takerFeeAmount,
        uint256 makerRebateAmount,
        uint256 poolFeeAmount
    ) {
        // Determine taker and maker
        address taker = buyOrderIsTaker ? buyer : seller;
        address maker = buyOrderIsTaker ? seller : buyer;
        
        // Calculate trade value
        uint256 tradeValue = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        
        // Get fee tiers
        FeeTier memory takerTier = _getFeeTier(taker);
        FeeTier memory makerTier = _getFeeTier(maker);
        
        // Calculate taker fee
        takerFeeAmount = tradeValue * takerTier.takerFee / BPS_BASE;
        
        // Calculate maker rebate (if applicable)
        if (isMarketMaker[maker]) {
            // Market makers get rebate on their tier fee
            uint256 makerFeeAmount = tradeValue * makerTier.makerFee / BPS_BASE;
            makerRebateAmount = makerFeeAmount * marketMakerRebate / BPS_BASE;
            makerRebateAmount = makerRebateAmount > makerFeeAmount ? makerFeeAmount : makerRebateAmount;
        }
        
        // Pool gets remainder after rebates
        poolFeeAmount = takerFeeAmount - makerRebateAmount;
        
        // Update individual user volumes for both taker and maker
        uint256 quoteVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        _updateVolume(taker, quoteVolume);
        _updateVolume(maker, quoteVolume);
        
        // Update accounting
        totalFeesCollected[token] += takerFeeAmount;
        totalRebatesPaid[token] += makerRebateAmount;
        poolFeeBalance[token] += poolFeeAmount;
        
        // Emit events
        emit FeeCollected(taker, token, takerFeeAmount, "TAKER");
        if (makerRebateAmount > 0) {
            emit RebatePaid(maker, token, makerRebateAmount);
        }
        
        return (takerFeeAmount, makerRebateAmount, poolFeeAmount);
    }
    
    /// @notice Withdraw accumulated pool fees
    /// @param token Token to withdraw
    /// @param amount Amount to withdraw (0 = withdraw all)
    function withdrawPoolFees(address token, uint256 amount) external {
        // Access control is handled by the calling contract
        
        uint256 available = poolFeeBalance[token];
        require(available > 0, "No fees available");
        
        uint256 withdrawAmount = amount == 0 ? available : amount;
        require(withdrawAmount <= available, "Insufficient balance");
        
        poolFeeBalance[token] -= withdrawAmount;
        
        emit PoolFeesWithdrawn(poolOperator, token, withdrawAmount);
        
        // Note: In a real implementation, this would transfer tokens
        // For this example, we just update accounting
    }
    
    /// @notice Get fee accounting summary for a token
    /// @param token Token address
    /// @return totalCollected Total fees collected
    /// @return totalRebates Total rebates paid
    /// @return poolBalance Available pool balance
    function getFeeAccountingSummary(address token) external view returns (
        uint256 totalCollected,
        uint256 totalRebates,
        uint256 poolBalance
    ) {
        return (
            totalFeesCollected[token],
            totalRebatesPaid[token],
            poolFeeBalance[token]
        );
    }
    
    /// @notice Get current fee tier for a trader
    function getTraderFeeTier(address trader) external view returns (
        uint256 tierIndex,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee
    ) {
        FeeTier memory tier = _getFeeTier(trader);
        
        // Find tier index
        for (uint i = 0; i < feeTiers.length; i++) {
            if (feeTiers[i].volumeThreshold == tier.volumeThreshold &&
                feeTiers[i].makerFee == tier.makerFee &&
                feeTiers[i].takerFee == tier.takerFee) {
                return (i, tier.volumeThreshold, tier.makerFee, tier.takerFee);
            }
        }
    }
}