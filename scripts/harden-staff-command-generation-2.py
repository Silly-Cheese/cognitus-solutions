from pathlib import Path

RULES = Path("firestore.rules")
rules = RULES.read_text(encoding="utf-8")

old = """    function commandG2CanManageTicket(departmentId) {
      return isOwner()
        || staffPermission('tickets.all.read')
        || (staffPermission('tickets.manage') && currentStaff().departmentId == departmentId);
    }
"""
new = """    function commandG2CanManageTicket(departmentId) {
      return isOwner()
        || (staffPermission('tickets.manage') && currentStaff().departmentId == departmentId);
    }
"""

if old in rules:
    rules = rules.replace(old, new, 1)
elif new not in rules:
    raise RuntimeError("Could not locate the Generation 2 ticket-management helper.")

if "function commandG2CanManageTicket(departmentId)" not in rules:
    raise RuntimeError("Generation 2 ticket helper is missing.")

helper = rules.split("function commandG2CanManageTicket(departmentId)", 1)[1].split("}", 1)[0]
if "tickets.all.read" in helper:
    raise RuntimeError("Read-all ticket permission still grants write authority.")

RULES.write_text(rules, encoding="utf-8")
print("Hardened Cognitus Staff / Command Generation 2 Firestore ticket authority.")
