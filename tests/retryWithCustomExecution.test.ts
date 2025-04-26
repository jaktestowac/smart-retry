import { test, expect } from "vitest";
import { retryWithCustomExecution, ExecutionResult } from "../src";

test("retryWithCustomExecution retries based on return value", async () => {
  // Arrange
  let counter = 0;

  // Custom execution function that considers null/undefined as failure
  async function customExecute(fn: () => any): Promise<ExecutionResult<string>> {
    try {
      const result = await fn();
      if (result === null || result === undefined) {
        return { success: false, error: new Error("Result was null or undefined") };
      }
      return { success: true, value: result };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Act
  const result = await retryWithCustomExecution(
    () => {
      counter++;
      return counter >= 2 ? "success" : null;
    },
    { execute: customExecute },
  );

  // Assert
  expect(result).toBe("success");
  expect(counter).toBe(2);
});

test("retryWithCustomExecution throws after max retries", async () => {
  // Arrange
  let counter = 0;

  async function customExecute(fn: () => any): Promise<ExecutionResult<string>> {
    try {
      const result = await fn();
      return {
        success: result === "valid",
        value: result,
        error: result !== "valid" ? new Error("Invalid result") : undefined,
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Act & Assert
  await expect(
    retryWithCustomExecution(
      () => {
        counter++;
        return "invalid";
      },
      { execute: customExecute, retries: 2 },
    ),
  ).rejects.toThrow("Invalid result");

  expect(counter).toBe(3); // Initial attempt + 2 retries
});

test("retryWithCustomExecution handles errors from the original function", async () => {
  // Arrange
  let counter = 0;

  async function customExecute(fn: () => any): Promise<ExecutionResult<string>> {
    try {
      const result = await fn();
      return { success: true, value: result };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Act & Assert
  await expect(
    retryWithCustomExecution(
      () => {
        counter++;
        throw new Error("Function error");
      },
      { execute: customExecute, retries: 2 },
    ),
  ).rejects.toThrow("Function error");

  expect(counter).toBe(3); // Initial attempt + 2 retries
});

test("retryWithCustomExecution calls onRetry with correct arguments", async () => {
  // Arrange
  let counter = 0;
  const calls: Array<{ err: unknown; attempt: number }> = [];

  const onRetry = (err: unknown, attempt: number) => {
    calls.push({ err, attempt });
  };

  async function customExecute(fn: () => any): Promise<ExecutionResult<string>> {
    const result = await fn();
    return {
      success: result === "valid",
      value: result,
      error: result !== "valid" ? new Error("Invalid result") : undefined,
    };
  }

  // Act
  await retryWithCustomExecution(
    () => {
      counter++;
      return counter >= 3 ? "valid" : "invalid";
    },
    { execute: customExecute, retries: 3, onRetry, delay: 5 },
  );

  // Assert
  expect(calls.length).toBe(2);
  expect(calls[0].attempt).toBe(1);
  expect((calls[0].err as Error).message).toBe("Invalid result");
});

test("retryWithCustomExecution works with async function", async () => {
  // Arrange
  let counter = 0;

  async function customExecute(fn: () => any): Promise<ExecutionResult<number>> {
    try {
      const result = await fn();
      return {
        success: result > 10,
        value: result,
        error: result <= 10 ? new Error("Value too small") : undefined,
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Act
  const result = await retryWithCustomExecution(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      counter += 5;
      return counter;
    },
    { execute: customExecute, retries: 3, delay: 5 },
  );

  // Assert
  expect(result).toBe(15);
  expect(counter).toBe(15);
});

test("retryWithCustomExecution preserves custom error messages", async () => {
  // Arrange
  let counter = 0;

  async function customExecute(fn: () => any): Promise<ExecutionResult<string>> {
    try {
      const result = await fn();
      return {
        success: false,
        error: new Error(`Custom error for ${result}`),
      };
    } catch (error) {
      return { success: false, error };
    }
  }

  // Act & Assert
  const error = await retryWithCustomExecution(
    () => {
      counter++;
      return `attempt ${counter}`;
    },
    { execute: customExecute, retries: 1, delay: 5 },
  ).catch((e) => e);

  expect(error.message).toBe("Custom error for attempt 2");
  expect(counter).toBe(2);
});

test("retryWithCustomExecution works without try-catch in customExecute", async () => {
  // Arrange
  let counter = 0;

  // Custom execute without try-catch, directly determining success/failure
  async function customExecute(fn: () => any): Promise<ExecutionResult<number>> {
    const result = await fn();
    // Determine success based on result value directly
    return {
      success: result > 5,
      value: result,
      error: result <= 5 ? new Error("Value too low") : undefined,
    };
  }

  // Act
  const result = await retryWithCustomExecution(
    () => {
      counter += 2;
      return counter;
    },
    { execute: customExecute, retries: 3, delay: 5 },
  );

  // Assert
  expect(result).toBe(6);
  expect(counter).toBe(6); // Should succeed on the 3rd attempt (2+2+2=6)
});

test("retryWithCustomExecution with direct API status evaluation", async () => {
  // Arrange
  let counter = 0;
  let lastError: Error | undefined;

  // Mock Response object
  type MockResponse = {
    status: number;
    data: string;
  };

  // Direct status evaluation without exception handling
  async function customAPIExecute(fn: () => Promise<MockResponse>): Promise<ExecutionResult<MockResponse>> {
    const response = await fn();

    // Directly evaluate success based on status code
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        value: response,
      };
    }

    // Store error for testing
    lastError = new Error(`API returned status: ${response.status}`);

    // Return failure with the response and an error
    return {
      success: false,
      error: lastError,
      value: response, // Include the response for inspection
    };
  }

  // Act
  const result = await retryWithCustomExecution<MockResponse>(
    async () => {
      counter++;
      // Return success response on third attempt
      const status = counter >= 3 ? 200 : 429; // 429 = Too Many Requests
      return { status, data: counter >= 3 ? "Success data" : "Error data" };
    },
    {
      execute: customAPIExecute,
      retries: 3,
      delay: 5,
      onRetry: (err, attempt) => {
        // Check that we received the correct error
        expect(err).toBe(lastError);
        expect((err as Error).message).toContain("429");
      },
    },
  );

  // Assert
  expect(counter).toBe(3);
  expect(result.status).toBe(200);
  expect(result.data).toBe("Success data");
});

test("retryWithCustomExecution with boolean flag evaluation", async () => {
  // Arrange
  let counter = 0;

  // Custom execute that uses a boolean flag rather than exceptions
  async function customFlagExecute(fn: () => Promise<{ success: boolean; data: any }>): Promise<ExecutionResult<any>> {
    const result = await fn();

    // Simply pass through the success flag
    return {
      success: result.success,
      value: result.data,
      error: !result.success ? new Error("Operation reported failure") : undefined,
    };
  }

  // Act
  const result = await retryWithCustomExecution(
    async () => {
      counter++;
      // Only succeed on fourth attempt
      return {
        success: counter >= 4,
        data: counter >= 4 ? { id: 123, name: "test" } : null,
      };
    },
    { execute: customFlagExecute, retries: 4, delay: 5 },
  );

  // Assert
  expect(counter).toBe(4);
  expect(result).toEqual({ id: 123, name: "test" });
});
