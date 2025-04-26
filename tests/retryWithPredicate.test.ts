import { test, expect } from "vitest";
import { retryWithPredicate } from "../src";

test("retryWithPredicate stops when predicate function returns true", async () => {
  // Arrange
  let counter = 0;
  let shouldStopCalled = false;
  const shouldStop = () => {
    shouldStopCalled = true;
    return counter >= 2;
  };

  // Act
  await expect(
    retryWithPredicate(
      () => {
        counter++;
        throw new Error("Always fails");
      },
      shouldStop,
      { delay: 10, retries: 5 },
    ),
  ).rejects.toThrow("Retry stopped by predicate");

  // Assert
  expect(counter).toBe(2);
  expect(shouldStopCalled).toBe(true);
});

test("retryWithPredicate succeeds before predicate returns true", async () => {
  // Arrange
  let counter = 0;
  const shouldStop = () => false;

  // Act
  const result = await retryWithPredicate(
    () => {
      counter++;
      if (counter < 2) throw new Error("Fail");
      return "success";
    },
    shouldStop,
    { delay: 5 },
  );

  // Assert
  expect(result).toBe("success");
  expect(counter).toBe(2);
});

test("retryWithPredicate doesn't retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;
  const shouldStop = () => false;

  // Act
  await expect(
    retryWithPredicate(
      () => {
        counter++;
        throw new Error("No retry");
      },
      shouldStop,
      { shouldRetry: () => false },
    ),
  ).rejects.toThrow("No retry");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithPredicate calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const shouldStop = () => false;
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithPredicate(
    () => {
      counter++;
      if (counter < 3) throw new Error("Predicate fail");
      return "ok";
    },
    shouldStop,
    { onRetry, delay: 5 },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Predicate fail");
});

test("retryWithPredicate checks predicate during delay", async () => {
  // Arrange
  let counter = 0;
  let predicateCalls = 0;
  let stopAfterFirstAttempt = false;

  const shouldStop = () => {
    predicateCalls++;
    return stopAfterFirstAttempt;
  };

  // Act & Assert
  const promise = retryWithPredicate(
    () => {
      counter++;
      if (counter <= 3) throw new Error("Still failing");
      return "ok";
    },
    shouldStop,
    { delay: 50 },
  );

  // Wait a moment for the first attempt to fail, then set the flag to stop
  await new Promise((resolve) => setTimeout(resolve, 20));
  stopAfterFirstAttempt = true;

  await expect(promise).rejects.toThrow("Retry stopped by predicate");

  expect(counter).toBe(1);
  expect(predicateCalls).toBeGreaterThan(1);
});

test("retryWithPredicate works with synchronous function", async () => {
  // Arrange
  let counter = 0;
  const shouldStop = () => false;

  // Act
  const result = await retryWithPredicate(
    () => {
      counter++;
      if (counter < 2) throw new Error("sync fail");
      return "sync-ok";
    },
    shouldStop,
    { delay: 5 },
  );

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
