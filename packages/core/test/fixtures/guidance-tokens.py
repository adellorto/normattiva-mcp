"""Optional measurement: python3 guidance-tokens.py INPUT [TIKTOKEN_INSTALL_DIR]."""
import json
import sys
if len(sys.argv) > 2:
    sys.path.insert(0, sys.argv[2])
import tiktoken
with open(sys.argv[1]) as handle:
    data = json.load(handle)
def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
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
baseline = {'tools': [{key: value for key, value in tool.items() if key != 'description'} for tool in data['schema']['tools']]}
result = {'tiktoken_version': tiktoken.__version__, 'baseline': 'Same tools/list with every tool description removed; conservative guidance upper bound. No client wrappers or model evaluation.',
          'sample_basis': 'Synthetic default-registration MCP responses. Explanations plus error messages; both duplicated MCP representations counted. Full payload includes locators and metadata.', 'encodings': {}}
for name in ('o200k_base', 'cl100k_base'):
    enc = tiktoken.get_encoding(name)
    count = lambda value: len(enc.encode(value))
    base, full = count(compact(baseline)), count(compact(data['schema']))
    samples = {key: {'explanatory_tokens_one_representation': sum(count(text) for text in explanations(value['structuredContent'])),
                     'explanatory_tokens_both_representations': 2 * sum(count(text) for text in explanations(value['structuredContent'])),
                     'full_mcp_tokens': count(compact(value))}
               for key, value in data['samples'].items()}
    result['encodings'][name] = {'schema_without_descriptions': base, 'schema_with_descriptions': full,
                                'guidance_percent': round((full - base) / base * 100, 2), 'samples': samples}
print(json.dumps(result, indent=2))
if any(value['guidance_percent'] > 10 or any(sample['explanatory_tokens_both_representations'] > 60 for sample in value['samples'].values()) for value in result['encodings'].values()):
    sys.exit(1)
