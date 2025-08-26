import { ponder } from "ponder:registry";
import {
  account,
  balance,
  deposit,
  withdrawal,
  orderHistory,
  activeOrder,
  priceLevel,
  trade,
  userTrade,
  market24hStats,
  marketPrice,
  hourlyVolume,
  market,
  priceCandle,
} from "ponder:schema";

// ============================================
// ORDER PLACEMENT
// ============================================

ponder.on("EnhancedSpotBook:OrderPlaced", async ({ event, context }) => {
  const { orderId, trader, isBuy, price, amount } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  // Create/update account
  await context.db.insert(account)
    .values({
      address: trader,
      balance: 0n,
      isOwner: false,
      firstSeenAt: timestamp,
      lastActiveAt: timestamp,
      totalTradesCount: 0,
      totalVolumeUsd: 0n,
      totalFeesPaid: 0n,
    })
    .onConflictDoUpdate({
      lastActiveAt: timestamp,
    });
  
  // Add to order history
  await context.db.insert(orderHistory).values({
    id: `${marketAddress}-${orderId}`,
    market: marketAddress,
    orderId,
    trader,
    isBuy,
    orderType: "LIMIT", // EnhancedSpotBook only supports limit orders
    price,
    originalAmount: amount,
    filledAmount: 0n,
    status: "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  
  // Add to active orders
  await context.db.insert(activeOrder).values({
    id: `${marketAddress}-${orderId}`,
    market: marketAddress,
    orderId,
    trader,
    isBuy,
    price,
    originalAmount: amount,
    remainingAmount: amount,
    timestamp,
  });
  
  // Update price level
  const priceLevelId = `${marketAddress}-${price}-${isBuy}`;
  const existingLevel = await context.db.find(priceLevel, { id: priceLevelId });
  
  if (existingLevel) {
    await context.db.update(priceLevel, { id: priceLevelId })
      .set({
        totalAmount: existingLevel.totalAmount + amount,
        orderCount: existingLevel.orderCount + 1,
        lastUpdate: timestamp,
      });
  } else {
    await context.db.insert(priceLevel).values({
      id: priceLevelId,
      market: marketAddress,
      price,
      isBuy,
      totalAmount: amount,
      orderCount: 1,
      lastUpdate: timestamp,
    });
  }
  
  console.log(`Order ${orderId} placed by ${trader} - ${isBuy ? 'BUY' : 'SELL'} ${amount} @ ${price}`);
});

// ============================================
// ORDER MATCHING
// ============================================

ponder.on("EnhancedSpotBook:OrderMatched", async ({ event, context }) => {
  const { buyOrderId, sellOrderId, maker, taker, price, amount } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  // Calculate quote volume (price * amount / 1e18)
  const quoteVolume = (price * amount) / BigInt(10 ** 18);
  
  // TODO: Get actual fee rates from contract
  const makerFeeBps = 10n; // 0.1%
  const takerFeeBps = 30n; // 0.3%
  const makerFee = (quoteVolume * makerFeeBps) / 10000n;
  const takerFee = (quoteVolume * takerFeeBps) / 10000n;
  
  // Determine buyer and seller based on order IDs
  const buyOrderData = await context.db.find(activeOrder, { 
    id: `${marketAddress}-${buyOrderId}` 
  });
  const sellOrderData = await context.db.find(activeOrder, { 
    id: `${marketAddress}-${sellOrderId}` 
  });
  
  const buyer = buyOrderData?.trader || maker;
  const seller = sellOrderData?.trader || taker;
  
  // Create trade record
  const tradeId = `${marketAddress}-${event.block.number}-${event.log.logIndex}`;
  const timestampMinute = Math.floor(timestamp / 60) * 60; // Round down to nearest minute
  
  await context.db.insert(trade).values({
    id: tradeId,
    market: marketAddress,
    buyOrderId,
    sellOrderId,
    buyer,
    seller,
    maker,
    taker,
    price,
    amount,
    quoteVolume,
    makerFee,
    takerFee,
    timestamp,
    timestampMinute,
    blockNumber: Number(event.block.number),
    transactionHash: event.transaction.hash,
  });
  
  // Create user trades
  // For the buyer
  await context.db.insert(userTrade).values({
    id: `${tradeId}-buyer`,
    trader: buyer,
    market: marketAddress,
    orderId: buyOrderId,
    side: "BUY",
    role: buyer === maker ? "MAKER" : "TAKER",
    price,
    amount,
    quoteAmount: quoteVolume,
    fee: buyer === maker ? makerFee : takerFee,
    timestamp,
  });
  
  // For the seller
  await context.db.insert(userTrade).values({
    id: `${tradeId}-seller`,
    trader: seller,
    market: marketAddress,
    orderId: sellOrderId,
    side: "SELL",
    role: seller === maker ? "MAKER" : "TAKER",
    price,
    amount,
    quoteAmount: quoteVolume,
    fee: seller === maker ? makerFee : takerFee,
    timestamp,
  });
  
  // Update order history for both orders
  for (const orderId of [buyOrderId, sellOrderId]) {
    const orderHistoryId = `${marketAddress}-${orderId}`;
    const existingOrder = await context.db.find(orderHistory, { id: orderHistoryId });
    
    if (existingOrder) {
      const newFilledAmount = existingOrder.filledAmount + amount;
      const isFullyFilled = newFilledAmount >= existingOrder.originalAmount;
      
      await context.db.update(orderHistory, { id: orderHistoryId })
        .set({
          filledAmount: newFilledAmount,
          status: isFullyFilled ? "FILLED" : "PARTIALLY_FILLED",
          updatedAt: timestamp,
          filledAt: isFullyFilled ? timestamp : existingOrder.filledAt,
        });
    }
  }
  
  // Update active orders
  for (const orderId of [buyOrderId, sellOrderId]) {
    const activeOrderId = `${marketAddress}-${orderId}`;
    const existingActiveOrder = await context.db.find(activeOrder, { id: activeOrderId });
    
    if (existingActiveOrder) {
      const newRemainingAmount = existingActiveOrder.remainingAmount - amount;
      
      if (newRemainingAmount <= 0n) {
        // Remove from active orders
        await context.db.delete(activeOrder, { id: activeOrderId });
        
        // Update price level
        const priceLevelId = `${marketAddress}-${existingActiveOrder.price}-${existingActiveOrder.isBuy}`;
        const level = await context.db.find(priceLevel, { id: priceLevelId });
        
        if (level) {
          const newTotalAmount = level.totalAmount - existingActiveOrder.originalAmount;
          const newOrderCount = level.orderCount - 1;
          
          if (newOrderCount <= 0) {
            await context.db.delete(priceLevel, { id: priceLevelId });
          } else {
            await context.db.update(priceLevel, { id: priceLevelId })
              .set({
                totalAmount: newTotalAmount,
                orderCount: newOrderCount,
                lastUpdate: timestamp,
              });
          }
        }
      } else {
        // Update remaining amount
        await context.db.update(activeOrder, { id: activeOrderId })
          .set({
            remainingAmount: newRemainingAmount,
          });
      }
    }
  }
  
  // Update market statistics
  await updateMarketStats(context, marketAddress, price, quoteVolume, timestamp);
  
  // Update hourly volume
  await updateHourlyVolume(context, marketAddress, price, quoteVolume, timestamp);
  
  console.log(`Orders matched: Buy ${buyOrderId} x Sell ${sellOrderId} - ${amount} @ ${price}`);
});

// ============================================
// ORDER STATUS CHANGED
// ============================================

ponder.on("EnhancedSpotBook:OrderStatusChanged", async ({ event, context }) => {
  const { orderId, newStatus, remainingAmount } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  const orderHistoryId = `${marketAddress}-${orderId}`;
  const activeOrderId = `${marketAddress}-${orderId}`;
  
  // Update order history
  const existingOrder = await context.db.find(orderHistory, { id: orderHistoryId });
  if (existingOrder) {
    let status: string;
    switch (Number(newStatus)) {
      case 0: status = "ACTIVE"; break;
      case 1: status = "FILLED"; break;
      case 2: status = "PARTIALLY_FILLED"; break;
      case 3: status = "CANCELLED"; break;
      default: status = "UNKNOWN";
    }
    
    await context.db.update(orderHistory, { id: orderHistoryId })
      .set({
        status,
        updatedAt: timestamp,
        filledAt: status === "FILLED" ? timestamp : existingOrder.filledAt,
        cancelledAt: status === "CANCELLED" ? timestamp : existingOrder.cancelledAt,
      });
  }
  
  // If order is filled or cancelled, remove from active orders
  if (Number(newStatus) === 1 || Number(newStatus) === 3) {
    await context.db.delete(activeOrder, { id: activeOrderId });
  }
  
  console.log(`Order ${orderId} status changed to ${newStatus}, remaining: ${remainingAmount}`);
});

// ============================================
// ORDER REMOVED FROM BOOK
// ============================================

ponder.on("EnhancedSpotBook:OrderRemovedFromBook", async ({ event, context }) => {
  const { orderId, reason } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  const activeOrderId = `${marketAddress}-${orderId}`;
  
  // Remove from active orders
  const existingActiveOrder = await context.db.find(activeOrder, { id: activeOrderId });
  if (existingActiveOrder) {
    await context.db.delete(activeOrder, { id: activeOrderId });
    
    // Update price level
    const priceLevelId = `${marketAddress}-${existingActiveOrder.price}-${existingActiveOrder.isBuy}`;
    const level = await context.db.find(priceLevel, { id: priceLevelId });
    
    if (level) {
      const newTotalAmount = level.totalAmount - existingActiveOrder.remainingAmount;
      const newOrderCount = level.orderCount - 1;
      
      if (newOrderCount <= 0) {
        await context.db.delete(priceLevel, { id: priceLevelId });
      } else {
        await context.db.update(priceLevel, { id: priceLevelId })
          .set({
            totalAmount: newTotalAmount,
            orderCount: newOrderCount,
            lastUpdate: timestamp,
          });
      }
    }
  }
  
  console.log(`Order ${orderId} removed from book, reason: ${reason}`);
});

// ============================================
// ORDER CANCELLATION
// ============================================

ponder.on("EnhancedSpotBook:OrderCancelled", async ({ event, context }) => {
  const { orderId, trader } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  const orderHistoryId = `${marketAddress}-${orderId}`;
  const activeOrderId = `${marketAddress}-${orderId}`;
  
  // Update order history
  await context.db.update(orderHistory, { id: orderHistoryId })
    .set({
      status: "CANCELLED",
      updatedAt: timestamp,
      cancelledAt: timestamp,
    });
  
  // Get active order data before deletion
  const activeOrderData = await context.db.find(activeOrder, { id: activeOrderId });
  
  if (activeOrderData) {
    // Remove from active orders
    await context.db.delete(activeOrder, { id: activeOrderId });
    
    // Update price level
    const priceLevelId = `${marketAddress}-${activeOrderData.price}-${activeOrderData.isBuy}`;
    const level = await context.db.find(priceLevel, { id: priceLevelId });
    
    if (level) {
      const newTotalAmount = level.totalAmount - activeOrderData.remainingAmount;
      const newOrderCount = level.orderCount - 1;
      
      if (newOrderCount <= 0) {
        await context.db.delete(priceLevel, { id: priceLevelId });
      } else {
        await context.db.update(priceLevel, { id: priceLevelId })
          .set({
            totalAmount: newTotalAmount,
            orderCount: newOrderCount,
            lastUpdate: timestamp,
          });
      }
    }
  }
  
  console.log(`Order ${orderId} cancelled by ${trader}`);
});

// ============================================
// DEPOSITS & WITHDRAWALS
// ============================================

ponder.on("EnhancedSpotBook:Deposited", async ({ event, context }) => {
  const { user, token, amount } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  // Create deposit record
  await context.db.insert(deposit).values({
    id: `${marketAddress}-${event.block.number}-${event.log.logIndex}`,
    user,
    market: marketAddress,
    token,
    amount,
    timestamp,
    blockNumber: Number(event.block.number),
    transactionHash: event.transaction.hash,
  });
  
  // Update balance
  const balanceId = `${user}-${marketAddress}-${token}`;
  const existingBalance = await context.db.find(balance, { id: balanceId });
  
  if (existingBalance) {
    await context.db.update(balance, { id: balanceId })
      .set({
        available: existingBalance.available + amount,
        total: existingBalance.total + amount,
        lastUpdate: timestamp,
      });
  } else {
    await context.db.insert(balance).values({
      id: balanceId,
      user,
      market: marketAddress,
      token,
      available: amount,
      locked: 0n,
      total: amount,
      lastUpdate: timestamp,
    });
  }
  
  console.log(`${user} deposited ${amount} of ${token}`);
});

ponder.on("EnhancedSpotBook:Withdrawn", async ({ event, context }) => {
  const { user, token, amount } = event.args;
  const timestamp = Number(event.block.timestamp);
  const marketAddress = event.log.address;
  
  // Create withdrawal record
  await context.db.insert(withdrawal).values({
    id: `${marketAddress}-${event.block.number}-${event.log.logIndex}`,
    user,
    market: marketAddress,
    token,
    amount,
    timestamp,
    blockNumber: Number(event.block.number),
    transactionHash: event.transaction.hash,
  });
  
  // Update balance
  const balanceId = `${user}-${marketAddress}-${token}`;
  const existingBalance = await context.db.find(balance, { id: balanceId });
  
  if (existingBalance) {
    await context.db.update(balance, { id: balanceId })
      .set({
        available: existingBalance.available - amount,
        total: existingBalance.total - amount,
        lastUpdate: timestamp,
      });
  }
  
  console.log(`${user} withdrew ${amount} of ${token}`);
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Calculate percentage change between two prices
function calculatePriceChangePercent(oldPrice: bigint, newPrice: bigint): bigint {
  if (oldPrice === 0n) return 0n;
  // Calculate percentage change with 2 decimal precision (multiply by 10000 for basis points)
  const change = ((newPrice - oldPrice) * 10000n) / oldPrice;
  return change;
}

async function updateMarketStats(
  context: any,
  marketAddress: string,
  price: bigint,
  volume: bigint,
  timestamp: number
) {
  // Update 24h stats
  const stats = await context.db.find(market24hStats, { market: marketAddress });
  
  if (stats) {
    // For now, we'll do cumulative stats (not rolling 24h)
    // TODO: Implement proper 24h rolling window with cleanup of old trades
    const newHigh = price > stats.high24h ? price : stats.high24h;
    const newLow = stats.low24h === 0n || price < stats.low24h ? price : stats.low24h;
    
    await context.db.update(market24hStats, { market: marketAddress })
      .set({
        volume24h: stats.volume24h + volume,
        trades24h: stats.trades24h + 1,
        high24h: newHigh,
        low24h: newLow,
        lastUpdate: timestamp,
      });
  } else {
    await context.db.insert(market24hStats).values({
      market: marketAddress,
      volume24h: volume,
      trades24h: 1,
      high24h: price,
      low24h: price,
      lastUpdate: timestamp,
    });
  }
  
  // Update market price
  const existingPrice = await context.db.find(marketPrice, { market: marketAddress });
  
  if (existingPrice) {
    // Calculate price changes
    const priceChange24h = calculatePriceChangePercent(existingPrice.lastPrice, price);
    const priceChange1h = calculatePriceChangePercent(existingPrice.lastPrice, price); // TODO: Track 1h old price
    
    await context.db.update(marketPrice, { market: marketAddress })
      .set({
        lastPrice: price,
        lastTradeId: `${marketAddress}-${timestamp}`,
        lastTradeTimestamp: timestamp,
        priceChange24h,
        priceChange1h,
      });
  } else {
    await context.db.insert(marketPrice).values({
      market: marketAddress,
      lastPrice: price,
      lastTradeId: `${marketAddress}-${timestamp}`,
      lastTradeTimestamp: timestamp,
      priceChange24h: 0n,
      priceChange1h: 0n,
    });
  }
}

async function updateHourlyVolume(
  context: any,
  marketAddress: string,
  price: bigint,
  volume: bigint,
  timestamp: number
) {
  const hourTimestamp = Math.floor(timestamp / 3600) * 3600; // Round to hour
  const hourlyId = `${marketAddress}-${hourTimestamp}`;
  
  const existing = await context.db.find(hourlyVolume, { id: hourlyId });
  
  if (existing) {
    const newHigh = price > existing.high ? price : existing.high;
    const newLow = price < existing.low ? price : existing.low;
    
    await context.db.update(hourlyVolume, { id: hourlyId })
      .set({
        volume: existing.volume + volume,
        trades: existing.trades + 1,
        high: newHigh,
        low: newLow,
        close: price,
      });
  } else {
    await context.db.insert(hourlyVolume).values({
      id: hourlyId,
      market: marketAddress,
      hourTimestamp,
      volume,
      trades: 1,
      high: price,
      low: price,
      open: price,
      close: price,
    });
  }
}

