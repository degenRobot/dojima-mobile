/**
 * Decimal handling utilities for UnifiedCLOB
 * 
 * IMPORTANT: The UnifiedCLOB contract expects prices to be in the quote token's decimals
 * This ensures proper calculation when: quoteAmount = (amount * price) / 10^18
 */

export const TOKEN_DECIMALS = {
    USDC: 6,
    WETH: 18,
    WBTC: 8
};

/**
 * Convert a human-readable price to the correct format for the contract
 * @param {number} humanPrice - The price in human-readable format (e.g., 2000 for 2000 USDC per WETH)
 * @param {string} quoteToken - The quote token symbol (e.g., 'USDC')
 * @returns {bigint} The price in the correct decimal format for the contract
 */
export function formatPrice(humanPrice, quoteToken) {
    const decimals = TOKEN_DECIMALS[quoteToken];
    if (!decimals) throw new Error(`Unknown token: ${quoteToken}`);
    
    // Convert to the quote token's decimals
    return BigInt(Math.floor(humanPrice * 10 ** decimals));
}

/**
 * Convert a human-readable amount to the correct format for the contract
 * @param {number} humanAmount - The amount in human-readable format (e.g., 0.1 for 0.1 WETH)
 * @param {string} token - The token symbol (e.g., 'WETH')
 * @returns {bigint} The amount in the correct decimal format
 */
export function formatAmount(humanAmount, token) {
    const decimals = TOKEN_DECIMALS[token];
    if (!decimals) throw new Error(`Unknown token: ${token}`);
    
    return BigInt(Math.floor(humanAmount * 10 ** decimals));
}

/**
 * Helper to get book info and determine quote token
 * @param {number} bookId - The book ID
 * @returns {object} Book information including base and quote tokens
 */
export function getBookInfo(bookId) {
    const books = {
        1: { base: 'WETH', quote: 'USDC', symbol: 'WETH/USDC' },
        2: { base: 'WBTC', quote: 'USDC', symbol: 'WBTC/USDC' },
        3: { base: 'WETH', quote: 'WBTC', symbol: 'WETH/WBTC' }
    };
    
    return books[bookId] || null;
}

/**
 * Format an order for the UnifiedCLOB contract
 * @param {number} bookId - Trading book ID
 * @param {boolean} isBuy - true for buy, false for sell
 * @param {number} humanPrice - Human readable price
 * @param {number} humanAmount - Human readable amount of base token
 * @returns {object} Formatted order parameters
 */
export function formatOrder(bookId, isBuy, humanPrice, humanAmount) {
    const book = getBookInfo(bookId);
    if (!book) throw new Error(`Invalid book ID: ${bookId}`);
    
    // Price is always in quote token decimals
    const price = formatPrice(humanPrice, book.quote);
    
    // Amount is always in base token decimals (what you're buying/selling)
    const amount = formatAmount(humanAmount, book.base);
    
    console.log(`📊 Formatting order for ${book.symbol}:`);
    console.log(`   Human: ${humanAmount} ${book.base} @ ${humanPrice} ${book.quote}`);
    console.log(`   Contract: amount=${amount} (${book.base} decimals), price=${price} (${book.quote} decimals)`);
    
    return { price, amount, book };
}

/**
 * Calculate the quote amount needed for a buy order
 * @param {bigint} baseAmount - Amount of base token
 * @param {bigint} price - Price in quote token decimals
 * @returns {bigint} Quote amount needed
 */
export function calculateQuoteAmount(baseAmount, price) {
    return (baseAmount * price) / BigInt(10 ** 18);
}