# CLOB Decimal Handling Documentation

## Overview
The CLOB contracts handle decimals in a specific way to optimize for gas efficiency and precision. Understanding this system is crucial for correct frontend implementation.

## Token Decimals
- **WETH**: 18 decimals (standard)
- **USDC**: 6 decimals (common for stablecoins)

## How the Contract Handles Decimals

### Price Storage
- **All prices are stored in 18 decimals** regardless of the quote token's native decimals
- This normalization allows consistent math operations across different token pairs
- Example: A price of 2500 USDC is stored as `2500000000000000000000` (2500 * 10^18)

### Amount Storage
- **Amounts are stored in the base token's native decimals**
- For WETH/USDC pair: amounts are in 18 decimals (WETH's native)
- Example: 1 WETH is stored as `1000000000000000000` (1 * 10^18)

### Internal Conversions
The SpotBook contract has two key functions:
```solidity
// Convert quote amount from 18 decimals to native decimals
function _toQuoteDecimals(uint256 amount18) internal view returns (uint256) {
    return quoteDecimals < 18 
        ? amount18 / quoteDecimalsFactor  // For USDC: divide by 10^12
        : amount18;
}

// Convert quote amount from native decimals to 18 decimals
function _toQuoteDecimals18(uint256 amountNative) internal view returns (uint256) {
    return quoteDecimals < 18
        ? amountNative * quoteDecimalsFactor  // For USDC: multiply by 10^12
        : amountNative;
}
```

### When Conversions Happen
1. **Order Placement**:
   - Buy orders: Calculate quote amount needed (price * amount / 10^18)
   - Convert to USDC's 6 decimals for balance checks
   
2. **Order Matching**:
   - Calculate quote amount in 18 decimals
   - Convert to 6 decimals for actual balance updates

## Frontend Implementation

### Current Implementation (useLimitOrders.ts)
```typescript
// Price is parsed to 18 decimals - CORRECT
const parsedPrice = parseEther(price);  // "2500" -> 2500 * 10^18

// Amount is parsed to 18 decimals - CORRECT for WETH
const parsedAmount = parseEther(amount); // "1" -> 1 * 10^18
```

### Display Considerations
When displaying data from the blockchain:

1. **Prices**: Always divide by 10^18 to get human-readable format
2. **Amounts**: Divide by the base token's decimals (18 for WETH)
3. **Quote amounts**: The contract handles conversion internally

### Example Calculation
For a buy order of 1 WETH at 2500 USDC:
1. User inputs: amount = "1", price = "2500"
2. Frontend sends: amount = 10^18, price = 2500 * 10^18
3. Contract calculates: quoteAmount = (10^18 * 2500 * 10^18) / 10^18 = 2500 * 10^18
4. Contract converts for USDC balance: 2500 * 10^18 / 10^12 = 2500 * 10^6 (actual USDC units)

## Current Issues

### Order Book Display
The order book correctly formats prices by dividing by 10^18:
```typescript
const price = Number(formatUnits(BigInt(order.price), 18));
```

### Order Form Total Calculation
The order form has a hardcoded calculation that may not be accurate:
```typescript
// Line 169: Hardcoded 1000 multiplier
{side === 'buy' 
  ? `${(parseFloat(amount || '0') * 1000).toFixed(2)} USDC`
  : `${amount || '0'} WETH`
}
```

This should use the actual price from the form:
```typescript
{side === 'buy' 
  ? `${(parseFloat(amount || '0') * parseFloat(price || '0')).toFixed(2)} USDC`
  : `${amount || '0'} WETH`
}
```

## Recommendations

1. **No changes needed to contract interaction** - The current implementation correctly sends prices in 18 decimals
2. **Fix the order form total calculation** to use actual price instead of hardcoded value
3. **Add utility functions** for consistent decimal handling across the app:
   ```typescript
   export const formatPrice = (price: bigint) => formatUnits(price, 18);
   export const formatWETH = (amount: bigint) => formatUnits(amount, 18);
   export const formatUSDC = (amount: bigint) => formatUnits(amount, 6);
   ```

## Testing
To verify decimal handling:
1. Place a buy order for 0.1 WETH at 2500 USDC
2. Check that 250 USDC is locked from the buyer's balance
3. When matched, verify the seller receives ~250 USDC (minus fees)