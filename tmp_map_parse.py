import json
import sys
from pathlib import Path
from bisect import bisect_right

if len(sys.argv) != 4:
    print('Usage: tmp_map_parse.py <map-file> <line> <column>')
    sys.exit(1)

map_path = Path(sys.argv[1])
line = int(sys.argv[2])
column = int(sys.argv[3])

with map_path.open('r', encoding='utf-8') as f:
    data = json.load(f)

print('file:', data.get('file'))
print('sources count:', len(data.get('sources', [])))

# This is a simplified lookup using sourcemap entries if available
# We only print the first matching mapping for the line/column.

mappings = data['mappings']
print('mappings length:', len(mappings))
print('first chars:', mappings[:120])
print('---')
print('NOTE: raw mapping lookup needs a sourcemap parser; using a minimal fallback would be inaccurate.')
