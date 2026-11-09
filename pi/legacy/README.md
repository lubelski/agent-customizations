# Frozen visual implementations

These six files preserve the pre-consolidation implementations byte-for-byte. Do not add features here or install these files directly. The deprecated entry points in `../extensions/` wrap them with deprecation notices and a mutual-exclusion guard.

New presentation work belongs in `../lib/ui/`, coordinated by `../extensions/ui.ts`. `session-rename` remains independent. See `../extensions/README.md` for migration and rollback instructions.
