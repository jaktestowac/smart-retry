export interface RetryOptions {
  retries?: number;
  delay?: number;
  factor?: number;
  onRetry?: (err: unknown, attempt: number) => void;
  shouldRetry?: (err: unknown) => boolean;
}

/**
 * Retries the provided function up to a specified number of times with exponential backoff.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param options - Retry configuration options.
 *   - retries: Maximum number of retry attempts (default: 3).
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail or shouldRetry returns false.
 */
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

/**
 * Retries the provided function up to a specified number of times with exponential backoff and random jitter.
 * Jitter helps to avoid thundering herd problems by randomizing the delay between retries.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param options - Retry configuration options.
 *   - retries: Maximum number of retry attempts (default: 3).
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - jitter: Maximum jitter in milliseconds to add/subtract from delay (default: 100).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail or shouldRetry returns false.
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions & { jitter?: number } = {},
): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, jitter = 100, onRetry, shouldRetry = () => true } = options;
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
      // Add jitter: random value between -jitter and +jitter
      const jitterValue = Math.floor((Math.random() * 2 - 1) * jitter);
      await new Promise((res) => setTimeout(res, Math.max(0, currentDelay + jitterValue)));
      currentDelay *= factor;
      attempt++;
    }
  }
  throw new Error("Retry with jitter failed unexpectedly.");
}

/**
 * Retries the provided function until it succeeds or a total timeout is reached.
 * Uses exponential backoff between attempts.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param options - Retry configuration options.
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - timeout: Maximum total time in milliseconds to keep retrying (default: 2000).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 * @returns The result of the function if successful.
 * @throws The last error encountered if timeout is exceeded or shouldRetry returns false.
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions & { timeout?: number } = {},
): Promise<T> {
  const { delay = 500, factor = 2, timeout = 2000, onRetry, shouldRetry = () => true } = options;
  let attempt = 0;
  let currentDelay = delay;
  const start = Date.now();

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err)) throw err;
      const elapsed = Date.now() - start;
      if (elapsed + currentDelay > timeout) throw err;
      onRetry?.(err, attempt + 1);
      await new Promise((res) => setTimeout(res, currentDelay));
      currentDelay *= factor;
      attempt++;
    }
  }
}

/**
 * Retries the provided function using a custom schedule of delays for each attempt.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param schedule - Array of delays in milliseconds for each retry attempt.
 *   The length of the array determines the maximum number of retries.
 * @param options - Retry configuration options (excluding delay and factor).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail or shouldRetry returns false.
 */
export async function retryWithSchedule<T>(
  fn: () => Promise<T> | T,
  schedule: number[] = [],
  options: Omit<RetryOptions, "delay" | "factor"> = {},
): Promise<T> {
  const { onRetry, shouldRetry = () => true } = options;
  let attempt = 0;

  while (attempt <= schedule.length) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === schedule.length || !shouldRetry(err)) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      await new Promise((res) => setTimeout(res, schedule[attempt]));
      attempt++;
    }
  }
  throw new Error("Retry with schedule failed unexpectedly.");
}

/**
 * Retries the provided function and aborts if the AbortSignal is triggered.
 *
 * @param fn - The function to execute.
 * @param options - Retry options plus an AbortSignal.
 * @returns The result of the function if successful.
 * @throws The last error encountered or AbortError if aborted.
 */
export async function retryWithAbortSignal<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions & { signal: AbortSignal },
): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry, shouldRetry = () => true, signal } = options;
  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    if (signal.aborted) throw new Error("Aborted");
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err) || signal.aborted) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      await Promise.race([
        new Promise((res) => setTimeout(res, currentDelay)),
        new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("Aborted")), { once: true })),
      ]);
      currentDelay *= factor;
      attempt++;
    }
  }
  throw new Error("Retry with abort signal failed unexpectedly.");
}

