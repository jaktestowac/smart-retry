import { test, expect } from "vitest";
import { retryWithMaxTotalAttempts } from "../src";

test("retryWithMaxTotalAttempts stops after max attempts", async () => {
  // Arrange
  let counter = 0;

  // Act & Assert
  await expect(
    retryWithMaxTotalAttempts(
      () => {
        counter++;
        throw new Error("fail");
      },
      3,
      { delay: 5 },
    ),
  ).rejects.toThrow("fail");
  expect(counter).toBe(3);
});

test("retryWithMaxTotalAttempts succeeds before max attempts", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithMaxTotalAttempts(
    () => {
      counter++;
      if (counter < 2) throw new Error("fail");
      return "ok";
    },
    3,
    { delay: 5 },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(2);
});

test("retryWithMaxTotalAttempts does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithMaxTotalAttempts(
      () => {
        counter++;
        throw new Error("fail");
      },
      5,
      { delay: 5, shouldRetry: () => false },
    ),
  ).rejects.toThrow("fail");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithMaxTotalAttempts calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithMaxTotalAttempts(
    () => {
      counter++;
      if (counter < 3) throw new Error("fail");
      return "ok";
    },
    4,
    { delay: 5, onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("fail");
});
