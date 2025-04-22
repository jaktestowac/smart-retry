import { test, expect } from "vitest";
import { retryWithSchedule } from "../src";

test("retryWithSchedule uses custom delays and succeeds", async () => {
  // Arrange
  let counter = 0;
  const schedule = [5, 10, 15];

  // Act
  const result = await retryWithSchedule(() => {
    counter++;
    if (counter < 3) throw new Error("Schedule fail");
    return "schedule-ok";
  }, schedule);

  // Assert
  expect(result).toBe("schedule-ok");
  expect(counter).toBe(3);
});

test("retryWithSchedule throws after exhausting schedule", async () => {
  // Arrange
  let counter = 0;
  const schedule = [5, 5];

  // Act
  await expect(
    retryWithSchedule(() => {
      counter++;
      throw new Error("Always fails");
    }, schedule),
  ).rejects.toThrow("Always fails");

  // Assert
  expect(counter).toBe(3);
});

test("retryWithSchedule does not retry if shouldRetry returns false", async () => {
  // Arrange
  let counter = 0;

  // Act
  await expect(
    retryWithSchedule(
      () => {
        counter++;
        throw new Error("No retry");
      },
      [5, 5, 5],
      { shouldRetry: () => false },
    ),
  ).rejects.toThrow("No retry");

  // Assert
  expect(counter).toBe(1);
});

test("retryWithSchedule calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];
  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  // Act
  await retryWithSchedule(
    () => {
      counter++;
      if (counter < 3) throw new Error("Schedule fail");
      return "ok";
    },
    [5, 5, 5],
    { onRetry },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Schedule fail");
});

test("retryWithSchedule works with synchronous function", async () => {
  // Arrange
  let counter = 0;

  // Act
  const result = await retryWithSchedule(() => {
    counter++;
    if (counter < 2) throw new Error("sync fail");
    return "sync-ok";
  }, [5, 5]);

  // Assert
  expect(result).toBe("sync-ok");
  expect(counter).toBe(2);
});
