# Frozen visual implementations

These six files preserve the pre-consolidation presentation behavior. Compatibility exceptions replace the parser's custom `createRequire` lookup with standard imports in `recessed-tools.ts` (so Pi's standalone extension loader resolves dependencies), and import `Type` directly from the host-provided `typebox` in `stable-input-layout.ts` (Pi 1.5.2 no longer re-exports it from `pi-ai`). Neither changes presentation behavior. Do not add features here or install these files directly. The deprecated entry points in `../extensions/` wrap them with deprecation notices and a mutual-exclusion guard.

New presentation work belongs in `../lib/ui/`, coordinated by `../extensions/ui.ts`. `session-rename` remains independent. See `../extensions/README.md` for migration and rollback instructions.
