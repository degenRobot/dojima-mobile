// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {OrderBook} from "../../OrderBook.sol";
import {SafeTransferLib} from "lib/solady/src/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "lib/solady/src/utils/FixedPointMathLib.sol";
import {TransientLock, MatchingContext} from "../../libraries/TransientStorage.sol";
import {IOrderBook} from "../../interfaces/IOrderBook.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title SpotBook
/// @notice Gas-optimized spot trading implementation with virtual vault
/// @dev Uses Solady libraries and assembly optimizations for maximum efficiency
contract SpotBook is OrderBook {
    using SafeTransferLib for address;
    using FixedPointMathLib for uint256;
    using TransientLock for *;
    using MatchingContext for *;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    // Tokens
    address public immutable baseToken;
    address public immutable quoteToken;
    uint8 public immutable baseDecimals;
    uint8 public immutable quoteDecimals;
    uint256 internal immutable quoteDecimalsFactor; // 10**(18 - quoteDecimals) for conversion
    
    // Packed balance structure for efficient storage
    struct PackedBalance {
        uint128 available;  // Available balance
        uint128 locked;     // Locked in orders
    }
    
    // User balances: user => token => balance
    mapping(address => mapping(address => PackedBalance)) internal balances;
    
    // Track quote amount locked for buy orders
    mapping(uint256 => uint256) internal buyOrderQuoteLocked;
    
    // Fee configuration (packed into single slot)
    uint128 public makerFeeBps;  // Maker fee in basis points
    uint128 public takerFeeBps;  // Taker fee in basis points
    address public feeRecipient;
    address public owner;
    
    // Constants
    uint128 internal constant BPS_BASE = 10000;
    uint128 internal constant MAX_FEE_BPS = 1000; // 10% max fee
    
    // Errors
    error InvalidToken();
    error ZeroAmount();
    error NotOwner();
    error FeeTooHigh();
    error InvalidRecipient();
    error InvalidOwner();
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _baseToken,
        address _quoteToken,
        address _hooks
    ) OrderBook(_hooks) {
        baseToken = _baseToken;
        quoteToken = _quoteToken;
        
        // Get token decimals
        baseDecimals = IERC20Metadata(_baseToken).decimals();
        quoteDecimals = IERC20Metadata(_quoteToken).decimals();
        
        // Pre-calculate conversion factor for quote token
        // This converts from 18 decimals to quote token's native decimals
        quoteDecimalsFactor = quoteDecimals < 18 
            ? 10**(18 - quoteDecimals) 
            : 1;
        
        owner = msg.sender;
        feeRecipient = msg.sender;
    }
    
    /*//////////////////////////////////////////////////////////////
                         DECIMAL CONVERSION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Convert quote amount from 18 decimals to native decimals
    /// @param amount18 Amount in 18 decimal format
    /// @return Amount in quote token's native decimals
    function _toQuoteDecimals(uint256 amount18) internal view returns (uint256) {
        return quoteDecimals < 18 
            ? amount18 / quoteDecimalsFactor
            : amount18;
    }
    
    /// @notice Convert quote amount from native decimals to 18 decimals
    /// @param amountNative Amount in quote token's native decimals
    /// @return Amount in 18 decimal format
    function _toQuoteDecimals18(uint256 amountNative) internal view returns (uint256) {
        return quoteDecimals < 18
            ? amountNative * quoteDecimalsFactor
            : amountNative;
    }
    
    /*//////////////////////////////////////////////////////////////
                          BALANCE OPERATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deposit tokens into the virtual vault
    /// @param token The token to deposit
    /// @param amount The amount to deposit
    function deposit(address token, uint256 amount) external {
        TransientLock.lock();
        if (token != baseToken && token != quoteToken) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();
        
        // Use assembly for optimized balance update
        assembly {
            // Compute storage slot for balance
            mstore(0x00, caller())
            mstore(0x20, balances.slot)
            let slot := keccak256(0x00, 0x40)
            mstore(0x00, token)
            mstore(0x20, slot)
            let balanceSlot := keccak256(0x00, 0x40)
            
            // Load current balance
            let packedBalance := sload(balanceSlot)
            let available := and(packedBalance, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            
            // Add amount to available balance
            available := add(available, amount)
            
            // Store updated balance
            packedBalance := or(
                shl(128, shr(128, packedBalance)), // Keep locked amount
                available
            )
            sstore(balanceSlot, packedBalance)
        }
        
        // Transfer tokens using Solady's optimized SafeTransferLib
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Deposited(msg.sender, token, amount);
        TransientLock.unlock();
    }
    
    /// @notice Withdraw tokens from the virtual vault
    /// @param token The token to withdraw
    /// @param amount The amount to withdraw
    function withdraw(address token, uint256 amount) external {
        TransientLock.lock();
        if (token != baseToken && token != quoteToken) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();
        
        // Use assembly for optimized balance check and update
        assembly {
            // Compute storage slot for balance
            mstore(0x00, caller())
            mstore(0x20, balances.slot)
            let slot := keccak256(0x00, 0x40)
            mstore(0x00, token)
            mstore(0x20, slot)
            let balanceSlot := keccak256(0x00, 0x40)
            
            // Load current balance
            let packedBalance := sload(balanceSlot)
            let available := and(packedBalance, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            
            // Check sufficient balance
            if lt(available, amount) {
                mstore(0x00, 0xf4d678b8) // InsufficientBalance selector
                revert(0x1c, 0x04)
            }
            
            // Update balance
            available := sub(available, amount)
            packedBalance := or(
                shl(128, shr(128, packedBalance)), // Keep locked amount
                available
            )
            sstore(balanceSlot, packedBalance)
        }
        
        // Transfer tokens
        token.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, token, amount);
        TransientLock.unlock();
    }
    
    /// @notice Get balance for a user
    /// @param user The user address
    /// @param token The token address
    /// @return available Available balance
    /// @return locked Locked balance
    function getBalance(address user, address token) external view returns (uint128 available, uint128 locked) {
        PackedBalance memory balance = balances[user][token];
        return (balance.available, balance.locked);
    }
    
    /// @notice Withdraw all available balances
    function withdrawAll() external {
        TransientLock.lock();
        // Withdraw base token
        PackedBalance storage baseBalance = balances[msg.sender][baseToken];
        uint128 baseAvailable = baseBalance.available;
        if (baseAvailable > 0) {
            baseBalance.available = 0;
            baseToken.safeTransfer(msg.sender, baseAvailable);
            emit Withdrawn(msg.sender, baseToken, baseAvailable);
        }
        
        // Withdraw quote token
        PackedBalance storage quoteBalance = balances[msg.sender][quoteToken];
        uint128 quoteAvailable = quoteBalance.available;
        if (quoteAvailable > 0) {
            quoteBalance.available = 0;
            quoteToken.safeTransfer(msg.sender, quoteAvailable);
            emit Withdrawn(msg.sender, quoteToken, quoteAvailable);
        }
        TransientLock.unlock();
    }
    
    /*//////////////////////////////////////////////////////////////
                        ORDER BOOK OVERRIDES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Override placeOrder to handle buy order locking
    function placeOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) external virtual override returns (uint256 orderId) {
        TransientLock.lock();
        // For limit buy orders, calculate and lock quote amount
        if (isBuy && orderType == OrderType.LIMIT) {
            uint256 quoteAmount18 = uint256(amount).mulWad(price);  // Amount in 18 decimals
            uint256 quoteAmountNative = _toQuoteDecimals(quoteAmount18);  // Convert to native decimals
            
            // Lock the quote amount (in native decimals)
            PackedBalance storage balance = balances[msg.sender][quoteToken];
            if (balance.available < quoteAmountNative) revert InsufficientBalance();
            
            // Update balance first
            balance.available -= uint128(quoteAmountNative);
            balance.locked += uint128(quoteAmountNative);
        }
        
        // Call internal implementation
        orderId = _placeOrderInternal(isBuy, price, amount, orderType);
        
        // Store locked amount for buy orders (in native decimals)
        if (isBuy && orderType == OrderType.LIMIT) {
            uint256 quoteAmount18 = uint256(amount).mulWad(price);
            uint256 quoteAmountNative = _toQuoteDecimals(quoteAmount18);
            buyOrderQuoteLocked[orderId] = quoteAmountNative;
        }
        
        // Try to match orders automatically
        // Market orders were already matched in _placeOrderInternal, 
        // but we still try to match limit orders
        if (orderType == OrderType.LIMIT) {
            this.matchOrders(1);
        }
        
        TransientLock.unlock();
        return orderId;
    }
    
    /// @dev Lock funds before placing an order
    function _beforePlaceOrder(address trader, bool isBuy, uint128 amount) internal virtual override {
        // For sell orders, lock the base token amount
        if (!isBuy) {
            PackedBalance storage balance = balances[trader][baseToken];
            if (balance.available < amount) revert InsufficientBalance();
            balance.available -= amount;
            balance.locked += amount;
        }
        // Buy order locking is handled in the overridden placeOrder function
    }
    
    /// @dev Unlock funds when canceling an order
    function _beforeCancelOrder(address trader, bool isBuy, uint128 amount) internal virtual override {
        if (isBuy) {
            // For buy orders, check if we have locked quote amount
            uint256 orderId = 0; // Need to get orderId from context
            uint256 quoteLocked = buyOrderQuoteLocked[orderId];
            if (quoteLocked > 0) {
                PackedBalance storage balance = balances[trader][quoteToken];
                balance.available += uint128(quoteLocked);
                balance.locked -= uint128(quoteLocked);
                delete buyOrderQuoteLocked[orderId];
            }
        } else {
            // For sell orders, unlock the base token
            PackedBalance storage balance = balances[trader][baseToken];
            balance.available += amount;
            balance.locked -= amount;
        }
    }
    
    /// @notice Override cancelOrder to pass orderId to _beforeCancelOrder
    function cancelOrder(uint256 orderId) external virtual override {
        TransientLock.lock();
        // Get order details first
        IOrderBook.Order memory order = this.getOrder(orderId);
        
        // Handle buy order quote unlocking
        if (order.isBuy) {
            uint256 quoteLocked = buyOrderQuoteLocked[orderId];
            if (quoteLocked > 0) {
                PackedBalance storage balance = balances[order.trader][quoteToken];
                balance.available += uint128(quoteLocked);
                balance.locked -= uint128(quoteLocked);
                delete buyOrderQuoteLocked[orderId];
            }
        }
        
        // Call parent implementation
        _cancelOrderInternal(orderId);
        
        TransientLock.unlock();
    }
    
    /// @dev Execute settlement after a match
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
        // Calculate quote amount in 18 decimals
        uint256 quoteAmount18 = uint256(matchAmount).mulWad(matchPrice);
        // Convert to native decimals for balance updates
        uint256 quoteAmountNative = _toQuoteDecimals(quoteAmount18);
        
        // Determine fees - both maker and taker pay fees on what they receive
        uint128 effectiveMakerFee = feeOverride > 0 ? 0 : makerFeeBps;
        uint128 effectiveTakerFee = feeOverride > 0 ? feeOverride : takerFeeBps;
        
        // Calculate fee amounts - each party pays fee on what they receive
        uint256 baseFeeAmount = 0;
        uint256 quoteFeeAmountNative = 0;
        
        // Buyer receives base, pays fee on base
        // Seller receives quote, pays fee on quote
        if (buyOrderIsTaker) {
            // Buy order is taker
            baseFeeAmount = uint256(matchAmount).mulDiv(effectiveTakerFee, BPS_BASE);
            quoteFeeAmountNative = quoteAmountNative.mulDiv(effectiveMakerFee, BPS_BASE);
        } else {
            // Sell order is taker
            baseFeeAmount = uint256(matchAmount).mulDiv(effectiveMakerFee, BPS_BASE);
            quoteFeeAmountNative = quoteAmountNative.mulDiv(effectiveTakerFee, BPS_BASE);
        }
        
        // Update buyer balances
        // For buyers: receive base tokens (minus base fee), pay quote tokens
        PackedBalance storage buyerBaseBalance = balances[buyer][baseToken];
        buyerBaseBalance.available += uint128(matchAmount - baseFeeAmount);
        
        PackedBalance storage buyerQuoteBalance = balances[buyer][quoteToken];
        // Check if this is a limit order with locked quote
        if (buyOrderQuoteLocked[buyOrderId] > 0) {
            // Deduct from locked balance (stored in native decimals)
            buyerQuoteBalance.locked -= uint128(quoteAmountNative);
        } else {
            // Market order - deduct from available balance
            require(buyerQuoteBalance.available >= quoteAmountNative, "Insufficient quote balance");
            buyerQuoteBalance.available -= uint128(quoteAmountNative);
        }
        
        // Update seller balances
        // For sellers: send base tokens, receive quote tokens (minus quote fee)
        PackedBalance storage sellerBaseBalance = balances[seller][baseToken];
        sellerBaseBalance.locked -= uint128(matchAmount);
        
        PackedBalance storage sellerQuoteBalance = balances[seller][quoteToken];
        sellerQuoteBalance.available += uint128(quoteAmountNative - quoteFeeAmountNative);
        
        // Update fee recipient balances if fees exist
        if (baseFeeAmount > 0) {
            PackedBalance storage feeBaseBalance = balances[feeRecipient][baseToken];
            feeBaseBalance.available += uint128(baseFeeAmount);
        }
        if (quoteFeeAmountNative > 0) {
            PackedBalance storage feeQuoteBalance = balances[feeRecipient][quoteToken];
            feeQuoteBalance.available += uint128(quoteFeeAmountNative);
        }
        
        // Update buy order quote locked tracking
        if (buyOrderQuoteLocked[buyOrderId] > 0) {
            // Reduce locked amount by the amount used (in native decimals)
            if (buyOrderQuoteLocked[buyOrderId] >= quoteAmountNative) {
                buyOrderQuoteLocked[buyOrderId] -= quoteAmountNative;
            } else {
                // This can happen if order was partially filled at a better price
                buyOrderQuoteLocked[buyOrderId] = 0;
            }
            
            if (buyOrderQuoteLocked[buyOrderId] == 0) {
                delete buyOrderQuoteLocked[buyOrderId];
            }
        }
        
        // Record match in transient storage for batch statistics (use 18 decimals for consistency)
        MatchingContext.recordMatch(quoteAmount18);
    }
    
    /*//////////////////////////////////////////////////////////////
                           FEE MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set maker and taker fees
    /// @param _makerFeeBps Maker fee in basis points
    /// @param _takerFeeBps Taker fee in basis points
    function setFees(uint128 _makerFeeBps, uint128 _takerFeeBps) external {
        if (msg.sender != owner) revert NotOwner();
        if (_makerFeeBps > MAX_FEE_BPS || _takerFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        
        makerFeeBps = _makerFeeBps;
        takerFeeBps = _takerFeeBps;
        
        emit FeesUpdated(_makerFeeBps, _takerFeeBps);
    }
    
    /// @notice Set fee recipient
    /// @param _feeRecipient New fee recipient
    function setFeeRecipient(address _feeRecipient) external {
        if (msg.sender != owner) revert NotOwner();
        if (_feeRecipient == address(0)) revert InvalidRecipient();
        
        feeRecipient = _feeRecipient;
        
        emit FeeRecipientUpdated(_feeRecipient);
    }
    
    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert NotOwner();
        if (newOwner == address(0)) revert InvalidOwner();
        
        owner = newOwner;
        
        emit OwnershipTransferred(msg.sender, newOwner);
    }
    
    /*//////////////////////////////////////////////////////////////
                          BATCH OPERATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Execute batch matching with transient storage optimization
    /// @param maxMatches Maximum number of matches to execute
    function batchMatch(uint256 maxMatches) external {
        // Initialize transient matching context
        MatchingContext.initialize();
        
        // Execute matching
        this.matchOrders(maxMatches);
        
        // Get and emit statistics
        (uint256 matchCount, uint256 totalVolume, uint256 gasUsed) = MatchingContext.getStats();
        
        if (matchCount > 0) {
            emit BatchMatchCompleted(matchCount, totalVolume, gasUsed);
        }
        
        // Clear transient storage
        MatchingContext.clear();
    }
    
    /*//////////////////////////////////////////////////////////////
                              EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event FeesUpdated(uint128 makerFeeBps, uint128 takerFeeBps);
    event FeeRecipientUpdated(address indexed feeRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchMatchCompleted(uint256 matchCount, uint256 totalVolume, uint256 gasUsed);
    
    /*//////////////////////////////////////////////////////////////
                            INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Update balances with assembly optimization
    function _updateBalance(
        address user,
        address token,
        uint128 baseAvailableDelta,
        uint128 baseLockedDelta,
        uint128 quoteAvailableDelta,
        uint128 quoteLockedDelta
    ) internal {
        // Update base token balance if needed
        if (token == baseToken && (baseAvailableDelta > 0 || baseLockedDelta > 0)) {
            PackedBalance storage balance = balances[user][baseToken];
            balance.available += baseAvailableDelta;
            balance.locked -= baseLockedDelta;
        }
        
        // Update quote token balance if needed
        if (quoteAvailableDelta > 0 || quoteLockedDelta > 0) {
            PackedBalance storage balance = balances[user][quoteToken];
            balance.available += quoteAvailableDelta;
            balance.locked -= quoteLockedDelta;
        }
    }
}