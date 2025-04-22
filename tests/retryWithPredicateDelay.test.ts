import { test, expect } from "vitest";
import { retryWithPredicateDelay } from "../src";

test("retryWithPredicateDelay uses custom delay logic", async () => {
  // Arrange
  let counter = 0;
  const delays: number[] = [];
  const getDelay = (_err: unknown, attempt: number) => {
    delays.push(attempt * 10);
    return attempt * 10;
  };

  // Act
  const result = await retryWithPredicateDelay(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    getDelay,
    { retries: 3 },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(3);
  expect(delays).toEqual([10, 20]);
});

test("retryWithPredicateDelay throws after all retries", async () => {
  // Arrange
  let counter = 0;
  const getDelay = () => 1;

  // Act
  await expect(
    retryWithPredicateDelay(
      () => {
        counter++;
        throw new Error("fail");
      },
      getDelay,
      { retries: 2 },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(3);
});

test("retryWithPredicateDelay does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;
  const getDelay = () => 1;

  // Act
  await expect(
    retryWithPredicateDelay(
      () => {
        counter++;
        throw new Error("fail");
      },
      getDelay,
      { retries: 5, shouldRetry: () => false },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithPredicateDelay calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const delays: number[] = [];
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const getDelay = (_err: unknown, attempt: number) => {
    delays.push(attempt * 10);
    return attempt * 10;
  };
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithPredicateDelay(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    getDelay,
    { retries: 3, onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("fail");
});
