import { test, expect } from "vitest";
import { retryUntilCondition } from "../src";

test("retryUntilCondition retries until condition is met", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryUntilCondition(
    () => {
      counter++;
      return counter;
    },
    (val) => val === 3,
    { delay: 5, retries: 5 },
  );

  // Assert
  expect(result).toBe(3);
  expect(counter).toBe(3);
});

test("retryUntilCondition throws if condition never met", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryUntilCondition(
      () => {
        counter++;
        return counter;
      },
      (val) => val > 10,
      { delay: 5, retries: 2 },
    ),
  ).rejects.toThrow();

  // Assert
  expect(counter).toBe(3);
});

test("retryUntilCondition calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryUntilCondition(
    () => {
      counter++;
      return counter;
    },
    (val) => val === 3,
    { delay: 5, retries: 5, onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Condition not met");
});

test("retryUntilCondition retries on falsy value", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryUntilCondition(
    () => {
      counter++;
      return counter === 2 ? "final" : null;
    },
    (val) => val === "final",
    { delay: 5, retries: 3 },
  );

  // Assert
  expect(result).toBe("final");
  expect(counter).toBe(2);
});
