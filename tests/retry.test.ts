import { test, expect } from "vitest";
import { retry } from "../src";

async function asyncOperation() {
  return new Promise((resolve) => setTimeout(() => resolve("ok"), 250));
}

async function asyncIncrementOperation(index: number): Promise<number> {
  return new Promise((resolve) => setTimeout(() => resolve(index + 1), 250));
}

test("retries until success", async () => {
  let counter = 0;

  const result = await retry(() => {
    counter++;
    if (counter < 3) throw new Error("Fail");
    return "ok";
  });

  expect(result).toBe("ok");
  expect(counter).toBe(3);
});

test("retries with custom delay", async () => {
  let counter = 0;
  const delays: number[] = [];

  const result = await retry(
    () => {
      counter++;
      if (counter < 3) throw new Error("Fail");
      return "ok";
    },
    { delay: 100, factor: 1 },
  );

  expect(result).toBe("ok");
  expect(counter).toBe(3);
});

test("retries async operation", async () => {
  let counter = 0;

  const result = await retry(async () => {
    counter = await asyncIncrementOperation(counter);
    if (counter < 3) throw new Error("Fail");
    return counter;
  });

  expect(result).toBe(3);
});
