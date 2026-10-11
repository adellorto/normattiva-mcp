import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveLocalSigningKey } from '../../stdio-server/dist/local-reference-trust.js';

const keyA = Buffer.alloc(32, 0xa1);
const keyB = Buffer.alloc(32, 0xb2);

function memoryRuntime({ environment = {}, stored, platform = 'linux', home = '/home/tester' } = {}) {
  const state = { stored, creates: [], reads: 0, randomCalls: 0 };
  return {
    state,
    runtime: {
      environment,
      platform,
      homeDirectory: () => home,
      randomKey: () => { state.randomCalls++; return keyA; },
      storage: {
        async read(file) { state.reads++; state.file = file; return state.stored; },
        async create(file, value) {
          state.creates.push({ file, value });
          if (state.stored === undefined) state.stored = value;
          return state.stored;
        },
      },
    },
  };
}

test('an explicit valid key takes precedence without touching local state', async () => {
  const { runtime, state } = memoryRuntime({
    environment: { NORMATTIVA_REFERENCE_KEY: keyB.toString('hex') },
    stored: keyA.toString('hex'),
  });
  assert.deepEqual(await resolveLocalSigningKey(runtime), keyB);
  assert.equal(state.reads, 0);
  assert.equal(state.randomCalls, 0);
});

test('an explicit malformed key fails instead of falling back or exposing its value', async () => {
  const malformed = 'private-invalid-key';
  const { runtime, state } = memoryRuntime({
    environment: { NORMATTIVA_REFERENCE_KEY: malformed },
  });
  await assert.rejects(resolveLocalSigningKey(runtime), error =>
    error.code === 'reference_trust_invalid_environment'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY')
      && !error.message.includes(malformed));
  assert.equal(state.reads, 0);
  assert.equal(state.randomCalls, 0);
});

test('first local launch creates trust in the OS user-state location and restart reuses it', async () => {
  const { runtime, state } = memoryRuntime({ environment: { XDG_STATE_HOME: '/state' } });
  assert.deepEqual(await resolveLocalSigningKey(runtime), keyA);
  assert.equal(state.file, '/state/normattiva-mcp/reference-key');
  assert.deepEqual(state.creates, [{
    file: '/state/normattiva-mcp/reference-key',
    value: keyA.toString('hex'),
  }]);

  runtime.randomKey = () => { throw new Error('restart must not generate'); };
  assert.deepEqual(await resolveLocalSigningKey(runtime), keyA);
  assert.equal(state.creates.length, 1);
});

test('a malformed stored value fails without replacing it or disclosing it', async () => {
  const malformed = 'stored-private-invalid-key';
  const { runtime, state } = memoryRuntime({ stored: malformed });
  await assert.rejects(resolveLocalSigningKey(runtime), error =>
    error.code === 'reference_trust_invalid_store'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY')
      && !error.message.includes(malformed));
  assert.equal(state.creates.length, 0);
  assert.equal(state.randomCalls, 0);
});

test('concurrent first launches converge on the one atomically preserved key', async () => {
  let stored;
  let entrants = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const storage = {
    async read() { return stored; },
    async create(_file, value) {
      entrants++;
      if (entrants === 2) release();
      await gate;
      if (stored === undefined) stored = value;
      return stored;
    },
  };
  const base = {
    environment: { XDG_STATE_HOME: '/state' }, platform: 'linux',
    homeDirectory: () => '/home/tester', storage,
  };
  const [first, second] = await Promise.all([
    resolveLocalSigningKey({ ...base, randomKey: () => keyA }),
    resolveLocalSigningKey({ ...base, randomKey: () => keyB }),
  ]);
  assert.deepEqual(first, second);
  assert.equal(stored, first.toString('hex'));
});

test('state-location and storage failures are safe and give explicit override guidance', async () => {
  const missing = memoryRuntime({ home: '' }).runtime;
  await assert.rejects(resolveLocalSigningKey(missing), error =>
    error.code === 'reference_trust_unavailable'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY'));

  const unavailable = memoryRuntime().runtime;
  unavailable.storage.read = async () => { throw new Error(`permission denied for ${keyA.toString('hex')}`); };
  await assert.rejects(resolveLocalSigningKey(unavailable), error =>
    error.code === 'reference_trust_unavailable'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY')
      && !error.message.includes(keyA.toString('hex')));

  const unwritable = memoryRuntime().runtime;
  unwritable.storage.create = async () => {
    throw new Error(`read-only state for ${keyA.toString('hex')}`);
  };
  await assert.rejects(resolveLocalSigningKey(unwritable), error =>
    error.code === 'reference_trust_unavailable'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY')
      && !error.message.includes(keyA.toString('hex')));
});

test('default platform locations are stable and platform-appropriate', async () => {
  const linux = memoryRuntime();
  await resolveLocalSigningKey(linux.runtime);
  assert.equal(linux.state.file, '/home/tester/.local/state/normattiva-mcp/reference-key');

  const mac = memoryRuntime({ platform: 'darwin', home: '/Users/tester' });
  await resolveLocalSigningKey(mac.runtime);
  assert.equal(mac.state.file, '/Users/tester/Library/Application Support/normattiva-mcp/reference-key');

  const windows = memoryRuntime({
    platform: 'win32', home: 'C:\\Users\\tester',
    environment: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
  });
  await resolveLocalSigningKey(windows.runtime);
  assert.equal(windows.state.file, 'C:\\Users\\tester\\AppData\\Local\\normattiva-mcp\\reference-key');

  const missingWindowsState = memoryRuntime({ platform: 'win32', home: 'C:\\Users\\tester' });
  await assert.rejects(resolveLocalSigningKey(missingWindowsState.runtime), error =>
    error.code === 'reference_trust_unavailable'
      && error.message.includes('NORMATTIVA_REFERENCE_KEY'));
  assert.equal(missingWindowsState.state.reads, 0);
});
