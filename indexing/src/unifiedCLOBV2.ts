import { ponder } from "ponder:registry";

// Helper function to get order status string
function getOrderStatus(status: number): string {
  const statuses = ["ACTIVE", "PARTIALLY_FILLED", "FILLED", "CANCELLED"];
  return statuses[status] || "UNKNOWN";
}

// Helper function to get order type string
function getOrderType(orderType: number): string {
  return orderType === 0 ? "BUY" : "SELL";
}

// =====================
// BookCreated Event
// =====================
ponder.on("UnifiedCLOBV2:BookCreated", async ({ event, context }) => {
  const { db } = context;
  
  // Create trading book
  await db.TradingBook.create({
    id: event.args.bookId.toString(),
    data: {
      baseToken: event.args.baseToken.toLowerCase(),
      quoteToken: event.args.quoteToken.toLowerCase(),
      name: event.args.name,
      active: true,
      volume24h: 0n,
      totalVolume: 0n,
      buyOrderCount: 0,
      sellOrderCount: 0,
      createdAt: Number(event.block.timestamp),
      updatedAt: Number(event.block.timestamp),
    },
  });
});

// =====================
// OrderPlaced Event
// =====================
ponder.on("UnifiedCLOBV2:OrderPlaced", async ({ event, context }) => {
  const { db } = context;
  
  const orderId = event.args.orderId.toString();
  const bookId = event.args.bookId.toString();
  const orderType = getOrderType(Number(event.args.orderType));
  
  // Create order
  await db.CLOBOrder.create({
    id: orderId,
    data: {
      trader: event.args.trader.toLowerCase(),
      bookId,
      orderType,
      price: event.args.price,
      amount: event.args.amount,
      filled: 0n,
      remaining: event.args.amount,
      status: "ACTIVE",
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
      blockNumber: Number(event.block.number),
    },
  });
  
  // Update book order count
  const book = await db.TradingBook.findUnique({ id: bookId });
  if (book) {
    if (orderType === "BUY") {
      await db.TradingBook.update({
        id: bookId,
        data: {
          buyOrderCount: book.buyOrderCount + 1,
          updatedAt: Number(event.block.timestamp),
        },
      });
    } else {
      await db.TradingBook.update({
        id: bookId,
        data: {
          sellOrderCount: book.sellOrderCount + 1,
          updatedAt: Number(event.block.timestamp),
        },
      });
    }
  }
  
  // Record user activity
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      user: event.args.trader.toLowerCase(),
      activityType: "ORDER_PLACED",
      bookId,
      orderId,
      amount: event.args.amount,
      price: event.args.price,
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
    },
  });
});

