import { test, expect } from "vitest";
import { retryWithTimeout } from "../src";

test("retryWithTimeout retries until timeout", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithTimeout(
      () => {
        counter++;
        throw new Error("Timeout fail");
      },
      { delay: 10, timeout: 30 },
    ),
  ).rejects.toThrow("Timeout fail");

  // Assert
  expect(counter).toBeGreaterThanOrEqual(2);
});

test("retryWithTimeout succeeds before timeout", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithTimeout(
    () => {
      counter++;
      if (counter < 2) throw new Error("Timeout fail");
      return "timeout-ok";
    },
    { delay: 5, timeout: 50 },
  );

  // Assert
  expect(result).toBe("timeout-ok");
  expect(counter).toBe(2);
});

test("retryWithTimeout does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithTimeout(
      () => {
        counter++;
        throw new Error("No retry");
      },
      { shouldRetry: () => false, timeout: 50 },
    ),
  ).rejects.toThrow("No retry");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithTimeout calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithTimeout(
    () => {
      counter++;
      if (counter < 3) throw new Error("Timeout fail");
      return "ok";
    },
    { onRetry, delay: 5, timeout: 100 },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Timeout fail");
});

test("retryWithTimeout works with synchronous function", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithTimeout(
    () => {
      counter++;
      if (counter < 2) throw new Error("sync fail");
      return "sync-ok";
    },
    { delay: 5, timeout: 50 },
  );

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
