import { GraphQLClient } from 'graphql-request';

// Configure the GraphQL client for Ponder indexer
const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:42069';

export const gqlClient = new GraphQLClient(INDEXER_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to handle errors
export async function gqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  try {
    return await gqlClient.request<T>(query, variables);
  } catch (error) {
    throw error;
  }
}

// Types for common GraphQL responses
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

// Moved PaginatedResponse to types.ts to avoid circular dependencies