// =====================
// OrderMatched Event
// =====================
ponder.on("UnifiedCLOBV2:OrderMatched", async ({ event, context }) => {
  const { db } = context;
  
  const buyOrderId = event.args.buyOrderId.toString();
  const sellOrderId = event.args.sellOrderId.toString();
  const bookId = event.args.bookId.toString();
  const amount = event.args.amount;
  const price = event.args.price;
  
  // Create trade record
  await db.Trade.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      bookId,
      buyOrderId,
      sellOrderId,
      buyer: event.args.buyer.toLowerCase(),
      seller: event.args.seller.toLowerCase(),
      price,
      amount,
      buyerFee: event.args.buyerFee,
      sellerFee: event.args.sellerFee,
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
      blockNumber: Number(event.block.number),
    },
  });
  
  // Update buy order
  const buyOrder = await db.CLOBOrder.findUnique({ id: buyOrderId });
  if (buyOrder) {
    const newFilled = buyOrder.filled + amount;
    const newRemaining = buyOrder.amount - newFilled;
    const newStatus = newRemaining === 0n ? "FILLED" : "PARTIALLY_FILLED";
    
    await db.CLOBOrder.update({
      id: buyOrderId,
      data: {
        filled: newFilled,
        remaining: newRemaining,
        status: newStatus,
      },
    });
  }
  
  // Update sell order
  const sellOrder = await db.CLOBOrder.findUnique({ id: sellOrderId });
  if (sellOrder) {
    const newFilled = sellOrder.filled + amount;
    const newRemaining = sellOrder.amount - newFilled;
    const newStatus = newRemaining === 0n ? "FILLED" : "PARTIALLY_FILLED";
    
    await db.CLOBOrder.update({
      id: sellOrderId,
      data: {
        filled: newFilled,
        remaining: newRemaining,
        status: newStatus,
      },
    });
  }
  
  // Update trading book stats
  const book = await db.TradingBook.findUnique({ id: bookId });
  if (book) {
    const quoteVolume = (amount * price) / 10n ** 18n; // Adjust for decimals
    await db.TradingBook.update({
      id: bookId,
      data: {
        lastPrice: price,
        totalVolume: book.totalVolume + quoteVolume,
        updatedAt: Number(event.block.timestamp),
      },
    });
    
    // Update order counts if orders are filled
    let buyOrderCountDelta = 0;
    let sellOrderCountDelta = 0;
    
    if (buyOrder && buyOrder.amount - buyOrder.filled === amount) {
      buyOrderCountDelta = -1;
    }
    if (sellOrder && sellOrder.amount - sellOrder.filled === amount) {
      sellOrderCountDelta = -1;
    }
    
    if (buyOrderCountDelta !== 0 || sellOrderCountDelta !== 0) {
      await db.TradingBook.update({
        id: bookId,
        data: {
          buyOrderCount: book.buyOrderCount + buyOrderCountDelta,
          sellOrderCount: book.sellOrderCount + sellOrderCountDelta,
        },
      });
    }
  }
  
  // Record user activities
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}-buyer`,
    data: {
      user: event.args.buyer.toLowerCase(),
      activityType: "TRADE",
      bookId,
      orderId: buyOrderId,
      amount,
      price,
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
    },
  });
  
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}-seller`,
    data: {
      user: event.args.seller.toLowerCase(),
      activityType: "TRADE",
      bookId,
      orderId: sellOrderId,
      amount,
      price,
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
    },
  });
});

// =====================
// OrderCancelled Event
// =====================
ponder.on("UnifiedCLOBV2:OrderCancelled", async ({ event, context }) => {
  const { db } = context;
  
  const orderId = event.args.orderId.toString();
  
  // Update order status
  const order = await db.CLOBOrder.findUnique({ id: orderId });
  if (order) {
    await db.CLOBOrder.update({
      id: orderId,
      data: {
        status: "CANCELLED",
      },
    });
    
    // Update book order count
    const book = await db.TradingBook.findUnique({ id: order.bookId });
    if (book) {
      if (order.orderType === "BUY") {
        await db.TradingBook.update({
          id: order.bookId,
          data: {
            buyOrderCount: Math.max(0, book.buyOrderCount - 1),
            updatedAt: Number(event.block.timestamp),
          },
        });
      } else {
        await db.TradingBook.update({
          id: order.bookId,
          data: {
            sellOrderCount: Math.max(0, book.sellOrderCount - 1),
            updatedAt: Number(event.block.timestamp),
          },
        });
      }
    }
  }
  
  // Record user activity
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      user: event.args.trader.toLowerCase(),
      activityType: "ORDER_CANCELLED",
      orderId,
      timestamp: Number(event.args.timestamp),
      txHash: event.transaction.hash,
    },
  });
});

