# Smart-Retry

> Smart utility to retry flaky sync/async operations with delay, backoff, jitter, abort, and retry hooks.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Features

- ✅ Works with sync and async functions
- 🔁 Configurable number of retries and delay
- ⏱️ Exponential backoff and custom schedules
- 🎲 Jitter and randomized backoff strategies
- 🛑 Multiple cancellation options (AbortSignal, predicate, token)
- 🔍 `onRetry` hook for logging or metrics
- ⚠️ Optional error filtering with `shouldRetry`
- 🧩 Retry until condition or with custom delay logic
- 🪶 Zero dependencies

---

## 📦 Install

```bash
npm install smart-retry
```

## ⚡ Quick Usage

```typescript
import { retry } from "smart-retry";

async function fetchData() {
  const res = await fetch("https://example.com/api");
  if (!res.ok) throw new Error("API error"); // by default, all errors are retryable
  return res.json();
}

const result = await retry(() => fetchData(), {
  retries: 3,
  delay: 1000,
  factor: 2,
  onRetry: (err, attempt) => {
    console.warn(`Attempt #${attempt} failed: ${err}`);
  },
});
```

## 🔄 How Retry Works

The retry mechanism in this library follows a simple but powerful pattern:

1. **Execution**: The library attempts to run your function (sync or async).
2. **Error Handling**:
   - If the function succeeds (returns a value without throwing), the result is returned immediately.
   - If the function throws an error:
     - The library checks if another retry should be attempted based on the `retries` count and `shouldRetry` predicate.
     - If no more retries are allowed or `shouldRetry` returns false, the error is thrown.
3. **Notification**: If a retry is needed, the `onRetry` callback is invoked with the error and attempt number.
4. **Delay**: The library waits for a specified delay duration before the next attempt.
   - For regular retry: The delay increases exponentially by the specified `factor`.
   - For jitter: Random variation is added to prevent "thundering herd" problems.
   - For scheduled retries: The delay follows a pre-defined array of values.
5. **Cancellation**: Some retry functions support cancellation via:
   - AbortSignal: Standard web API for cancellation
   - Predicate function: Custom function that returns true when retries should stop
   - Cancellation token: Object with a boolean property to cancel retries

All retry functions can handle both synchronous and asynchronous target functions, automatically wrapping results in promises for a consistent async interface.

---

## ⚙️ API Overview

### Common Options

| Option        | Type                     | Default  | Description                               |
| ------------- | ------------------------ | -------- | ----------------------------------------- |
| `retries`     | `number`                 | `3`      | Number of retry attempts                  |
| `delay`       | `number` (ms)            | `500`    | Initial delay between retries             |
| `factor`      | `number`                 | `2`      | Multiplier for exponential backoff        |
| `onRetry`     | `(err, attempt) => void` | `-`      | Hook called on every failed retry         |
| `shouldRetry` | `(err) => boolean`       | `always` | Predicate to decide if error is retryable |

### Provided Functions

- **`retry`**: Standard exponential backoff retry.
- **`retryWithJitter`**: Adds random jitter to delay.
- **`retryWithTimeout`**: Retries until a total timeout is reached.
- **`retryWithSchedule`**: Retries using a custom array of delays.
- **`retryWithAbortSignal`**: Supports aborting with an `AbortSignal`.
- **`retryWithPredicate`**: Stops retrying when a predicate function returns true.
- **`retryWithCancellationToken`**: Stops retrying when a token object's `cancelled` property is true.
- **`retryWithMaxTotalAttempts`**: Specify max total attempts (not just retries).
- **`retryWithPredicateDelay`**: Custom delay logic per attempt.
- **`retryWithRandomizedBackoff`**: Decorrelated jitter/randomized backoff.
- **`retryUntilCondition`**: Retries until a user-provided predicate returns true.

---

## 🧑‍💻 Examples

### Retry a Synchronous Function

```typescript
import { retry } from "smart-retry";

let count = 0;
const result = await retry(() => {
  count++;
  if (count < 3) throw new Error("Oops");
  return "done";
});

console.log(result); // Output: 'done' after 3 attempts
```

### Retry Until Condition

```typescript
import { retryUntilCondition } from "smart-retry";

