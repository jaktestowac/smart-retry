import { test, expect } from "vitest";
import { retry, retryWithJitter, retryWithTimeout, retryWithSchedule } from "../src";

async function asyncOperation() {
  return new Promise((resolve) => setTimeout(() => resolve("ok"), 250));
}

async function asyncIncrementOperation(index: number): Promise<number> {
  return new Promise((resolve) => setTimeout(() => resolve(index + 1), 250));
}

test("retries until success", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retry(() => {
    counter++;
    if (counter < 3) throw new Error("Fail");
    return "ok";
  });

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(3);
});

test("retries with custom delay", async () => {
  // Arrange
  let counter = 0;
  const delays: number[] = [];

  // Act
  const result = await retry(
    () => {
      counter++;
      if (counter < 3) throw new Error("Fail");
      return "ok";
    },
    { delay: 100, factor: 1 },
  );

  // Assert
  expect(result).toBe("ok");
  expect(counter).toBe(3);
});

test("retries async operation", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retry(async () => {
    counter = await asyncIncrementOperation(counter);
    if (counter < 3) throw new Error("Fail");
    return counter;
  });

  // Assert
  expect(result).toBe(3);
});

test("does not retry if retries is 0", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retry(
      () => {
        counter++;
        throw new Error("Fail");
      },
      { retries: 0 },
    ),
  ).rejects.toThrow("Fail");

  // Assert
  expect(counter).toBe(1);
});

test("shouldRetry returns false prevents further retries", async () => {
  // Arrange
  let counter = 0;
  const shouldRetry = (err: unknown) => false;

  // Act
  await expect(
    retry(
      () => {
        counter++;
        throw new Error("Fail");
      },
      { retries: 5, shouldRetry },
    ),
  ).rejects.toThrow("Fail");

  // Assert
  expect(counter).toBe(1);
});

test("onRetry is called with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retry(
    () => {
      counter++;
      if (counter < 3) throw new Error("Fail");
      return "ok";
    },
    { onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect(calls[1].attempt).toBe(2);
  expect((calls[0].err as Error).message).toBe("Fail");
});

test("throws after max retries", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retry(
      () => {
        counter++;
        throw new Error("Always fails");
      },
      { retries: 2 },
    ),
  ).rejects.toThrow("Always fails");

  // Assert
  expect(counter).toBe(3); // initial try + 2 retries
});

test("retries with synchronous function", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retry(() => {
    counter++;
    if (counter < 2) throw new Error("Fail");
    return "sync-ok";
  });

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
