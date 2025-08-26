// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SpotBook} from "../spot/SpotBook.sol";
import {FeeHook} from "../../hooks/FeeHook.sol";
import {FixedPointMathLib} from "lib/solady/src/utils/FixedPointMathLib.sol";
import {TransientLock} from "../../libraries/TransientStorage.sol";

/// @title DynamicFeeBook
/// @notice Example order book with dynamic volume-based fee structure
/// @dev Extends SpotBook with FeeHook integration for tiered fees and market maker rebates
contract DynamicFeeBook is SpotBook {
    using FixedPointMathLib for uint256;
    using TransientLock for *;
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice The dynamic fee hook contract
    FeeHook public immutable feeHook;
    
    /// @notice Track total trading volume for fee tier calculations
    uint256 public totalVolume;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event VolumeUpdated(uint256 newTotalVolume);
    event DynamicFeesApplied(address indexed trader, uint128 effectiveFee, uint256 traderVolume);
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _baseToken,
        address _quoteToken,
        address _feeHook
    ) SpotBook(_baseToken, _quoteToken, _feeHook) {
        feeHook = FeeHook(_feeHook);
    }
    
    /*//////////////////////////////////////////////////////////////
                          ENHANCED FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Place order with enhanced volume tracking for fee calculations
    /// @dev Overrides SpotBook.placeOrder to add volume tracking
    function placeOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) external virtual override returns (uint256 orderId) {
        // Use the SpotBook implementation via inheritance
        TransientLock.lock();
        
        // For limit buy orders, calculate and lock quote amount
        if (isBuy && orderType == OrderType.LIMIT) {
            uint256 quoteAmount = uint256(amount).mulWad(price);
            
            // Lock the quote amount
            PackedBalance storage balance = balances[msg.sender][quoteToken];
            if (balance.available < quoteAmount) revert InsufficientBalance();
            
            // Update balance first
            balance.available -= uint128(quoteAmount);
            balance.locked += uint128(quoteAmount);
        }
        
        // Call internal implementation
        orderId = _placeOrderInternal(isBuy, price, amount, orderType);
        
        // Store locked amount for buy orders
        if (isBuy && orderType == OrderType.LIMIT) {
            uint256 quoteAmount = uint256(amount).mulWad(price);
            buyOrderQuoteLocked[orderId] = quoteAmount;
        }
        
        // Try to match orders automatically
        if (orderType == OrderType.LIMIT) {
            this.matchOrders(1);
        }
        
        // Volume will be tracked in _afterMatch when orders are matched
        
        TransientLock.unlock();
        return orderId;
    }
    
    /// @dev Override _afterMatch to track volume and apply dynamic fees
    function _afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bool buyOrderIsTaker,
        uint128 feeOverride
    ) internal virtual override {
        // Calculate and track volume
        uint256 quoteVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        _updateTotalVolume(quoteVolume);
        
        // Determine taker for fee tracking
        address taker = buyOrderIsTaker ? buyer : seller;
        
        // Get trader's volume tier info
        (uint256 tierIndex, uint256 volumeThreshold, uint128 makerFee, uint128 takerFee) = 
            feeHook.getTraderFeeTier(taker);
        
        // Emit dynamic fee event
        emit DynamicFeesApplied(taker, feeOverride > 0 ? feeOverride : takerFee, feeHook.userVolume30d(taker));
        
        // Apply fee adjustments through the hook
        applyFeeAdjustment(
            buyer,
            seller,
            address(quoteToken), // Use quote token for fees
            matchPrice,
            matchAmount,
            buyOrderIsTaker
        );
        
        // Call parent settlement with fee override from hook  
        super._afterMatch(
            buyOrderId,
            sellOrderId,
            buyer,
            seller,
            matchPrice,
            matchAmount,
            buyOrderIsTaker,
            feeOverride
        );
    }
    
    /// @notice Apply fee adjustments for a trade using the FeeHook
    /// @param buyer Buyer address
    /// @param seller Seller address
    /// @param token Token used for fees (usually quote token)
    /// @param matchPrice Trade price
    /// @param matchAmount Trade amount
    /// @param buyOrderIsTaker Whether buy order is the taker
    function applyFeeAdjustment(
        address buyer,
        address seller,
        address token,
        uint128 matchPrice,
        uint128 matchAmount,
        bool buyOrderIsTaker
    ) public {
        // Call the FeeHook to handle fee accounting
        (uint256 takerFeeAmount, uint256 makerRebateAmount, uint256 poolFeeAmount) = 
            feeHook.applyFeeAdjustment(
                buyer,
                seller,
                token,
                matchPrice,
                matchAmount,
                buyOrderIsTaker
            );
        
        // Emit comprehensive fee event
        emit DynamicFeesApplied(
            buyOrderIsTaker ? buyer : seller, // taker
            uint128(takerFeeAmount * 10000 / (uint256(matchAmount) * uint256(matchPrice) / 1e18)), // effective fee rate in bps
            feeHook.userVolume30d(buyOrderIsTaker ? buyer : seller)
        );
        
        // In a real implementation, this would:
        // 1. Deduct takerFeeAmount from taker's balance
        // 2. Add makerRebateAmount to maker's balance  
        // 3. Track poolFeeAmount for pool operator
    }
    
    /*//////////////////////////////////////////////////////////////
                        VOLUME & FEE MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Update total trading volume
    /// @param volume Volume to add
    function _updateTotalVolume(uint256 volume) internal {
        totalVolume += volume;
        emit VolumeUpdated(totalVolume);
    }
    
    /// @notice Get trader's current fee tier
    /// @param trader Trader address
    /// @return tierIndex Current tier index
    /// @return volumeThreshold Volume threshold for this tier
    /// @return makerFee Maker fee for this tier (basis points)
    /// @return takerFee Taker fee for this tier (basis points)
    function getTraderFeeTier(address trader) external view returns (
        uint256 tierIndex,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee
    ) {
        return feeHook.getTraderFeeTier(trader);
    }
    
    /// @notice Get trader's 30-day volume
    /// @param trader Trader address
    /// @return volume 30-day trading volume
    function getTraderVolume(address trader) external view returns (uint256 volume) {
        return feeHook.userVolume30d(trader);
    }
    
    /// @notice Check if trader is designated market maker
    /// @param trader Trader address
    /// @return isMarketMaker Whether trader has market maker status
    function isTraderMarketMaker(address trader) external view returns (bool isMarketMaker) {
        return feeHook.isMarketMaker(trader);
    }
    
    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set market maker status (only callable by fee hook owner)
    /// @dev This function demonstrates how to expose hook functionality
    /// @param trader Trader address
    /// @param status Market maker status
    function setMarketMaker(address trader, bool status) external {
        // FeeHook will check onlyOwner, so we can safely delegate
        feeHook.setMarketMaker(trader, status);
    }
    
    /// @notice Add or update fee tier (only callable by fee hook owner)
    /// @param index Tier index
    /// @param volumeThreshold Volume threshold for tier
    /// @param makerFee Maker fee in basis points
    /// @param takerFee Taker fee in basis points
    function setFeeTier(
        uint256 index,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee
    ) external {
        // FeeHook will check onlyOwner, so we can safely delegate
        feeHook.setFeeTier(index, volumeThreshold, makerFee, takerFee);
    }
    
    /// @notice Set pool operator (only callable by fee hook owner)
    /// @param newOperator New pool operator address
    function setPoolOperator(address newOperator) external {
        feeHook.setPoolOperator(newOperator);
    }
    
    /*//////////////////////////////////////////////////////////////
                      FEE ACCOUNTING FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Withdraw pool fees (only callable by pool operator)
    /// @param token Token to withdraw
    /// @param amount Amount to withdraw (0 = all)
    function withdrawPoolFees(address token, uint256 amount) external {
        require(msg.sender == feeHook.poolOperator(), "Only pool operator");
        feeHook.withdrawPoolFees(token, amount);
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
        return feeHook.getFeeAccountingSummary(token);
    }
    
    /// @notice Get current pool operator
    /// @return poolOperator Pool operator address
    function getPoolOperator() external view returns (address poolOperator) {
        return feeHook.poolOperator();
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get all fee tiers
    /// @return tiers Array of fee tier information
    function getAllFeeTiers() external view returns (FeeHook.FeeTier[] memory tiers) {
        // Note: This would require adding a getter to FeeHook
        // For now, we'll return empty array as placeholder
        tiers = new FeeHook.FeeTier[](4);
        
        // In a real implementation, FeeHook would expose a getter
        // or we'd track tiers locally
    }
    
    /// @notice Calculate effective fee for a potential trade
    /// @param trader Trader address
    /// @param amount Trade amount
    /// @param price Trade price
    /// @param isTaker Whether trader would be taker
    /// @return effectiveFee Effective fee in basis points
    function calculateEffectiveFee(
        address trader,
        uint128 amount,
        uint128 price,
        bool isTaker
    ) external view returns (uint128 effectiveFee) {
        (, , uint128 makerFee, uint128 takerFee) = feeHook.getTraderFeeTier(trader);
        
        if (isTaker) {
            effectiveFee = takerFee;
        } else {
            effectiveFee = makerFee;
            
            // Apply market maker rebate if applicable
            if (feeHook.isMarketMaker(trader)) {
                uint128 rebate = feeHook.marketMakerRebate();
                effectiveFee = effectiveFee > rebate ? effectiveFee - rebate : 0;
            }
        }
    }
    
    /// @notice Estimate trading cost for a potential trade
    /// @param trader Trader address
    /// @param amount Trade amount
    /// @param price Trade price
    /// @param isTaker Whether trader would be taker
    /// @return feeAmount Estimated fee amount in quote tokens
    function estimateTradingCost(
        address trader,
        uint128 amount,
        uint128 price,
        bool isTaker
    ) external view returns (uint256 feeAmount) {
        uint128 effectiveFee = this.calculateEffectiveFee(trader, amount, price, isTaker);
        uint256 tradeValue = uint256(amount) * uint256(price) / 1e18;
        feeAmount = tradeValue * effectiveFee / 10000;
    }
    

}