// Example 1: Wait for a value to reach a threshold
let value = 0;
await retryUntilCondition(
  () => ++value,
  (result) => result === 5,
  { retries: 10, delay: 100 },
);

// Example 2: Poll an API until a resource is ready
async function checkStatus() {
  const res = await fetch("https://api.example.com/status");
  const data = await res.json();
  return data.status;
}

await retryUntilCondition(
  () => checkStatus(),
  (status) => status === "ready",
  { retries: 20, delay: 500, onRetry: (err, attempt) => console.log(`Attempt ${attempt}: not ready yet`) },
);
```

### Retry an Async Function with Exponential Backoff and Error Filtering

```typescript
import { retry } from "smart-retry";

await retry(() => fetchSomething(), {
  retries: 5,
  delay: 500,
  factor: 1.5,
  shouldRetry: (err) => err instanceof TimeoutError,
});
```

### Retry with Jitter

```typescript
import { retryWithJitter } from "smart-retry";

await retryWithJitter(() => fetchSomething(), {
  retries: 4,
  delay: 200,
  jitter: 100,
  onRetry: (err, attempt) => {
    console.log(`Retry #${attempt} failed: ${err}`);
  },
});
```

### Retry with AbortSignal

```typescript
import { retryWithAbortSignal } from "smart-retry";

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  await retryWithAbortSignal(() => fetchSomething(), {
    retries: 10,
    delay: 200,
    signal: controller.signal,
  });
} catch (err) {
  if (controller.signal.aborted) {
    console.log("Retry aborted by user.");
  } else {
    console.error("Retry failed:", err);
  }
}
```

### Retry with Predicate

```typescript
import { retryWithPredicate } from "smart-retry";

// Flag to stop retrying when set to true
let stopRetrying = false;

// Set up a separate timeout that will stop retries after 1 second
setTimeout(() => {
  stopRetrying = true;
}, 1000);

try {
  await retryWithPredicate(
    () => fetchFromSlowAPI(),
    () => stopRetrying, // Stop when our flag becomes true
    { retries: 10, delay: 200 },
  );
} catch (err) {
  if (stopRetrying) {
    console.log("Retry stopped by predicate");
  } else {
    console.error("Retry failed:", err);
  }
}
```

### Retry with Cancellation Token

```typescript
import { retryWithCancellationToken } from "smart-retry";

// Create a token object with a 'cancelled' property
const token = { cancelled: false };

// Set up a separate process that can cancel the operation
setTimeout(() => {
  token.cancelled = true;
}, 1000);

try {
  await retryWithCancellationToken(() => fetchSomething(), {
    retries: 5,
    delay: 200,
    cancellationToken: token,
  });
} catch (err) {
  if (token.cancelled) {
    console.log("Retry cancelled via token");
  } else {
    console.error("Retry failed:", err);
  }
}
```

### Retry with Custom Schedule

```typescript
import { retryWithSchedule } from "smart-retry";

// Will retry after 100ms, then 200ms, then 400ms, then 800ms
await retryWithSchedule(() => fetchSomething(), [100, 200, 400, 800]);
```

### Retry with Predicate Delay

```typescript
import { retryWithPredicateDelay } from "smart-retry";

await retryWithPredicateDelay(
  () => fetchSomething(),
  (err, attempt) => attempt * 100, // delay increases per attempt
  { retries: 5 },
);
```

### Retry with Randomized Backoff

```typescript
import { retryWithRandomizedBackoff } from "smart-retry";

await retryWithRandomizedBackoff(() => fetchSomething(), {
  retries: 5,
  delay: 100,
  maxDelay: 2000,
  onRetry: (err, attempt) => {
    console.log(`Randomized backoff retry #${attempt}: ${err}`);
  },
});
```

### Retry with Max Total Attempts

```typescript
import { retryWithMaxTotalAttempts } from "smart-retry";

let tries = 0;
await retryWithMaxTotalAttempts(
  () => {
    tries++;
    if (tries < 4) throw new Error("Still failing");
    return "success";
  },
  5, // max total attempts (including the first)
  { delay: 100 },
);
```

---

## 📄 License

MIT © jaktestowac.pl

Powered by [jaktestowac.pl](https://www.jaktestowac.pl/) team!

🌐 Check out **[GitHub](https://github.com/jaktestowac) profile** for more open-source projects and resources.
