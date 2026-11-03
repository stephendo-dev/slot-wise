import { Injectable } from '@nestjs/common';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface Failures {
  count: number;
  firstAt: number;
}

// Failed logins per (client address, email), in memory. A restart or a second
// instance resets it, which is acceptable for one small Cloud Run service.
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new Map<string, Failures>();

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (now - entry.firstAt > WINDOW_MS) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.failures.get(key);
    if (!entry || now - entry.firstAt > WINDOW_MS) {
      this.failures.set(key, { count: 1, firstAt: now });
      return;
    }
    entry.count += 1;
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
