export interface RetryOptions {
  retries?: number;
  delay?: number;
  factor?: number;
  onRetry?: (err: unknown, attempt: number) => void;
  shouldRetry?: (err: unknown) => boolean;
}

export async function retry<T>(fn: () => Promise<T> | T, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry, shouldRetry = () => true } = options;

  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }

      onRetry?.(err, attempt + 1);
      await new Promise((res) => setTimeout(res, currentDelay));
      currentDelay *= factor;
      attempt++;
    }
  }

  // This should never happen
  throw new Error("Retry mechanism failed unexpectedly.");
}
