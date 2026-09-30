# OpenRouter routing evaluation

THROWAWAY PROTOTYPE results. Tool calls were captured but never executed.

- Started: 2026-09-30T15:24:01.997Z
- Completed: 2026-09-30T15:24:46.909Z
- Budget cap: $9.00 USD
- Recorded cost: $0.020514 USD
- Repetitions per case: 3

| Model | Interface | Pass | Invalid route/args | No tool | API error | Cost USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| deepseek/deepseek-v4.1-flash | split_v2 | 28 | 9 | 17 | 0 | 0.009057 |
| deepseek/deepseek-v4.1-flash | router_v2 | 31 | 2 | 21 | 0 | 0.007179 |
| meta-llama/llama-3.1-8b-instruct | split_v2 | 31 | 23 | 0 | 0 | 0.002218 |
| meta-llama/llama-3.1-8b-instruct | router_v2 | 33 | 18 | 3 | 0 | 0.002061 |

The JSONL sibling is the primary trace: it preserves every emitted tool name and argument object.
