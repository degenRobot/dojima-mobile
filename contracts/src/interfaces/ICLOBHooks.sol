// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IOrderBook} from "./IOrderBook.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";

/// @title ICLOBHooks
/// @notice Interface for CLOB hooks that allow customization of order book behavior
interface ICLOBHooks {
    /// @notice Called before an order is placed
    /// @param trader The address placing the order
    /// @param isBuy Whether this is a buy order
    /// @param price The order price
    /// @param amount The order amount
    /// @param orderType The type of order (LIMIT or MARKET)
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    /// @return delta Adjustments to make to the order
    function beforePlaceOrder(
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType orderType,
        bytes calldata hookData
    ) external returns (bytes4 selector, OrderDelta memory delta);
    
    /// @notice Called after an order is placed
    /// @param orderId The ID of the placed order
    /// @param trader The address that placed the order
    /// @param isBuy Whether this is a buy order
    /// @param price The order price
    /// @param amount The order amount
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    function afterPlaceOrder(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external returns (bytes4 selector);
    
    /// @notice Called when an order is added to the book (not immediately matched)
    /// @param orderId The ID of the order
    /// @param trader The address that placed the order
    /// @param isBuy Whether this is a buy order
    /// @param price The order price
    /// @param amount The remaining amount added to book
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    function onOrderAddedToBook(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external returns (bytes4 selector);
    
    /// @notice Called before an order is cancelled
    /// @param orderId The ID of the order to cancel
    /// @param trader The address cancelling the order
    /// @param order The order details
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    /// @return allowCancel Whether to allow the cancellation
    function beforeCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external returns (bytes4 selector, bool allowCancel);
    
    /// @notice Called after an order is cancelled
    /// @param orderId The ID of the cancelled order
    /// @param trader The address that cancelled the order
    /// @param order The order details
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    function afterCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external returns (bytes4 selector);
    
    /// @notice Called before orders are matched
    /// @param buyOrderId The ID of the buy order
    /// @param sellOrderId The ID of the sell order
    /// @param matchPrice The price at which orders will match
    /// @param matchAmount The amount to be matched
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    /// @return delta Adjustments to make to the match
    function beforeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external returns (bytes4 selector, MatchDelta memory delta);
    
    /// @notice Called after orders are matched
    /// @param buyOrderId The ID of the buy order
    /// @param sellOrderId The ID of the sell order
    /// @param buyer The address of the buyer
    /// @param seller The address of the seller
    /// @param matchPrice The price at which orders matched
    /// @param matchAmount The amount matched
    /// @param hookData Arbitrary data passed by the user
    /// @return selector The function selector (for validation)
    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external returns (bytes4 selector);
}