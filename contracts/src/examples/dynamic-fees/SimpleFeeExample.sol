// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SpotBook} from "../spot/SpotBook.sol";
import {FeeHook} from "../../hooks/FeeHook.sol";

/// @title SimpleFeeExample
/// @notice Simple example showing how to integrate FeeHook with SpotBook
/// @dev Demonstrates volume-based fee tiers and market maker rebates
contract SimpleFeeExample is SpotBook {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice The dynamic fee hook contract
    FeeHook public immutable feeHook;
    
    /// @notice Track total trading volume for demonstration
    uint256 public totalVolume;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event VolumeUpdated(uint256 newTotalVolume);
    event FeeApplied(address indexed trader, uint128 fee, string feeType);
    event FeeAdjustmentApplied(uint256 takerFee, uint256 makerRebate, uint256 poolFee);
    
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
    
    /// @dev Override _afterMatch to track volume and demonstrate fee integration
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
        totalVolume += quoteVolume;
        emit VolumeUpdated(totalVolume);
        
        // Determine taker for demonstration
        address taker = buyOrderIsTaker ? buyer : seller;
        address maker = buyOrderIsTaker ? seller : buyer;
        
        // Get fee information for demonstration
        (, , uint128 makerFee, uint128 takerFee) = feeHook.getTraderFeeTier(taker);
        
        // Emit fee information
        emit FeeApplied(taker, feeOverride > 0 ? feeOverride : takerFee, "TAKER");
        emit FeeApplied(maker, makerFee, "MAKER");
        
        // Apply fee adjustments through the hook
        applyFeeAdjustment(
            buyer,
            seller,
            address(quoteToken), // Use quote token for fees
            matchPrice,
            matchAmount,
            buyOrderIsTaker
        );
        
        // Call parent settlement
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
        
        // In a real implementation, this would:
        // 1. Deduct takerFeeAmount from taker's balance
        // 2. Add makerRebateAmount to maker's balance
        // 3. Track poolFeeAmount for pool operator
        
        // For this example, we emit an event to demonstrate the accounting
        emit FeeAdjustmentApplied(takerFeeAmount, makerRebateAmount, poolFeeAmount);
    }
    
    /*//////////////////////////////////////////////////////////////
                        FEE INFORMATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
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
    
    /// @notice Calculate effective fee for a potential trade
    /// @param trader Trader address
    /// @param isTaker Whether trader would be taker
    /// @return effectiveFee Effective fee in basis points
    function calculateEffectiveFee(
        address trader,
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
        uint128 effectiveFee = this.calculateEffectiveFee(trader, isTaker);
        uint256 tradeValue = uint256(amount) * uint256(price) / 1e18;
        feeAmount = tradeValue * effectiveFee / 10000;
    }
    
    /*//////////////////////////////////////////////////////////////
                          ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set market maker status (only callable by fee hook owner)
    /// @param trader Trader address
    /// @param status Market maker status
    function setMarketMaker(address trader, bool status) external {
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
    
    /// @notice Calculate fee breakdown for a hypothetical trade
    /// @param buyer Buyer address
    /// @param seller Seller address
    /// @param amount Trade amount
    /// @param price Trade price
    /// @param buyOrderIsTaker Whether buy order is taker
    /// @return takerFee Fee charged to taker
    /// @return makerRebate Rebate paid to maker
    /// @return poolFee Amount retained by pool
    function calculateFeeBreakdown(
        address buyer,
        address seller,
        uint128 amount,
        uint128 price,
        bool buyOrderIsTaker
    ) external view returns (
        uint256 takerFee,
        uint256 makerRebate,
        uint256 poolFee
    ) {
        // Determine taker and maker
        address taker = buyOrderIsTaker ? buyer : seller;
        address maker = buyOrderIsTaker ? seller : buyer;
        
        // Calculate trade value
        uint256 tradeValue = uint256(amount) * uint256(price) / 1e18;
        
        // Get fee tiers
        (, , uint128 takerMakerFee, uint128 takerTakerFee) = feeHook.getTraderFeeTier(taker);
        (, , uint128 makerMakerFee, ) = feeHook.getTraderFeeTier(maker);
        
        // Calculate taker fee
        takerFee = tradeValue * takerTakerFee / 10000;
        
        // Calculate maker rebate (if applicable)
        if (feeHook.isMarketMaker(maker)) {
            uint256 makerFeeAmount = tradeValue * makerMakerFee / 10000;
            makerRebate = makerFeeAmount * feeHook.marketMakerRebate() / 10000;
            makerRebate = makerRebate > makerFeeAmount ? makerFeeAmount : makerRebate;
        }
        
        // Pool gets remainder
        poolFee = takerFee - makerRebate;
    }
}