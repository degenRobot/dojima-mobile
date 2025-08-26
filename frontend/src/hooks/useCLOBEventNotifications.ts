import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { contracts } from '@/contracts/contracts';
import { toast } from '@/lib/toast-manager';

interface OrderMatchedEvent {
  orderHashes: readonly [`0x${string}`, `0x${string}`];
  executedAmount: bigint;
  executionPrice: bigint;
}

interface OrderCancelledEvent {
  orderHash: `0x${string}`;
  maker: `0x${string}`;
}

interface OrderPlacedEvent {
  orderHash: `0x${string}`;
  maker: `0x${string}`;
  makerAsset: `0x${string}`;
  takerAsset: `0x${string}`;
  makingAmount: bigint;
  takingAmount: bigint;
  isBuyOrder: boolean;
  price: bigint;
}

export function useCLOBEventNotifications(
  userOrderHashes?: Set<string>,
  onOrderMatched?: (orderHash: string) => void,
  onOrderCancelled?: (orderHash: string) => void
) {
  const { address } = useAccount();
  const { contractEvents } = useWebSocket();
  const processedEvents = useRef(new Set<string>());

  useEffect(() => {
    if (!address) return;

    // Filter for EnhancedSpotBook events
    const clobEvents = contractEvents.filter(
      event => event.address?.toLowerCase() === contracts.EnhancedSpotBook.address.toLowerCase()
    );

    clobEvents.forEach(event => {
      if (!event.eventName || !event.args) return;

      // Create unique event ID to prevent duplicate processing
      const eventId = `${event.eventName}-${event.transactionHash}-${event.logIndex}`;
      
      if (processedEvents.current.has(eventId)) return;
      processedEvents.current.add(eventId);

      // Handle OrderMatched events
      if (event.eventName === 'OrderMatched' && event.args) {
        const args = event.args as unknown as OrderMatchedEvent;
        
        if (args.orderHashes && args.orderHashes.length >= 2) {
          const [orderHash1, orderHash2] = args.orderHashes;
          
          // Check if either order belongs to the user
          const isUserOrder = userOrderHashes?.has(orderHash1) || userOrderHashes?.has(orderHash2);
          
          if (isUserOrder) {
            const executedAmount = args.executedAmount ? formatUnits(args.executedAmount, 18) : '0';
            const executionPrice = args.executionPrice ? formatUnits(args.executionPrice, 18) : '0';
            
            toast.success(
              `Order matched! Amount: ${Number(executedAmount).toFixed(4)}, Price: $${Number(executionPrice).toFixed(2)}`,
              { 
                autoClose: 5000,
                position: 'top-right' as const
              }
            );

            // Notify parent component
            if (userOrderHashes?.has(orderHash1)) {
              onOrderMatched?.(orderHash1);
            }
            if (userOrderHashes?.has(orderHash2)) {
              onOrderMatched?.(orderHash2);
            }
          }
        }
      }

      // Handle OrderCancelled events
      if (event.eventName === 'OrderCancelled' && event.args) {
        const args = event.args as unknown as OrderCancelledEvent;
        
        // Check if the cancelled order belongs to the user
        if (args.maker && args.maker.toLowerCase() === address.toLowerCase()) {
          toast.info('Order cancelled successfully', {
            autoClose: 3000,
            position: 'top-right' as const
          });

          onOrderCancelled?.(args.orderHash);
        }
      }

      // Handle OrderPlaced events for the current user
      if (event.eventName === 'OrderPlaced' && event.args) {
        const args = event.args as unknown as OrderPlacedEvent;
        
        // Only show notification for user's own orders
        if (args.maker && args.maker.toLowerCase() === address.toLowerCase()) {
          const price = args.price ? formatUnits(args.price, 18) : '0';
          const amount = args.makingAmount ? formatUnits(args.makingAmount, 18) : '0';
          
          toast.success(
            `Order placed! ${args.isBuyOrder ? 'Buy' : 'Sell'} ${Number(amount).toFixed(4)} at $${Number(price).toFixed(2)}`,
            {
              autoClose: 4000,
              position: 'top-right' as const
            }
          );
        }
      }
    });

    // Clean up old processed events periodically (keep last 1000)
    if (processedEvents.current.size > 1000) {
      const eventIds = Array.from(processedEvents.current);
      processedEvents.current = new Set(eventIds.slice(-1000));
    }
  }, [contractEvents, address, userOrderHashes, onOrderMatched, onOrderCancelled]);
}