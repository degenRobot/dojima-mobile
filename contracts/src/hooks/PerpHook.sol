// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "./BaseCLOBHook.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {IPerp} from "../interfaces/IPerp.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";

/// @title PerpHook
/// @notice Hook that opens perpetual positions when orders are matched
contract PerpHook is BaseCLOBHook {
    IPerp public immutable perp;
    address public immutable orderBook;
    
    // Mapping to track which orders should open perp positions
    mapping(uint256 => bool) public isPerpOrder;
    
    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "Only orderbook");
        _;
    }
    
    constructor(address _perp, address _orderBook) {
        perp = IPerp(_perp);
        orderBook = _orderBook;
    }
    
    /// @notice Check if order should open perp position based on hook data
    /// @dev Hook data format: first byte 0x01 means perp order
    function _isPerpOrder(bytes calldata hookData) internal pure returns (bool) {
        return hookData.length > 0 && hookData[0] == 0x01;
    }
    
    /// @notice Called after an order is placed - mark if it's a perp order
    function afterPlaceOrder(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        if (_isPerpOrder(hookData)) {
            isPerpOrder[orderId] = true;
        }
        return this.afterPlaceOrder.selector;
    }
    
    /// @notice Called after orders are matched - open perp positions
    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Check if either order is a perp order
        bool buyerWantsPerp = isPerpOrder[buyOrderId];
        bool sellerWantsPerp = isPerpOrder[sellOrderId];
        
        // Open long position for buyer if they want perp
        if (buyerWantsPerp) {
            perp.openPosition(buyer, matchAmount, matchPrice, true);
        }
        
        // Open short position for seller if they want perp
        if (sellerWantsPerp) {
            perp.openPosition(seller, matchAmount, matchPrice, false);
        }
        
        return this.afterMatch.selector;
    }
    
    /// @notice Clean up when orders are cancelled
    function afterCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Clean up perp order tracking
        delete isPerpOrder[orderId];
        return this.afterCancelOrder.selector;
    }
}