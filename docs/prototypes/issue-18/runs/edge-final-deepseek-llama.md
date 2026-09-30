# OpenRouter routing evaluation

THROWAWAY PROTOTYPE results. Tool calls were captured but never executed.

- Started: 2026-09-30T15:54:24.163Z
- Completed: 2026-09-30T15:54:42.695Z
- Budget cap: $9.00 USD
- Recorded cost: $0.007243 USD
- Repetitions per case: 3

| Model | Interface | Pass | Invalid route/args | No tool | API error | Cost USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| deepseek/deepseek-v4.1-flash | router_v3 | 44 | 2 | 8 | 0 | 0.005867 |
| meta-llama/llama-3.1-8b-instruct | router_v3 | 54 | 0 | 0 | 0 | 0.001376 |

The JSONL sibling is the primary trace: it preserves every emitted tool name and argument object.
