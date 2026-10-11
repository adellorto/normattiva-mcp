# Version 0.2.0 publication record

Version 0.2.0 was published on 11 October 2026. This record captures the immutable public artifacts and the bounded production checks completed after publication. It supplements rather than rewrites the [pre-publication acceptance handoff](release-acceptance.md): statements and failed precursors in that document remain truthful for the time at which they were recorded.

## Published artifacts

| Artifact | Published identity |
| --- | --- |
| Source | Annotated tag [`v0.2.0`](https://github.com/adellorto/normattiva-mcp/tree/v0.2.0), created 11 October 2026 at 09:17:24 UTC, points to reviewed merge commit [`826b78f8e1b325378d12f0b4a81597209632320f`](https://github.com/adellorto/normattiva-mcp/commit/826b78f8e1b325378d12f0b4a81597209632320f). |
| GitHub | [normattiva-mcp v0.2.0 — New discovery and reading interface](https://github.com/adellorto/normattiva-mcp/releases/tag/v0.2.0) was published at 09:19:49 UTC and is neither a draft nor a prerelease. |
| npm | [`normattiva-mcp@0.2.0`](https://www.npmjs.com/package/normattiva-mcp/v/0.2.0) was published at 09:20:40 UTC. The registry reports six files and integrity `sha512-+J4/y/i5Zy0X8I6tKIidh+ycVFw5V5ftTb7j4GiidMXzd0S3AB1rQwATNOT4o4mG9TFwtBd8x3CIU9TBUQ4tLA==`. |
| Production | Vercel deployment `dpl_1GgSVdMQLk2pdqqxBWKE8JT2XW7y`, created at 09:19:57 UTC, is `Ready` with the production target and serves [`normattiva-mcp.adellorto.com`](https://normattiva-mcp.adellorto.com/). Its MCP endpoint is [`/api/mcp`](https://normattiva-mcp.adellorto.com/api/mcp). |

The Git tag, release, npm package and production initialization all report version 0.2.0. Version 0.2.0 local stdio continues to require an explicitly configured, preserved `NORMATTIVA_REFERENCE_KEY`. Hosted users supply no reference key; deployment trust remains an operator responsibility.

## Post-release production smoke

At 09:49:14 UTC on 11 October 2026, a bounded smoke check against the public production MCP endpoint passed without supplying a reference key or any other secret:

- initialization reported `normattiva-mcp` version `0.2.0`;
- the public surface contained the expected six tools, four resources and two prompts;
- discovery identified Legislative Decree 267/2000 and retained the requested article 13;
- an initial four-character article read returned `found` with `more`, and the exact returned cursor continued successfully with `found`;
- an invented discovery cursor returned the typed `invalid_cursor` category.

The redacted [machine-readable smoke result](release-publication-smoke.json) retains the observed counts, outcomes and hashes of the returned opaque references without storing the references themselves. This was a small live workflow, not a full crawl, load test or claim that upstream availability and model behavior can never fail.
