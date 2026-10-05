import { Worker } from "node:worker_threads";
import { OperationError, internalError } from "./errors.js";
import type { ParsedAct, PortalEvidence, Publication } from "./act-source.js";

let previousPreparation = Promise.resolve();
/** Serialize decoded source preparation as well as upstream attempts, so
 * queued callers cannot retain many complete bodies or simultaneous parsers. */
export async function prepareSource<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  const previous = previousPreparation;
  let release!: () => void;
  const done = new Promise<void>(resolve => { release = resolve; });
  previousPreparation = previous.then(() => done);
  let abort!: () => void;
  try {
    await Promise.race([previous, new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason ?? internalError("operation_cancelled", "Source preparation was cancelled.", false));
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    })]);
    if (signal.aborted) throw signal.reason;
    return await work();
  } finally { signal.removeEventListener("abort", abort); release(); }
}

/** Isolate XML allocation from the host heap and enforce an actual parse heap
 * ceiling. Worker termination releases the tree before emitting useful pages. */
export function parseSource(xml: string, publication: Publication, date: string, portal: PortalEvidence, signal: AbortSignal): Promise<ParsedAct> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./act-parser-worker.js", import.meta.url), {
      workerData: { xml, publication, date, portal },
      resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 4, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = async (act?: ParsedAct, failure?: unknown) => {
      if (settled) return; settled = true;
      signal.removeEventListener("abort", abort);
      await worker.terminate();
      if (failure) reject(failure); else resolve(act!);
    };
    const abort = () => { void finish(undefined, signal.reason ?? internalError("operation_cancelled", "Source parsing was cancelled.", false)); };
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", message => { void finish(message.act, message.error ? new OperationError(message.error) : undefined); });
    worker.once("error", () => { void finish(undefined, new OperationError({ category: "upstream_failure", code: "parse_limit_exceeded",
      message: "The XML parser exceeded its memory or structural limit.", retryability: false })); });
    worker.once("exit", () => { if (!settled) void finish(undefined, internalError("parser_interrupted", "The source parser stopped before producing a result.", false)); });
    if (signal.aborted) abort();
  });
}
