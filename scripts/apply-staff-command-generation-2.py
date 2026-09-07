from pathlib import Path
from urllib.request import urlopen

RULES_PATH = Path("firestore.rules")
FRAGMENT_URL = "https://raw.githubusercontent.com/Silly-Cheese/staff-cognitus/1605de46d7d92976e6132846b7b1b2afb22d6baa/firestore.command.g2.rules.fragment"
BEGIN = "// COMMAND_GENERATION_2_BEGIN"
END = "// COMMAND_GENERATION_2_END"
ANCHOR = "    // ============================================================\n    // FINAL DEFAULT-DENY BOUNDARY"

rules = RULES_PATH.read_text(encoding="utf-8")

if BEGIN in rules:
    print("Generation 2 Command rules are already integrated.")
    raise SystemExit(0)

with urlopen(FRAGMENT_URL, timeout=30) as response:
    fragment = response.read().decode("utf-8")

start = fragment.index(BEGIN)
end = fragment.index(END, start) + len(END)
block = fragment[start:end].strip()
block = "\n".join(("    " + line) if line else "" for line in block.splitlines())

if ANCHOR not in rules:
    raise RuntimeError("Could not locate the final default-deny boundary in firestore.rules")

rules = rules.replace(ANCHOR, f"{block}\n\n{ANCHOR}", 1)
RULES_PATH.write_text(rules, encoding="utf-8")
print("Integrated Cognitus Staff / Command Generation 2 Firestore rules.")
