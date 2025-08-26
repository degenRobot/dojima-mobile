// Import handlers
import "./enhancedSpotBook";
import "./factory";
// import "./intervals"; // Block intervals not supported in v0.11

import { ponder } from "ponder:registry";
import {
  account,
  allowance,
  approvalEvent,
  transferEvent,
} from "ponder:schema";

ponder.on("ERC20:Transfer", async ({ event, context }) => {
  const timestamp = Number(event.block.timestamp);
  
  await context.db
    .insert(account)
    .values({ 
      address: event.args.from, 
      balance: 0n, 
      isOwner: false,
      firstSeenAt: timestamp,
      lastActiveAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance - event.args.amount,
      lastActiveAt: timestamp,
    }));

  await context.db
    .insert(account)
    .values({
      address: event.args.to,
      balance: event.args.amount,
      isOwner: false,
      firstSeenAt: timestamp,
      lastActiveAt: timestamp,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance + event.args.amount,
      lastActiveAt: timestamp,
    }));

  // add row to "transfer_event".
  await context.db.insert(transferEvent).values({
    id: event.id,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    from: event.args.from,
    to: event.args.to,
  });
});

ponder.on("ERC20:Approval", async ({ event, context }) => {
  // upsert "allowance".
  await context.db
    .insert(allowance)
    .values({
      spender: event.args.spender,
      owner: event.args.owner,
      amount: event.args.amount,
    })
    .onConflictDoUpdate({ amount: event.args.amount });

  // add row to "approval_event".
  await context.db.insert(approvalEvent).values({
    id: event.id,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    owner: event.args.owner,
    spender: event.args.spender,
  });
});