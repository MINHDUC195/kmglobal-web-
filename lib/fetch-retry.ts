/**
 * Fetch with retry on network/5xx errors.
 * Does not retry on 4xx (client errors).
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Do not retry client errors
      if (res.status >= 400 && res.status < 500) return res;
      if (res.ok || attempt === maxRetries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === maxRetries) throw err;
    }
    // Exponential backoff: 500ms, 1s
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
  throw lastError;
}
