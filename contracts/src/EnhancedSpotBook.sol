// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {SpotBook} from "./examples/spot/SpotBook.sol";
import {FeeDistributor} from "./FeeDistributor.sol";
import {GlobalFeeHook} from "./hooks/GlobalFeeHook.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title EnhancedSpotBook
/// @notice SpotBook with FeeDistributor integration
contract EnhancedSpotBook is SpotBook {
    using SafeTransferLib for address;
    
    FeeDistributor public immutable feeDistributor;
    GlobalFeeHook public immutable globalFeeHook;
    
    // Track accumulated fees
    uint256 public accumulatedBaseFees;
    uint256 public accumulatedQuoteFees;
    
    // Events
    event FeesForwarded(address indexed token, uint256 amount);
    
    constructor(
        address _baseToken,
        address _quoteToken,
        address _globalFeeHook,
        address _feeDistributor
    ) SpotBook(_baseToken, _quoteToken, _globalFeeHook) {
        globalFeeHook = GlobalFeeHook(_globalFeeHook);
        feeDistributor = FeeDistributor(_feeDistributor);
        
        // Set fee recipient to this contract to accumulate fees
        feeRecipient = address(this);
    }
    
    /// @dev Override to accumulate fees for distribution
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
        // Call parent implementation which will collect fees to this contract
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
        
        // Calculate fees that were collected
        uint256 quoteAmount = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        uint128 effectiveMakerFee = feeOverride > 0 ? 0 : makerFeeBps;
        uint128 effectiveTakerFee = feeOverride > 0 ? feeOverride : takerFeeBps;
        
        uint256 baseFeeAmount = 0;
        uint256 quoteFeeAmount = 0;
        
        if (buyOrderIsTaker) {
            baseFeeAmount = uint256(matchAmount) * effectiveTakerFee / BPS_BASE;
            quoteFeeAmount = quoteAmount * effectiveMakerFee / BPS_BASE;
        } else {
            baseFeeAmount = uint256(matchAmount) * effectiveMakerFee / BPS_BASE;
            quoteFeeAmount = quoteAmount * effectiveTakerFee / BPS_BASE;
        }
        
        // Accumulate fees
        accumulatedBaseFees += baseFeeAmount;
        accumulatedQuoteFees += quoteFeeAmount;
    }
    
    /// @notice Forward accumulated fees to the FeeDistributor
    /// @param forwardBase Whether to forward base token fees
    /// @param forwardQuote Whether to forward quote token fees
    function forwardFeesToDistributor(bool forwardBase, bool forwardQuote) external {
        // Note: In a production system, we'd track the referrer from actual trades
        // For now, we'll forward without referral attribution
        
        // Forward base token fees
        if (forwardBase && accumulatedBaseFees > 0) {
            uint256 amount = accumulatedBaseFees;
            accumulatedBaseFees = 0;
            
            // Withdraw fees from our balance first
            PackedBalance storage baseBalance = balances[address(this)][baseToken];
            require(baseBalance.available >= amount, "Insufficient base fee balance");
            baseBalance.available -= uint128(amount);
            
            // Approve and send to distributor
            baseToken.safeApprove(address(feeDistributor), amount);
            feeDistributor.receiveFees(
                baseToken,
                amount,
                "TRADING"
            );
            
            emit FeesForwarded(baseToken, amount);
        }
        
        // Forward quote token fees
        if (forwardQuote && accumulatedQuoteFees > 0) {
            uint256 amount = accumulatedQuoteFees;
            accumulatedQuoteFees = 0;
            
            // Withdraw fees from our balance first
            PackedBalance storage quoteBalance = balances[address(this)][quoteToken];
            require(quoteBalance.available >= amount, "Insufficient quote fee balance");
            quoteBalance.available -= uint128(amount);
            
            // Approve and send to distributor
            quoteToken.safeApprove(address(feeDistributor), amount);
            feeDistributor.receiveFees(
                quoteToken,
                amount,
                "TRADING"
            );
            
            emit FeesForwarded(quoteToken, amount);
        }
    }
    
    /// @notice Get accumulated fee amounts
    function getAccumulatedFees() external view returns (
        uint256 baseFees,
        uint256 quoteFees
    ) {
        return (accumulatedBaseFees, accumulatedQuoteFees);
    }
}