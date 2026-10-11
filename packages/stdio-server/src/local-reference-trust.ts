import { randomBytes } from "node:crypto";
import { chmod, link, lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, posix, win32 } from "node:path";

const KEY_PATTERN = /^[a-f0-9]{64}$/i;
const APPLICATION_DIRECTORY = "normattiva-mcp";
const KEY_FILE = "reference-key";

interface LocalReferenceTrustStorage {
  read(file: string): Promise<string | undefined>;
  /** Atomically preserve `value`, or return the concurrently preserved winner. */
  create(file: string, value: string): Promise<string>;
}

export interface LocalReferenceTrustRuntime {
  environment: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  homeDirectory(): string;
  randomKey(): Uint8Array;
  storage: LocalReferenceTrustStorage;
}

class LocalReferenceTrustError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LocalReferenceTrustError";
    this.code = code;
  }
}

function invalidEnvironment(): LocalReferenceTrustError {
  return new LocalReferenceTrustError(
    "reference_trust_invalid_environment",
    "NORMATTIVA_REFERENCE_KEY is present but must be exactly 64 hexadecimal characters. Fix or remove it before restarting.",
  );
}

function invalidStore(): LocalReferenceTrustError {
  return new LocalReferenceTrustError(
    "reference_trust_invalid_store",
    "Persisted local reference trust is malformed and was left unchanged. Restore it intentionally, or set NORMATTIVA_REFERENCE_KEY to exactly 64 hexadecimal characters.",
  );
}

function unavailable(): LocalReferenceTrustError {
  return new LocalReferenceTrustError(
    "reference_trust_unavailable",
    "Automatic local reference trust is unavailable. Set NORMATTIVA_REFERENCE_KEY to a preserved 64-character hexadecimal key and restart.",
  );
}

function referenceKeyPath(runtime: LocalReferenceTrustRuntime): string {
  const paths = runtime.platform === "win32" ? win32 : posix;
  let base: string | undefined;
  if (runtime.platform === "win32") {
    base = runtime.environment.LOCALAPPDATA;
  } else {
    const home = runtime.homeDirectory();
    base = runtime.platform === "darwin"
      ? (home ? paths.join(home, "Library", "Application Support") : undefined)
      : runtime.environment.XDG_STATE_HOME || (home ? paths.join(home, ".local", "state") : undefined);
  }
  if (!base || !paths.isAbsolute(base)) throw unavailable();
  return paths.join(base, APPLICATION_DIRECTORY, KEY_FILE);
}

function decodeKey(value: string, source: "environment" | "store"): Buffer {
  if (!KEY_PATTERN.test(value)) {
    throw source === "environment" ? invalidEnvironment() : invalidStore();
  }
  return Buffer.from(value, "hex");
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

function isExisting(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "EEXIST";
}

function nodeStorage(platform: NodeJS.Platform): LocalReferenceTrustStorage {
  const supportsPermissions = platform !== "win32";
  const paths = platform === "win32" ? win32 : posix;

  async function secureExistingDirectory(directory: string): Promise<boolean> {
    let metadata;
    try { metadata = await lstat(directory); }
    catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error("Unsafe local trust directory.");
    if (supportsPermissions) await chmod(directory, 0o700);
    return true;
  }

  async function secureDirectory(directory: string): Promise<void> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!await secureExistingDirectory(directory)) throw new Error("Local trust directory disappeared.");
  }

  async function secureRead(file: string): Promise<string | undefined> {
    let metadata;
    try { metadata = await lstat(file); }
    catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Unsafe local trust file.");
    if (supportsPermissions) await chmod(file, 0o600);
    return readFile(file, "utf8");
  }

  return {
    async read(file) {
      const directory = dirname(file);
      if (!await secureExistingDirectory(directory)) return undefined;
      return secureRead(file);
    },

    async create(file, value) {
      const directory = dirname(file);
      await secureDirectory(directory);
      const temporary = paths.join(directory, `.${KEY_FILE}.${process.pid}.${randomBytes(12).toString("hex")}`);
      let handle;
      let created = false;
      try {
        handle = await open(temporary, "wx", 0o600);
        await handle.writeFile(value, "utf8");
        await handle.sync();
        await handle.close();
        handle = undefined;
        try { await link(temporary, file); created = true; }
        catch (error) { if (!isExisting(error)) throw error; }
        if (created && supportsPermissions) {
          const directoryHandle = await open(directory, "r");
          try { await directoryHandle.sync(); }
          finally { await directoryHandle.close(); }
        }
      } finally {
        if (handle) await handle.close().catch(() => undefined);
        await unlink(temporary).catch(error => { if (!isMissing(error)) throw error; });
      }
      const preserved = await secureRead(file);
      if (preserved === undefined) throw new Error("Atomic local trust creation did not produce a file.");
      return preserved;
    },
  };
}

function defaultRuntime(): LocalReferenceTrustRuntime {
  const platform = process.platform;
  return {
    environment: process.env,
    platform,
    homeDirectory: homedir,
    randomKey: () => randomBytes(32),
    storage: nodeStorage(platform),
  };
}

/** Resolve stable trust for local stdio. Hosted callers keep explicit-only trust. */
export async function resolveLocalSigningKey(
  runtime: LocalReferenceTrustRuntime = defaultRuntime(),
): Promise<Buffer> {
  const explicit = runtime.environment.NORMATTIVA_REFERENCE_KEY;
  if (explicit !== undefined) return decodeKey(explicit, "environment");

  let file: string;
  try { file = referenceKeyPath(runtime); }
  catch (error) {
    if (error instanceof LocalReferenceTrustError) throw error;
    throw unavailable();
  }

  let stored: string | undefined;
  try { stored = await runtime.storage.read(file); }
  catch { throw unavailable(); }
  if (stored !== undefined) return decodeKey(stored, "store");

  let generated: Uint8Array;
  try { generated = runtime.randomKey(); }
  catch { throw unavailable(); }
  if (generated.byteLength !== 32) throw unavailable();

  let preserved: string;
  try { preserved = await runtime.storage.create(file, Buffer.from(generated).toString("hex")); }
  catch { throw unavailable(); }
  return decodeKey(preserved, "store");
}
