# Release Notes: v1.6.0

`v1.6.0` makes bundled file contents more explicit for Agent Builder and other generative-AI consumers. This release intentionally changes the stable Markdown file-block contract in both output modes; consumers that parse earlier headings or provenance lines must migrate to the new format described below.

## Changes

- Added a searchable `### FILE: <path>` Markdown heading before every collected file or split chunk. `rg '^### FILE:'` finds candidate headings, while exact enumeration remains the responsibility of the handoff terminal index or Knowledge source management index because source bodies and split chunks may produce duplicate matches.
- Added matching `--- BEGIN FILE: <path> ---` and `--- END FILE: <path> ---` boundaries around every collected file or split chunk.
- Added `Source code block` or `Source text block` before each file body.
- Added a human-readable language name such as `Language: JavaScript` while retaining concise Markdown fence identifiers such as `js`.
- Expanded language mapping for common programming, markup, configuration, and structured-text extensions. Unknown extensions use `Source content block` and `Language: Unknown` instead of being mislabeled as plain text.
- Applied the same file block contract to both `handoff` and `knowledge-source` modes.
- Enclosed Markdown and plain-text files in tilde fences as source text blocks instead of inserting Markdown bodies without an explicit content label.
- Added chunk number and original source line range to split file blocks.
- Preserved collision-safe fence extension when source content contains three or more consecutive tildes.
- Preserved repeated blank lines and other source-body whitespace in both modes.
- Escaped backslashes and control characters in displayed paths so headings, boundaries, and index cells remain unambiguous single-line records.
- Updated the package and CLI version from `1.5.1` to `1.6.0`.

## Compatibility and migration

- The former handoff heading `### <path>` is replaced by `### FILE: <path>` followed by explicit BEGIN/END boundaries.
- The former handoff `Characters`, `Source characters`, `Source lines`, split-warning prose, and thematic separators are no longer part of each rendered file block. Exact source/chunk mapping remains available in the terminal index and internal result model.
- The former Knowledge source `## Source:`, `Source path`, and `Source chunk` provenance block is replaced by the shared FILE/BEGIN/END contract and `Chunk:` metadata.
- Markdown source bodies are now tilde-fenced `Source text block` content instead of raw Markdown document sections.
- Consumers should locate file blocks by the new heading and boundaries, and use the appropriate index rather than treating `rg` matches as a collision-free manifest.

The prompt, acknowledgement, terminal index, Agent Skill handoff, and separate Knowledge source management index continue to follow their existing mode-specific workflows.
