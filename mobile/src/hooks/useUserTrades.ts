import { useIndexerQuery } from './useIndexer';
import * as queries from '../graphql/queries';

export function useUserTrades(userAddress?: string) {
  return useIndexerQuery(
    ['userTrades', userAddress || ''],
    queries.GET_USER_TRADES,
    { user: userAddress?.toLowerCase(), limit: 50 },
    { enabled: !!userAddress },
    { buyTrades: { items: [] }, sellTrades: { items: [] } }
  );
}

export function useUserActivity(userAddress?: string) {
  return useIndexerQuery(
    ['userActivity', userAddress || ''],
    queries.GET_USER_ACTIVITY,
    { user: userAddress?.toLowerCase(), limit: 100 },
    { enabled: !!userAddress },
    { userActivitys: { items: [] } }
  );
}