import { parentPort, workerData } from "node:worker_threads";
import { parseAct } from "./act-source.js";
import { OperationError } from "./errors.js";
try {
  parentPort!.postMessage({ act: parseAct(workerData.xml, workerData.publication, workerData.date, workerData.portal) });
} catch (error) {
  parentPort!.postMessage({ error: error instanceof OperationError ? error.detail : {
    category: "upstream_failure", code: "parse_limit_exceeded", message: "The structured source could not be parsed within its limits.", retryability: false,
  } });
}
