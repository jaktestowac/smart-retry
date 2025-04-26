import { test, expect } from "vitest";
import { retryWithCancellationToken } from "../src";

test("retryWithCancellationToken cancels retries when token is cancelled", async () => {
  // Arrange
  let counter = 0;
  const cancellationToken = { cancelled: false };
  setTimeout(() => (cancellationToken.cancelled = true), 200);

  // Act
  await expect(
    retryWithCancellationToken(
      () => {
        counter++;
        throw new Error("fail");
      },
      { retries: 5, delay: 20, cancellationToken },
    ),
  ).rejects.toThrow(/Retry cancelled|fail/);

  // Assert
  expect(counter).toBeGreaterThanOrEqual(1);
});

test("retryWithCancellationToken succeeds if not cancelled", async () => {
  // Arrange
  let counter = 0;
  const cancellationToken = { cancelled: false };

  // Act
  const result = await retryWithCancellationToken(
    () => {
      counter++;
      if (counter < 2) throw new Error("fail");
      return "ok";
    },
    { retries: 3, delay: 5, cancellationToken },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(2);
});

test("retryWithCancellationToken checks token during delay", async () => {
  // Arrange
  let counter = 0;
  const cancellationToken = { cancelled: false };

  // Act & Assert
  const promise = retryWithCancellationToken(
    () => {
      counter++;
      if (counter <= 3) throw new Error("Still failing");
      return "ok";
    },
    { delay: 50, retries: 5, cancellationToken },
  );

  // Wait a moment for the first attempt to fail, then cancel
  await new Promise((resolve) => setTimeout(resolve, 20));
  cancellationToken.cancelled = true;

  await expect(promise).rejects.toThrow("Retry cancelled");
  expect(counter).toBe(1);
});

test("retryWithCancellationToken does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;
  const cancellationToken = { cancelled: false };

  // Act
  await expect(
    retryWithCancellationToken(
      () => {
        counter++;
        throw new Error("fail");
      },
      { retries: 5, delay: 5, cancellationToken, shouldRetry: () => false },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithCancellationToken calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const cancellationToken = { cancelled: false };
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithCancellationToken(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    { retries: 3, delay: 5, cancellationToken, onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("fail");
});

test("retryWithCancellationToken works with synchronous function", async () => {
  // Arrange
  let counter = 0;
  const cancellationToken = { cancelled: false };

  // Act
  const result = await retryWithCancellationToken(
    () => {
      counter++;
      if (counter < 2) throw new Error("sync fail");
      return "sync-ok";
    },
    { delay: 5, cancellationToken },
  );

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
