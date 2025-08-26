import { ponder } from "ponder:registry";
import { market, market24hStats } from "ponder:schema";

// ============================================
// FACTORY & PAIR DISCOVERY
// ============================================

// Track new spot pairs as they're created from SpotFactory
ponder.on("SpotFactory:SpotPairCreated", async ({ event, context }) => {
  const { baseToken, quoteToken, pairAddress, pairId } = event.args;
  const timestamp = Number(event.block.timestamp);
  
  // Create market record
  await context.db.insert(market).values({
    address: pairAddress,
    pairId,
    type: "SPOT",
    baseToken,
    quoteToken,
    name: `${baseToken.slice(0, 6)}-${quoteToken.slice(0, 6)}`, // TODO: Fetch actual symbols
    deployedAt: timestamp,
    isActive: true,
  });
  
  // Initialize market stats
  await context.db.insert(market24hStats).values({
    market: pairAddress,
    volume24h: 0n,
    trades24h: 0,
    high24h: 0n,
    low24h: 0n,
    lastUpdate: timestamp,
  });
  
  console.log(`New spot pair indexed: ${pairAddress} (${baseToken} / ${quoteToken})`);
});