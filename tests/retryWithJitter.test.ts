import { test, expect } from "vitest";
import { retryWithJitter } from "../src";

test("retryWithJitter retries and succeeds", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithJitter(
    () => {
      counter++;
      if (counter < 2) throw new Error("Jitter fail");
      return "jitter-ok";
    },
    { delay: 10, jitter: 5 },
  );

  // Assert
  expect(result).toBe("jitter-ok");
  expect(counter).toBe(2);
});

test("retryWithJitter throws after max retries", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithJitter(
      () => {
        counter++;
        throw new Error("Always fails");
      },
      { retries: 1, delay: 10, jitter: 5 },
    ),
  ).rejects.toThrow("Always fails");

  // Assert
  expect(counter).toBe(2);
});

test("retryWithJitter does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithJitter(
      () => {
        counter++;
        throw new Error("No retry");
      },
      { retries: 5, shouldRetry: () => false },
    ),
  ).rejects.toThrow("No retry");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithJitter calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithJitter(
    () => {
      counter++;
      if (counter < 3) throw new Error("Jitter fail");
      return "ok";
    },
    { onRetry, delay: 5, jitter: 2 },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Jitter fail");
});

test("retryWithJitter works with synchronous function", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithJitter(
    () => {
      counter++;
      if (counter < 2) throw new Error("sync fail");
      return "sync-ok";
    },
    { delay: 5, jitter: 2 },
  );

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
