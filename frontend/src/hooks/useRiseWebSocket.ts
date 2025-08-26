import { useCallback } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';

export function useRiseWebSocket() {
  const { client, isConnected, error, subscribeToContract: wsSubscribe, unsubscribeFromContract } = useWebSocket();

  const subscribeToContract = useCallback((
    contractAddress: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _eventNames?: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback?: (event: unknown) => void
  ) => {
    // Note: eventNames filtering would need to be implemented in the callback
    // For now, just subscribe to all events from the contract
    wsSubscribe(contractAddress);
    
    // Return a dummy subscription ID for compatibility
    return `sub_${contractAddress}`;
  }, [wsSubscribe]);


  const unsubscribe = useCallback((subscriptionId: string) => {
    // Extract address from subscription ID
    const address = subscriptionId.replace('sub_', '');
    unsubscribeFromContract(address);
  }, [unsubscribeFromContract]);

  const disconnect = useCallback(() => {
    // Client disconnection is handled automatically
  }, []);

  return {
    isConnected,
    error,
    subscribeToContract,
    unsubscribe,
    disconnect,
    client
  };
}