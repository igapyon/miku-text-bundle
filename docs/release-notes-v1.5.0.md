# Release Notes: v1.5.0

`v1.5.0` adds a Knowledge source Markdown output mode while preserving the existing generative-AI handoff workflow as the default.

## Changes

- Added `--mode handoff|knowledge-source`; omitted mode remains `handoff`.
- Added neutral numbered Knowledge source Markdown files without prompt, acknowledgement, terminal, Agent Skill Handoff, or diagnostic sections.
- Added a separate `<prefix>-index.md` management index for configuration, source mapping, skipped files, warnings, markers, and stale output candidates.
- Added source chunk line ranges and UTF-16 character offsets for deterministic traceability.
- Added `knowledge` as the mode-specific default filename prefix; explicit `--filename-prefix` continues to override the default.
- Extended `--dry-run`, CLI help, tests, and package documentation for the new mode.

Format conversion, registration-target file-size policy, and upload to a Knowledge source service remain caller responsibilities.