// =====================
// Deposited Event
// =====================
ponder.on("UnifiedCLOBV2:Deposited", async ({ event, context }) => {
  const { db } = context;
  
  const userId = event.args.user.toLowerCase();
  const token = event.args.token.toLowerCase();
  const balanceId = `${userId}-${token}`;
  
  // Update or create user balance
  const existingBalance = await db.UserBalance.findUnique({ id: balanceId });
  
  if (existingBalance) {
    await db.UserBalance.update({
      id: balanceId,
      data: {
        available: existingBalance.available + event.args.amount,
        totalDeposited: existingBalance.totalDeposited + event.args.amount,
        lastUpdated: Number(event.block.timestamp),
      },
    });
  } else {
    await db.UserBalance.create({
      id: balanceId,
      data: {
        user: userId,
        token,
        available: event.args.amount,
        locked: 0n,
        totalDeposited: event.args.amount,
        totalWithdrawn: 0n,
        lastUpdated: Number(event.block.timestamp),
      },
    });
  }
  
  // Record user activity
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      user: userId,
      activityType: "DEPOSIT",
      token,
      amount: event.args.amount,
      timestamp: Number(event.block.timestamp),
      txHash: event.transaction.hash,
    },
  });
});

// =====================
// Withdrawn Event
// =====================
ponder.on("UnifiedCLOBV2:Withdrawn", async ({ event, context }) => {
  const { db } = context;
  
  const userId = event.args.user.toLowerCase();
  const token = event.args.token.toLowerCase();
  const balanceId = `${userId}-${token}`;
  
  // Update user balance
  const existingBalance = await db.UserBalance.findUnique({ id: balanceId });
  
  if (existingBalance) {
    await db.UserBalance.update({
      id: balanceId,
      data: {
        available: existingBalance.available - event.args.amount,
        totalWithdrawn: existingBalance.totalWithdrawn + event.args.amount,
        lastUpdated: Number(event.block.timestamp),
      },
    });
  }
  
  // Record user activity
  await db.UserActivity.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      user: userId,
      activityType: "WITHDRAW",
      token,
      amount: event.args.amount,
      timestamp: Number(event.block.timestamp),
      txHash: event.transaction.hash,
    },
  });
});

// =====================
// PriceUpdate Event
// =====================
ponder.on("UnifiedCLOBV2:PriceUpdate", async ({ event, context }) => {
  const { db } = context;
  
  const bookId = event.args.bookId.toString();
  
  // Update trading book with latest price
  await db.TradingBook.update({
    id: bookId,
    data: {
      lastPrice: event.args.price,
      updatedAt: Number(event.args.timestamp),
    },
  });
  
  // Update market stats for different periods
  const periods = ["1h", "24h", "7d"];
  const timestamp = Number(event.args.timestamp);
  
  for (const period of periods) {
    const statId = `${bookId}-${period}`;
    const existingStat = await db.MarketStats.findUnique({ id: statId });
    
    if (existingStat) {
      const high = existingStat.high && existingStat.high > event.args.price 
        ? existingStat.high 
        : event.args.price;
      const low = existingStat.low && existingStat.low < event.args.price 
        ? existingStat.low 
        : event.args.price;
      
      await db.MarketStats.update({
        id: statId,
        data: {
          high,
          low,
          close: event.args.price,
          timestamp,
        },
      });
    } else {
      await db.MarketStats.create({
        id: statId,
        data: {
          bookId,
          period,
          high: event.args.price,
          low: event.args.price,
          open: event.args.price,
          close: event.args.price,
          volume: 0n,
          trades: 0,
          timestamp,
        },
      });
    }
  }
});

// =====================
// VolumeUpdate Event
// =====================
ponder.on("UnifiedCLOBV2:VolumeUpdate", async ({ event, context }) => {
  const { db } = context;
  
  const bookId = event.args.bookId.toString();
  
  // Update market stats with volume
  const periods = ["1h", "24h", "7d"];
  
  for (const period of periods) {
    const statId = `${bookId}-${period}`;
    const existingStat = await db.MarketStats.findUnique({ id: statId });
    
    if (existingStat) {
      await db.MarketStats.update({
        id: statId,
        data: {
          volume: existingStat.volume + event.args.volume,
          trades: existingStat.trades + 1,
          timestamp: Number(event.args.timestamp),
        },
      });
    }
  }
});