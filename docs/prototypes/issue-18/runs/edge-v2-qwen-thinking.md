# OpenRouter routing evaluation

THROWAWAY PROTOTYPE results. Tool calls were captured but never executed.

- Started: 2026-09-30T15:25:12.663Z
- Completed: 2026-09-30T15:33:18.094Z
- Budget cap: $9.00 USD
- Recorded cost: $0.022898 USD
- Repetitions per case: 3

| Model | Interface | Pass | Invalid route/args | No tool | API error | Cost USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| qwen/qwen3-14b | split_v2 | 39 | 15 | 0 | 0 | 0.011462 |
| qwen/qwen3-14b | router_v2 | 42 | 12 | 0 | 0 | 0.011436 |

The JSONL sibling is the primary trace: it preserves every emitted tool name and argument object.
