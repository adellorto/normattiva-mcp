import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dettaglioAtto } from '../dist/api.js';
import { UpstreamRuntime, executeUpstream } from '../dist/upstream.js';
import { OperationError } from '../dist/errors.js';

const articleRequest = {
  dataGU: '1988-09-12', codiceRedazionale: '088G0458', idArticolo: 13,
  sottoArticolo: 2, sottoArticolo1: 0, dataVigenza: '2025-01-01',
  idGruppo: 6, progressivo: 0, versione: 0,
};

test('a throttle with code 1000 remains an operational failure, never an article miss', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return Response.json({ code: '1000', message: 'Too many requests' }, { status: 429 });
  };
  try {
    await assert.rejects(dettaglioAtto(articleRequest), error => {
      assert.equal(error.detail.category, 'rate_limited');
      assert.equal(error.detail.code, 'upstream_rate_limited');
      return true;
    });
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('known transient responses may retry, but unclassified gateway failures remain unknown', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, body, retryability, expectedAttempts] of [
      [400, { code: '1005' }, false, 1], [422, { code: '1006' }, false, 1],
      [404, { message: 'non trovato' }, 'unknown', 1],
      [500, { code: '500', message: 'Errore generico della chiamata, riprovare più tardi' }, true, 2],
      [500, { message: 'unclassified gateway HTML' }, 'unknown', 1],
      [503, { message: 'unclassified overload' }, 'unknown', 1],
      [529, { message: 'unclassified overload' }, 'unknown', 1],
      [502, { message: 'Bad Gateway' }, 'unknown', 1],
    ]) {
      let attempts = 0;
      globalThis.fetch = async () => { attempts++; return Response.json(body, { status }); };
      const runtime = new UpstreamRuntime({}, () => 0);
      await assert.rejects(runtime.call('direct', undefined, () => dettaglioAtto(articleRequest)), error => {
        assert.equal(error.detail.category, 'upstream_failure');
        assert.equal(error.detail.retryability, retryability);
        assert.equal(error.detail.http_status, status);
        return true;
      });
      assert.equal(attempts, expectedAttempts);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('a valid Retry-After authorizes one replay-safe retry and a shared cooldown', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const runtime = new UpstreamRuntime({}, () => 0);
  globalThis.fetch = async () => {
    attempts++;
    return attempts === 1 ? Response.json({ code: '1000' }, { status: 429, headers: { 'Retry-After': '0' } })
      : Response.json({ success: true, data: { atto: { articoloHtml: 'Article text' } } });
  };
  try {
    const result = await runtime.call('direct', undefined, () => dettaglioAtto(articleRequest));
    assert.equal(result.success, true);
    assert.equal(attempts, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('a throttle without Retry-After cools later calls without an immediate retry', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const runtime = new UpstreamRuntime({ deadlineMs: 30 }, () => 0);
  globalThis.fetch = async () => { attempts++; return Response.json({}, { status: 429 }); };
  try {
    await assert.rejects(runtime.call('direct', undefined, () => dettaglioAtto(articleRequest)), error =>
      error.detail.category === 'rate_limited' && error.detail.retry_after_ms === undefined);
    await assert.rejects(runtime.call('direct', undefined, () => dettaglioAtto(articleRequest)), error =>
      error.detail.category === 'rate_limited' && error.detail.retry_after_ms > 900);
    assert.equal(attempts, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid Retry-After values do not authorize immediate retries', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const value of ['-1', '0.5', 'NaN', 'tomorrow', '9999999999999999999999999999']) {
      let attempts = 0;
      globalThis.fetch = async () => { attempts++; return Response.json({}, { status: 429, headers: { 'Retry-After': value } }); };
      await assert.rejects(new UpstreamRuntime().call('direct', undefined, () => dettaglioAtto(articleRequest)), error =>
        error.detail.category === 'rate_limited' && error.detail.retry_after_ms === undefined);
      assert.equal(attempts, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('malformed successful responses cannot become misses or authorize retries', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const body of ['<html>gateway</html>', 'null', '{}', '{"success":true}', '{"success":true,"data":{"atto":{"articoloHtml":42}}}']) {
      let attempts = 0;
      globalThis.fetch = async () => { attempts++; return new Response(body); };
      await assert.rejects(new UpstreamRuntime().call('direct', undefined, () => dettaglioAtto(articleRequest)), error =>
        error.detail.code === 'malformed_upstream_response' && error.detail.retryability === false);
      assert.equal(attempts, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('bounded acquisition stops an oversized decoded source while receiving it', async () => {
  const originalFetch = globalThis.fetch;
  let stopped = false;
  let chunks = 0;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { stopped = true; },
  }));
  try {
    await assert.rejects(new UpstreamRuntime().call('direct', undefined, () => dettaglioAtto(articleRequest)), error =>
      error.detail.code === 'source_limit_exceeded' && error.detail.retryability === false);
    assert.equal(stopped, true);
    assert.ok(chunks <= 26, 'the receiver must cancel before buffering the unbounded stream');
  } finally { globalThis.fetch = originalFetch; }
});

test('low-level transport causes survive internally while public messages stay safe', async () => {
  const originalFetch = globalThis.fetch;
  const privateCause = new Error('secret hostname', { cause: { code: 'ENOTFOUND' } });
  globalThis.fetch = async () => { throw privateCause; };
  try {
    await assert.rejects(new UpstreamRuntime().call('direct', undefined, () => dettaglioAtto(articleRequest)), error => {
      assert.equal(error.cause, privateCause);
      assert.equal(error.detail.transport_cause, 'dns');
      assert.equal(error.detail.retryability, false);
      assert.equal(error.message.includes('secret hostname'), false);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('retries rejoin the FIFO lane and all composed work spends one attempt budget', async () => {
  const runtime = new UpstreamRuntime({ composedAttempts: 3 }, () => 0);
  const order = [];
  await runtime.call('composed', undefined, async scope => {
    const first = executeUpstream({ operation: 'first', replaySafe: true, execute: async () => {
      order.push('first');
      if (order.length === 1) throw new OperationError({ category: 'upstream_failure',
        code: 'known_transient', message: 'Retry later.', retryability: true, retry_after_ms: 0 });
      return 'retried';
    } });
    const second = executeUpstream({ operation: 'second', replaySafe: true, execute: async () => {
      order.push('second'); return 'second';
    } });
    assert.deepEqual(await Promise.all([first, second]), ['retried', 'second']);
    await assert.rejects(executeUpstream({ operation: 'excess', replaySafe: true,
      execute: async () => { throw new Error('must not execute'); },
    }), error => error.detail.code === 'attempt_budget_exhausted');
    assert.equal(scope.attempts, 3);
  });
  assert.deepEqual(order, ['first', 'second', 'first']);
});

test('replay-unsafe and unknown failures do not authorize automatic retries', async () => {
  for (const [replaySafe, retryability] of [[false, true], [true, 'unknown']]) {
    let attempts = 0;
    const runtime = new UpstreamRuntime();
    await assert.rejects(runtime.call('direct', undefined, () => executeUpstream({
      operation: 'export', replaySafe, execute: async () => {
        attempts++;
        throw new OperationError({ category: 'upstream_failure', code: 'ambiguous_failure',
          message: 'Unknown completion.', retryability });
      },
    })), error => error.detail.code === 'ambiguous_failure');
    assert.equal(attempts, 1);
  }
});

test('in-flight timeout differs from the shared deadline while queueing', async () => {
  const runtime = new UpstreamRuntime({ deadlineMs: 100, attemptTimeoutMs: 25 });
  await assert.rejects(runtime.call('direct', undefined, () => executeUpstream({
    operation: 'slow', replaySafe: false, execute: signal => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  })), error => error.detail.code === 'upstream_timeout' && error.detail.category === 'transport_failure');

  const queuedRuntime = new UpstreamRuntime({ deadlineMs: 35, attemptTimeoutMs: 500 });
  let started = 0;
  let releaseHeld;
  // Hold the lane through cancellation so the queued deadline expires before
  // release; adjacent Date.now() deadlines can otherwise differ by a millisecond.
  const slow = queuedRuntime.call('direct', undefined, () => executeUpstream({
    operation: 'held', replaySafe: false, execute: () => new Promise(resolve => {
      started++;
      releaseHeld = resolve;
    }),
  }));
  const queued = queuedRuntime.call('direct', undefined, () => executeUpstream({
    operation: 'queued', replaySafe: true, execute: async () => { started++; },
  }));
  const slowResult = assert.rejects(slow, error => error.detail.code === 'upstream_timeout');
  try {
    await assert.rejects(queued, error => error.detail.code === 'operation_deadline_exceeded');
    assert.equal(started, 1);
  } finally {
    releaseHeld();
    await slowResult;
  }
});

test('caller cancellation stops queued traffic and aborts the active request', async () => {
  const runtime = new UpstreamRuntime();
  const controller = new AbortController();
  let started = 0;
  let aborted = false;
  const work = runtime.call('composed', controller.signal, async () => {
    const one = executeUpstream({ operation: 'one', replaySafe: true, execute: signal => new Promise((_, reject) => {
      started++;
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }) });
    const two = executeUpstream({ operation: 'two', replaySafe: true, execute: async () => { started++; } });
    queueMicrotask(() => controller.abort());
    await Promise.all([one, two]);
  });
  await assert.rejects(work, error => error.detail.code === 'operation_cancelled');
  assert.equal(started, 1);
  assert.equal(aborted, true);
});

test('expiry of the remaining time during an active attempt is an upstream timeout', async () => {
  const runtime = new UpstreamRuntime({ deadlineMs: 25, attemptTimeoutMs: 100 });
  await assert.rejects(runtime.call('direct', undefined, () => executeUpstream({
    operation: 'last-attempt', replaySafe: false, execute: signal => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  })), error => error.detail.category === 'transport_failure' && error.detail.code === 'upstream_timeout');
});
