# Balanced-brace checker for Kotlin file (skips strings/comments/chars)
import sys

path = sys.argv[1]
depth = 0
in_str = False
in_char = False
in_block = False
prev = ''
problems = []
for i, raw in enumerate(open(path, encoding='utf-8'), start=1):
    s = raw.rstrip('\n')
    j = 0
    while j < len(s):
        c = s[j]
        n = s[j + 1] if j + 1 < len(s) else ''
        if in_block:
            if c == '*' and n == '/':
                in_block = False
                j += 2
                continue
            j += 1
            continue
        if in_str:
            if c == '\\':
                j += 2
                continue
            if c == '"':
                in_str = False
            j += 1
            continue
        if in_char:
            if c == '\\':
                j += 2
                continue
            if c == "'":
                in_char = False
            j += 1
            continue
        if c == '/' and n == '*':
            in_block = True
            j += 2
            continue
        if c == '/' and n == '/':
            break
        if c == '"':
            in_str = True
            j += 1
            continue
        if c == "'":
            in_char = True
            j += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth < 0:
                problems.append((i, 'EXTRA }', prev))
                depth = 0
        j += 1
    if 335 <= i <= 385:
        print(f'{i:4d} d={depth:2d}: {s[:70]}')
    prev = s
print(f'FINAL DEPTH: {depth}, in_block: {in_block}, in_str: {in_str}')
for p in problems:
    print('PROBLEM:', p)