/**
 * Retries the provided function up to a maximum total number of attempts (including the initial one).
 *
 * @param fn - The function to execute.
 * @param maxAttempts - Maximum total attempts (default: 3).
 * @param options - Retry options (delay, factor, etc).
 * @returns The result of the function if successful.
 * @throws The last error encountered if all attempts fail.
 */
export async function retryWithMaxTotalAttempts<T>(
  fn: () => Promise<T> | T,
  maxAttempts: number = 3,
  options: Omit<RetryOptions, "retries">,
): Promise<T> {
  const { delay = 500, factor = 2, onRetry, shouldRetry = () => true } = options || {};
  let attempt = 0;
  let currentDelay = delay;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1 || !shouldRetry(err)) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      await new Promise((res) => setTimeout(res, currentDelay));
      currentDelay *= factor;
      attempt++;
    }
  }
  throw new Error("Retry with max total attempts failed unexpectedly.");
}

/**
 * Retries the provided function using a predicate to determine the delay for each retry.
 *
 * @param fn - The function to execute.
 * @param getDelay - Function (err, attempt) => delay in ms.
 * @param options - Retry options (retries, onRetry, shouldRetry).
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail.
 */
export async function retryWithPredicateDelay<T>(
  fn: () => Promise<T> | T,
  getDelay: (err: unknown, attempt: number) => number,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 3, onRetry, shouldRetry = () => true } = options;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      const delay = getDelay(err, attempt + 1);
      await new Promise((res) => setTimeout(res, delay));
      attempt++;
    }
  }
  throw new Error("Retry with predicate delay failed unexpectedly.");
}

/**
 * Retries the provided function using decorrelated jitter/randomized backoff.
 * See: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 *
 * @param fn - The function to execute.
 * @param options - Retry options (retries, delay, maxDelay, onRetry, shouldRetry).
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail.
 */
export async function retryWithRandomizedBackoff<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions & { maxDelay?: number } = {},
): Promise<T> {
  const { retries = 3, delay = 500, maxDelay = 30000, onRetry, shouldRetry = () => true } = options;
  let attempt = 0;
  let sleep = delay;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      // Decorrelated jitter: sleep = min(maxDelay, random(delay, sleep * 3))
      sleep = Math.min(maxDelay, Math.random() * (sleep * 3 - delay) + delay);
      await new Promise((res) => setTimeout(res, sleep));
      attempt++;
    }
  }
  throw new Error("Retry with randomized backoff failed unexpectedly.");
}

/**
 * Retries the provided function until the condition predicate returns true.
 *
 * @param fn - The function to execute.
 * @param condition - Predicate (result) => boolean, must return true to stop retrying.
 * @param options - Retry options (retries, delay, factor, onRetry).
 * @returns The result of the function if the condition is met.
 * @throws The last error encountered if all retries fail or condition is never met.
 */
export async function retryUntilCondition<T>(
  fn: () => Promise<T> | T,
  condition: (result: T) => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry } = options;
  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    try {
      const result = await fn();
      if (condition(result)) {
        return result;
      }
      throw new Error("Condition not met");
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      await new Promise((res) => setTimeout(res, currentDelay));
      currentDelay *= factor;
      attempt++;
    }
  }
  throw new Error("Retry until condition failed unexpectedly.");
}

/**
 * Retries the provided function until a predicate function returns true, which stops the retry process.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param shouldStop - A function that returns true when retry should stop.
 * @param options - Retry configuration options.
 *   - retries: Maximum number of retry attempts (default: 3).
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail, shouldRetry returns false, or shouldStop returns true.
 */
export async function retryWithPredicate<T>(
  fn: () => Promise<T> | T,
  shouldStop: () => boolean,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry, shouldRetry = () => true } = options;
  let attempt = 0;
  let currentDelay = delay;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    if (shouldStop()) {
      throw new Error("Retry stopped by predicate");
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (attempt === retries || !shouldRetry(err)) {
        throw err;
      }

      if (shouldStop()) {
        throw new Error("Retry stopped by predicate");
      }

      onRetry?.(err, attempt + 1);
      await new Promise<void>((res) => {
        const timeoutId = setTimeout(res, currentDelay);
        // Check periodically if shouldStop returns true
        const intervalId = setInterval(() => {
          if (shouldStop()) {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            res();
          }
        }, 100);

        // Ensure interval is cleared after timeout completes
        setTimeout(() => clearInterval(intervalId), currentDelay);
      });

      if (shouldStop()) {
        throw new Error("Retry stopped by predicate");
      }

      currentDelay *= factor;
      attempt++;
    }
  }

  throw lastError || new Error("Retry with predicate failed unexpectedly.");
}

