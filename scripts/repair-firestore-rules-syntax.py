from pathlib import Path

RULES = Path('firestore.rules')
text = RULES.read_text(encoding='utf-8')

broken = """&& (request.resource.data.url == null
|| (shortString(request.resource.data.url, 1000)
&& commandG2ValidVisibility(request.resource.data.visibility)"""
fixed = """&& (request.resource.data.url == null
|| shortString(request.resource.data.url, 1000))
&& commandG2ValidVisibility(request.resource.data.visibility)"""

if broken in text:
    text = text.replace(broken, fixed, 1)
elif fixed not in text:
    raise RuntimeError('Expected commandMeetings URL guard was not found; refusing blind edit')

# Lightweight structural validation. Ignore quoted strings and // comments while
# checking delimiter balance so CI catches compaction damage before Firebase.
def validate_delimiters(src: str) -> None:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    line = 1
    i = 0
    in_string = False
    escape = False
    while i < len(src):
        ch = src[i]
        if ch == '\n':
            line += 1
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == "'":
                in_string = False
            i += 1
            continue
        if ch == "'":
            in_string = True
            i += 1
            continue
        if ch == '/' and i + 1 < len(src) and src[i + 1] == '/':
            end = src.find('\n', i + 2)
            if end == -1:
                break
            i = end
            continue
        if ch in '([{':
            stack.append((ch, line))
        elif ch in ')]}':
            if not stack or stack[-1][0] != pairs[ch]:
                raise RuntimeError(f'Unexpected {ch!r} at line {line}')
            stack.pop()
        i += 1
    if in_string:
        raise RuntimeError('Unterminated string literal')
    if stack:
        opener, opener_line = stack[-1]
        raise RuntimeError(f'Unclosed {opener!r} opened at line {opener_line}')

validate_delimiters(text)

# Preserve critical end-of-file deny boundary and staff permission model.
required = [
    "'portal.access' in currentStaff().permissions",
    "staffPermission('appeals.review')",
    "staffPermission('claims.review')",
    "staffPermission('payroll.approve')",
    "staffPermission('internalAffairs.manage')",
    "staffPermission('pr.approve')",
    'match /{document=**}',
    'allow read, write: if false;',
]
missing = [needle for needle in required if needle not in text]
if missing:
    raise RuntimeError('Critical rule boundary missing: ' + repr(missing))

for forbidden in ['backgroundCheckApprovals', 'commandBackgroundChecks', 'backgroundCheckReviewQueue']:
    if forbidden in text:
        raise RuntimeError(f'Forbidden background-check approval surface found: {forbidden}')

RULES.write_text(text, encoding='utf-8')
print(f'Repaired and structurally validated {RULES}: {len(text.encode("utf-8")):,} bytes, {text.count(chr(10)):,} lines')
