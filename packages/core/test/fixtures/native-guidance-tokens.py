"""Measure native vocabulary costs: INPUT TOKENIZER_JSON [TOKENIZERS_INSTALL_DIR]."""
import hashlib
import json
import sys
if len(sys.argv) > 3:
    sys.path.insert(0, sys.argv[3])
from tokenizers import Tokenizer, __version__

with open(sys.argv[1]) as handle:
    data = json.load(handle)
tokenizer = Tokenizer.from_file(sys.argv[2])
def count(text):
    return len(tokenizer.encode(text, add_special_tokens=False).ids)
def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
def strip(value):
    if isinstance(value, dict):
        return {key: strip(child) for key, child in value.items() if key != 'description'}
    if isinstance(value, list):
        return [strip(child) for child in value]
    return value
def explanations(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in ('explanation', 'message') and isinstance(child, str):
                yield child
            else:
                yield from explanations(child)
    elif isinstance(value, list):
        for child in value:
            yield from explanations(child)
with open(sys.argv[2], 'rb') as handle:
    digest = hashlib.sha256(handle.read()).hexdigest()
base, full = count(compact(strip(data['schema']))), count(compact(data['schema']))
samples = {key: {'explanatory_tokens_both_representations': 2 * sum(count(text) for text in explanations(value['structuredContent'])),
                 'full_mcp_tokens': count(compact(value))}
           for key, value in data['samples'].items()}
passed = (full / base - 1) * 100 <= 10 and all(value['explanatory_tokens_both_representations'] <= 60 for value in samples.values())
print(json.dumps({'tokenizers_version': __version__, 'tokenizer_sha256': digest,
                  'schema_without_descriptions': base, 'schema_with_descriptions': full,
                  'guidance_percent': (full / base - 1) * 100, 'samples': samples,
                  'scope': 'Native vocabulary on compact tools/list and full MCP results, without client/provider chat wrappers. Conservative description-free interface baseline.',
                  'gate': 'passed' if passed else 'failed'}, indent=2))
sys.exit(0 if passed else 1)