/**
 * Retries the provided function and allows cancellation via a token object.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param options - Retry configuration options.
 *   - retries: Maximum number of retry attempts (default: 3).
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - onRetry: Optional callback invoked after each failed attempt.
 *   - shouldRetry: Optional predicate to determine if a retry should occur based on the error.
 *   - cancellationToken: An object with a 'cancelled' property that stops retry when set to true.
 * @returns The result of the function if successful.
 * @throws The last error encountered if all retries fail, shouldRetry returns false, or cancellation is requested.
 */
export async function retryWithCancellationToken<T>(
  fn: () => Promise<T> | T,
  options: RetryOptions & { cancellationToken: { cancelled: boolean } },
): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry, shouldRetry = () => true, cancellationToken } = options;
  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    if (cancellationToken.cancelled) throw new Error("Retry cancelled");
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err) || cancellationToken.cancelled) {
        throw err;
      }
      onRetry?.(err, attempt + 1);
      await new Promise<void>((res) => {
        const timeoutId = setTimeout(res, currentDelay);
        // Check periodically if the token is cancelled
        const intervalId = setInterval(() => {
          if (cancellationToken.cancelled) {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
            res();
          }
        }, 100);

        // Ensure interval is cleared after timeout completes
        setTimeout(() => clearInterval(intervalId), currentDelay);
      });

      currentDelay *= factor;
      attempt++;
    }
  }

  throw new Error("Retry with cancellation token failed unexpectedly.");
}

/**
 * Interface for the result of custom execution
 */
export interface ExecutionResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
}

/**
 * Interface for custom execution options
 */
export interface CustomExecutionOptions<T> extends RetryOptions {
  /**
   * Custom execution function that evaluates whether the operation succeeded
   * @param fn The function to execute
   * @returns ExecutionResult with success flag, value (if successful) or error (if failed)
   */
  execute: (fn: () => any) => Promise<ExecutionResult<T>>;
}

/**
 * Retries the provided function using custom execution logic instead of try/catch.
 * This allows for retrying based on return values rather than exceptions.
 *
 * @param fn - The function to execute. Can be synchronous or asynchronous.
 * @param options - Custom execution options plus standard retry options.
 *   - execute: Custom execution function that returns an ExecutionResult.
 *   - retries: Maximum number of retry attempts (default: 3).
 *   - delay: Initial delay in milliseconds before the first retry (default: 500).
 *   - factor: Multiplier for delay after each failed attempt (default: 2).
 *   - onRetry: Optional callback invoked after each failed attempt.
 * @returns The result value if successful.
 * @throws The last error encountered if all retries fail.
 */
export async function retryWithCustomExecution<T>(fn: () => any, options: CustomExecutionOptions<T>): Promise<T> {
  const { retries = 3, delay = 500, factor = 2, onRetry, execute } = options;
  let attempt = 0;
  let currentDelay = delay;
  let lastError: unknown = null;

  while (attempt <= retries) {
    const result = await execute(fn);

    if (result.success) {
      return result.value as T;
    }

    lastError = result.error || new Error("Operation failed");

    if (attempt === retries) {
      if (result.error) throw result.error;
      throw new Error("All retry attempts failed");
    }

    onRetry?.(result.error || new Error("Operation failed"), attempt + 1);
    await new Promise((res) => setTimeout(res, currentDelay));
    currentDelay *= factor;
    attempt++;
  }

  throw lastError || new Error("Retry with custom execution failed unexpectedly.");
}
