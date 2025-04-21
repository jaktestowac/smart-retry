# Smart-Retry

> Smart utility to retry flaky sync/async operations with delay, backoff, and retry hooks.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## ✨ Features

- ✅ Works with sync and async functions
- 🔁 Configurable number of retries and delay
- ⏱️ Exponential backoff support
- 🔍 `onRetry` hook for logging or metrics
- ⚠️ Optional error filtering with `shouldRetry`
- 🪶 Zero dependencies

---

## 📦 Install

```bash
npm install smart-retry
```

## 📦 Usage

```typescript
import { retry } from 'smart-retry';

async function fetchData() {
    const res = await fetch('https://example.com/api');
    if (!res.ok) throw new Error('API error');
    return res.json();
}

const result = await retry(() => fetchData(), {
    retries: 3,
    delay: 1000,
    factor: 2,
    onRetry: (err, attempt) => {
        console.warn(`Attempt #${attempt} failed: ${err}`);
    }
});
```

## ⚙️ API

| Option       | Type                     | Default | Description                                |
|--------------|--------------------------|---------|--------------------------------------------|
| `retries`    | `number`                 | `3`     | Number of retry attempts                   |
| `delay`      | `number` (ms)            | `500`   | Initial delay between retries              |
| `factor`     | `number`                 | `2`     | Multiplier for exponential backoff         |
| `onRetry`    | `(err, attempt) => void` | `-`     | Hook called on every failed retry          |
| `shouldRetry`| `(err) => boolean`       | `always`| Optional predicate to decide if error is retryable |

### Backoff calculation

The delay between retries increases exponentially based on the `factor` parameter:
- 1st retry: delay
- 2nd retry: delay × factor
- 3rd retry: delay × factor²
- etc.

For example, with `delay: 1000` and `factor: 2`:
- 1st retry: 1000ms (1s)
- 2nd retry: 2000ms (2s)
- 3rd retry: 4000ms (4s)

## ✅ Examples

### Retry a Function

```javascript
let count = 0;

const result = await retry(() => {
    count++;
    if (count < 3) throw new Error('Oops');
    return 'done';
});

console.log(result); // Output: 'done' after 3 attempts
```

### Retry with Exponential Backoff and Error Filtering

```typescript
await retry(() => fetchSomething(), {
    retries: 5,
    delay: 500,
    factor: 1.5,
    shouldRetry: (err) => err instanceof TimeoutError
});
```

## 📄 License

MIT © jaktestowac.pl

Powered by [jaktestowac.pl](https://www.jaktestowac.pl/) team!