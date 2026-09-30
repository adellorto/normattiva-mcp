# Curated routing evaluation traces

These are throwaway prototype traces. Calls were captured but never executed.
Every JSONL row records the model, provider, interface, scenario, emitted tool
name and arguments, validation result, token usage, and reported OpenRouter
cost. The Markdown sibling summarizes each run.

## Core baseline

`core-baseline.jsonl` contains the balanced ten-scenario baseline for Qwen 3
14B thinking, DeepSeek V4.1 Flash, and Llama 3.1 8B Instruct across the current
wide tool, original exact/discovery split, and discriminated one-of interface.

| Model | Current wide | Original split | One-of |
| --- | ---: | ---: | ---: |
| Qwen 3 14B, thinking | 25/30 | 19/30 | 21/30 |
| DeepSeek V4.1 Flash | 13/30 | 21/30 | 19/30 |
| Llama 3.1 8B Instruct | 15/30 | 18/30 | 6/30 |

## First optimization

- `core-v2-deepseek-llama.{jsonl,md}`
- `core-v2-qwen-thinking.{jsonl,md}`
- `edge-v2-deepseek-llama.{jsonl,md}`
- `edge-v2-qwen-thinking.{jsonl,md}`

## Final optimization

- `core-final-deepseek.{jsonl,md}`
- `core-final-llama-groq.{jsonl,md}`
- `core-final-qwen-thinking.{jsonl,md}`
- `edge-final-deepseek-llama.{jsonl,md}`
- `edge-final-qwen-thinking.{jsonl,md}`

The final interface schema is 1,478 bytes and exposes only
`find_acts({request})` and `continue_acts({cursor})`. Qwen runs use thinking
mode. The final Llama core run is pinned to Groq; the final Llama edge calls
were also served by Groq through OpenRouter routing.
