import { AsyncLocalStorage } from "node:async_hooks";
import { OperationError, internalError } from "./errors.js";

export const UPSTREAM_POLICY = Object.freeze({
  deadlineMs: 50_000,
  attemptTimeoutMs: 20_000,
  directAttempts: 2,
  composedAttempts: 16,
});

type Policy = typeof UPSTREAM_POLICY;
export type CallKind = "direct" | "composed";

export interface CallScope {
  readonly runtime: UpstreamRuntime;
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly maxAttempts: number;
  attempts: number;
  queueMs: number;
  upstreamMs: number;
}

interface Waiter {
  grant: (release: () => void) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
  abort: () => void;
}

export interface UpstreamOperation<T> {
  operation: string;
  replaySafe: boolean;
  execute: (signal: AbortSignal) => Promise<T>;
}

const scopes = new AsyncLocalStorage<CallScope>();

function cancelled(signal: AbortSignal): OperationError {
  return signal.reason instanceof OperationError ? signal.reason
    : internalError("operation_cancelled", "The caller cancelled the operation.", false);
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(cancelled(signal));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); cleanup(); reject(cancelled(signal)); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One lane per process; each attempt rejoins the FIFO queue, including retries. */
export class UpstreamRuntime {
  readonly policy: Policy;
  private active = false;
  private readonly queue: Waiter[] = [];
  private notBefore = 0;

  // Policy injection is internal to deterministic tests, never a tool input.
  constructor(policy: Partial<Policy> = {}, private readonly random = Math.random) {
    this.policy = { ...UPSTREAM_POLICY, ...policy };
  }

  async call<T>(kind: CallKind, signal: AbortSignal | undefined, work: (scope: CallScope) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort(internalError("operation_cancelled", "The caller cancelled the operation.", false));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => controller.abort(internalError(
      "operation_deadline_exceeded", "The shared operation deadline expired.", true,
    )), this.policy.deadlineMs);
    const scope: CallScope = {
      runtime: this, signal: controller.signal, deadline: Date.now() + this.policy.deadlineMs,
      maxAttempts: kind === "direct" ? this.policy.directAttempts : this.policy.composedAttempts,
      attempts: 0, queueMs: 0, upstreamMs: 0,
    };
    try {
      if (scope.signal.aborted) throw cancelled(scope.signal);
      return await scopes.run(scope, () => work(scope));
    } catch (error) {
      if (error instanceof OperationError && error.detail.code === "operation_deadline_exceeded"
          && this.notBefore > Date.now()) throw this.rateLimit(this.notBefore - Date.now());
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      // Stop any speculative queued work when a composed caller has already returned.
      controller.abort(internalError("operation_finished", "The operation has finished.", false));
    }
  }

  private acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(cancelled(signal));
    return new Promise((grant, reject) => {
      const waiter: Waiter = {
        grant, reject, signal,
        abort: () => {
          const position = this.queue.indexOf(waiter);
          if (position >= 0) this.queue.splice(position, 1);
          reject(cancelled(signal));
        },
      };
      signal.addEventListener("abort", waiter.abort, { once: true });
      this.queue.push(waiter);
      this.pump();
    });
  }

  private pump(): void {
    if (this.active) return;
    const waiter = this.queue.shift();
    if (!waiter) return;
    waiter.signal.removeEventListener("abort", waiter.abort);
    this.active = true;
    waiter.grant(() => { this.active = false; this.pump(); });
  }

  private rateLimit(delay: number): OperationError {
    return new OperationError({
      category: "rate_limited", code: "upstream_rate_limited",
      message: "Normattiva is rate limited; retry in a later call.",
      retryability: true, retry_after_ms: Math.max(0, Math.ceil(delay)), provider: "normattiva",
    });
  }

  async execute<T>(scope: CallScope, operation: UpstreamOperation<T>): Promise<T> {
    for (let localAttempt = 0; localAttempt < 2; localAttempt++) {
      if (scope.signal.aborted) throw cancelled(scope.signal);
      if (scope.attempts >= scope.maxAttempts) throw internalError(
        "attempt_budget_exhausted", "The operation used its upstream attempt allowance.", true,
      );
      const queuedAt = Date.now();
      const release = await this.acquire(scope.signal);
      let failure: OperationError | undefined;
      try {
        const delay = this.notBefore - Date.now();
        if (delay > 0) {
          if (delay >= scope.deadline - Date.now()) throw this.rateLimit(delay);
          await pause(delay, scope.signal);
        }
        scope.queueMs += Date.now() - queuedAt;
        if (scope.signal.aborted) throw cancelled(scope.signal);
        if (Date.now() >= scope.deadline) throw internalError(
          "operation_deadline_exceeded", "The shared operation deadline expired.", true,
        );
        if (scope.attempts >= scope.maxAttempts) throw internalError(
          "attempt_budget_exhausted", "The operation used its upstream attempt allowance.", true,
        );
        scope.attempts++;
        const attempt = new AbortController();
        const timeout = new OperationError({
          category: "transport_failure", code: "upstream_timeout", retryability: true,
          message: "The upstream attempt timed out.", transport_cause: "timeout",
          provider: "normattiva", operation: operation.operation,
        });
        const timer = setTimeout(() => attempt.abort(timeout), Math.min(this.policy.attemptTimeoutMs, scope.deadline - Date.now()));
        const signal = AbortSignal.any([scope.signal, attempt.signal]);
        const startedAt = Date.now();
        try {
          const result = await operation.execute(signal);
          if (scope.signal.aborted) throw cancelled(scope.signal);
          if (attempt.signal.aborted) throw timeout;
          return result;
        } catch (error) {
          if (scope.signal.aborted) throw cancelled(scope.signal);
          if (attempt.signal.aborted) throw timeout;
          throw error;
        } finally {
          clearTimeout(timer);
          scope.upstreamMs += Date.now() - startedAt;
        }
      } catch (error) {
        if (!(error instanceof OperationError)) throw error;
        failure = error;
        if (error.detail.category === "rate_limited") {
          const delay = error.detail.retry_after_ms ?? (1_000 + 2_000 * this.random());
          this.notBefore = Math.max(this.notBefore, Date.now() + delay);
        }
      } finally {
        release();
      }
      if (!operation.replaySafe || failure.detail.retryability !== true || localAttempt === 1
          || scope.attempts >= scope.maxAttempts || scope.signal.aborted
          || failure.detail.category === "internal_failure"
          || (failure.detail.category === "rate_limited" && failure.detail.retry_after_ms === undefined)) {
        throw failure;
      }
      const delay = failure.detail.retry_after_ms ?? (500 + 1_000 * this.random());
      if (delay >= scope.deadline - Date.now()) throw failure;
      await pause(delay, scope.signal);
    }
    throw internalError("unexpected_execution_state", "Unexpected upstream execution state.");
  }
}

export const upstreamRuntime = new UpstreamRuntime();

export function currentCall(): CallScope | undefined { return scopes.getStore(); }

export function executeUpstream<T>(operation: UpstreamOperation<T>): Promise<T> {
  const scope = currentCall();
  return scope ? scope.runtime.execute(scope, operation)
    : upstreamRuntime.call("direct", undefined, (call) => upstreamRuntime.execute(call, operation));
}
