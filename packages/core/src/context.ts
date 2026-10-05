import type { UpstreamRuntime } from "./upstream.js";

export interface ToolContext {
  /** Defaults to the process-wide execution lane in both transports. */
  upstream?: UpstreamRuntime;
}
