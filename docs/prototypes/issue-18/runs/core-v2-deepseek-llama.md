# OpenRouter routing evaluation

THROWAWAY PROTOTYPE results. Tool calls were captured but never executed.

- Started: 2026-09-30T15:04:06.409Z
- Completed: 2026-09-30T15:04:28.558Z
- Budget cap: $9.00 USD
- Recorded cost: $0.009854 USD
- Repetitions per case: 3

| Model | Interface | Pass | Invalid route/args | No tool | API error | Cost USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| deepseek/deepseek-v4.1-flash | split_v2 | 25 | 0 | 5 | 0 | 0.003960 |
| deepseek/deepseek-v4.1-flash | router_v2 | 25 | 1 | 4 | 0 | 0.003792 |
| meta-llama/llama-3.1-8b-instruct | split_v2 | 21 | 9 | 0 | 0 | 0.001228 |
| meta-llama/llama-3.1-8b-instruct | router_v2 | 27 | 3 | 0 | 0 | 0.000874 |

The JSONL sibling is the primary trace: it preserves every emitted tool name and argument object.
