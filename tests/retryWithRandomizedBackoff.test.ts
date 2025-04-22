import { test, expect } from "vitest";
import { retryWithRandomizedBackoff } from "../src";

test("retryWithRandomizedBackoff retries and succeeds", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithRandomizedBackoff(
    () => {
      counter++;
      if (counter < 2) throw new Error("fail");
      return "ok";
    },
    { delay: 5, retries: 2 },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(2);
});

test("retryWithRandomizedBackoff throws after max retries", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithRandomizedBackoff(
      () => {
        counter++;
        throw new Error("fail");
      },
      { delay: 5, retries: 2 },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(3);
});

test("retryWithRandomizedBackoff does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithRandomizedBackoff(
      () => {
        counter++;
        throw new Error("no retry");
      },
      { retries: 5, shouldRetry: () => false },
    ),
  ).rejects.toThrow("no retry");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithRandomizedBackoff calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithRandomizedBackoff(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    { onRetry, delay: 5, retries: 3 },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("fail");
});

test("retryWithRandomizedBackoff works with synchronous function", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithRandomizedBackoff(
    () => {
      counter++;
      if (counter < 2) throw new Error("sync fail");
      return "sync-ok";
    },
    { delay: 5, retries: 2 },
  );

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});

test("retryWithRandomizedBackoff respects maxDelay", async () => {
  // Arrange
  let counter = 0;
  let lastDelay = 0;
  const origSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => {
    lastDelay = ms as number;
    return origSetTimeout(fn, ms, ...args);
  };

  // Act
  try {
    await expect(
      retryWithRandomizedBackoff(
        () => {
          counter++;
          throw new Error("fail");
        },
        { delay: 5, retries: 1, maxDelay: 10 },
      ),
    ).rejects.toThrow("fail");
    // Assert
    expect(lastDelay).toBeLessThanOrEqual(10);
  } finally {
    globalThis.setTimeout = origSetTimeout;
  }
});
