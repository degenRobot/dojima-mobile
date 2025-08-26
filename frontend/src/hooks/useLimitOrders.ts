import { parseEther } from 'viem';
import { createContractHook } from '@/hooks/useContractFactory';
import { createTransactionCallbacks } from '@/lib/transaction-callbacks';

// Create contract hook
const useEnhancedSpotBookContract = createContractHook('EnhancedSpotBook');

// OrderType enum from the contract
enum OrderType {
  LIMIT = 0,
  MARKET = 1,
  POST_ONLY = 2,
}

export function useLimitOrders() {
  const { write: writeCLOB, isLoading } = useEnhancedSpotBookContract();

  const placeLimitOrder = async (
    side: 'buy' | 'sell',
    price: string,
    amount: string
  ) => {
    try {
      // Parse price and amount with appropriate decimals
      // Price is in quote tokens (USDC) with 18 decimals for the contract
      const parsedPrice = parseEther(price);
      
      // Amount is in base tokens (WETH) with 18 decimals
      const parsedAmount = parseEther(amount);
      
      // Create args array explicitly
      const orderArgs = [
        side === 'buy', // isBuy
        parsedPrice,     // price (uint128)
        parsedAmount,    // amount (uint128)
        OrderType.LIMIT  // orderType
      ];
      
      // Create callbacks with order metadata
      const callbacks = createTransactionCallbacks({
        action: 'Place Order',
        details: {
          side: side.toUpperCase(),
          price: price,
          amount: amount,
          orderType: 'LIMIT'
        }
      });
      
      // Call placeOrder with limit order type and callbacks
      const result = await writeCLOB('placeOrder', orderArgs, {
        callbacks,
        metadata: {
          action: 'Place Order',
          details: {
            side: side.toUpperCase(),
            price: price,
            amount: amount,
            orderType: 'LIMIT'
          }
        }
      });
      
      return result;
    } catch (error) {
      // Error is already handled by the callbacks
      throw error;
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      // Create callbacks for order cancellation
      const callbacks = createTransactionCallbacks({
        action: 'Cancel Order',
        details: {
          orderId: orderId
        }
      });
      
      const result = await writeCLOB('cancelOrder', [orderId], {
        callbacks,
        metadata: {
          action: 'Cancel Order',
          details: {
            orderId: orderId
          }
        }
      });
      
      return result;
    } catch (error) {
      // Error is already handled by the callbacks
      throw error;
    }
  };

  return {
    placeLimitOrder,
    cancelOrder,
    isLoading,
  };
}