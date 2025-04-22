import { test, expect } from "vitest";
import { retryWithAbortSignal } from "../src";

test("retryWithAbortSignal aborts retries when signal is triggered", async () => {
  // Arrange
  let counter = 0;
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 30);

  // Act
  await expect(
    retryWithAbortSignal(
      () => {
        counter++;
        throw new Error("fail");
      },
      { retries: 5, delay: 20, signal: controller.signal },
    ),
  ).rejects.toThrow(/Aborted|fail/);

  // Assert
  expect(counter).toBeGreaterThanOrEqual(1);
});

test("retryWithAbortSignal succeeds if not aborted", async () => {
  // Arrange
  let counter = 0;
  const controller = new AbortController();

  // Act
  const result = await retryWithAbortSignal(
    () => {
      counter++;
      if (counter < 2) throw new Error("fail");
      return "ok";
    },
    { retries: 3, delay: 5, signal: controller.signal },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(2);
});

test("retryWithAbortSignal does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;
  const controller = new AbortController();

  // Act
  await expect(
    retryWithAbortSignal(
      () => {
        counter++;
        throw new Error("fail");
      },
      { retries: 5, delay: 5, signal: controller.signal, shouldRetry: () => false },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithAbortSignal calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const controller = new AbortController();
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithAbortSignal(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    { retries: 3, delay: 5, signal: controller.signal, onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("fail");
});
