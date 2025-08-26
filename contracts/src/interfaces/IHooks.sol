// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IOrderBook} from "./IOrderBook.sol";

interface IHooks {
    // Hook functions
    function beforeOrder(
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType orderType
    ) external returns (bool);

    function afterOrder(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount
    ) external;

    function beforeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint128 matchPrice,
        uint128 matchAmount
    ) external returns (bool);

    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount
    ) external;
}