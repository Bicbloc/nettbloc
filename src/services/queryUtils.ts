import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export class QueryTimeoutError extends Error {
  constructor(message = 'Query timeout exceeded') {
    super(message);
    this.name = 'QueryTimeoutError';
  }
}

export async function safeQuery<T>(
  queryPromise: Promise<T>,
  timeoutMs = 10000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new QueryTimeoutError()), timeoutMs)
  );

  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof QueryTimeoutError) {
      console.error('Query timeout exceeded');
    } else {
      console.error('Query failed:', error);
    }
    throw error;
  }
}

export async function retryQuery<T>(
  queryFn: () => Promise<T>,
  maxAttempts = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
