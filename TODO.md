# TODO

## Current Status

- Package and CLI version is `1.5.0`.
- Initial Node.js / TypeScript CLI implementation is functionally in place.
- The project is in late-stage hardening before the first practical release.
- `npm run build` currently runs TypeScript build, CLI bundle generation, Vitest tests, `npm pack --dry-run`, and bundle smoke testing.
- `npm audit --audit-level=moderate` currently reports `0 vulnerabilities`.
- GitHub Actions release asset workflow attaches the CLI bundle and source archive to `v*` GitHub Releases after checking the tag version against `package.json`.
- CLI subprocess smoke test covers `dist/main.js` bundle generation.
- `README.md` documents the current CLI behavior and `.gitignore` limitation.
- Large input files over `--max-input-file-bytes` are skipped before UTF-8 decoding and recorded in the final Part index section.
- Tests cover the stable Markdown section structure for index, prompt, and part files.
- CLI subprocess tests cover successful bundle generation, `--max-input-file-bytes`, and failure paths for invalid input directory and unknown options.
- Package dry-run tests assert that npm publication contents are limited to runtime files and docs.
- CLI bundle smoke test covers `bundle/miku-text-bundle.mjs` bundle generation.
- `.gitignore` matcher limitations are documented in `docs/gitignore-limitations.md`.
- Golden output tests cover representative prompt, Part, and index Markdown.
- `text-bundle-001.md` embeds the prompt workflow with `OK` acknowledgements for non-terminal Parts, and the final Part embeds the terminal index.
- Generated Markdown Part has no fixed rendered-character limit; splitting is based on the approximate source-content limit set by `--max-chars`.
- `--filename-prefix` can replace the generated Markdown file basename prefix while preserving the default `text-bundle` names when omitted.
- If the input contains `SKILL.md` or `skills/<skill-name>/SKILL.md`, the final Part index always includes Agent Skill handoff guidance.

## Completed: Knowledge Source Mode for v1.5.0

Implementation and verification completed on 2026-07-16. The detailed contract and checklist below are retained as the maintenance and Node.js/Java parity reference.

### Agreed Scope and Compatibility

- Add `--mode handoff|knowledge-source` and keep `handoff` as the default when `--mode` is omitted.
- Preserve the existing v1.4.0 handoff filenames, Markdown structure, prompt, terminal index, diagnostics, Agent Skill handoff, and defaults.
- Generate Markdown only in `knowledge-source` mode. Conversion to `.docx` or another registration format, including possible use of `miku-md2docx`, is outside this repository's scope.
- Keep registration-target file size limits outside this repository's scope. The caller selects an appropriate `--max-chars` value.
- Keep the current `--max-chars` default of `120000` and continue supporting `--max-input-file-bytes` in both modes.
- Keep `knowledge-source` generic rather than introducing Microsoft 365-specific behavior or naming.

### CLI and Output Contract

- Add strict validation for `--mode handoff|knowledge-source`; reject unknown or missing values with a usage error.
- Document the default mode, generated artifacts, overwrite behavior, diagnostics, and examples in `--help` and `README.md`.
- Use `knowledge` as the default Knowledge source filename prefix, while an explicit `--filename-prefix` overrides it. Track whether the user explicitly supplied the option so changing `--mode` does not accidentally retain the handoff-only `text-bundle` default.
- Generate stable numbered Knowledge source files such as `<prefix>-001.md`, ordered deterministically by normalized POSIX relative path using UTF-16 code unit order.
- Generate a separate management index such as `<prefix>-index.md`; do not treat it as a Knowledge source registration candidate.
- Make `--dry-run` report the mode, planned Knowledge source file count, planned management index, collected/skipped counts, and warnings without writing files.
- Keep stdout as human-readable progress/completion output rather than introducing a machine-readable stdout contract in this change.

### Knowledge Source Markdown

- Do not include the Text Bundle Prompt, reading-order instructions, acknowledgement instructions, terminal instructions, response-file instructions, or Agent Skill Handoff guidance.
- Do not include warnings, skipped-file diagnostics, or extracted `TODO` / `FIXME` / `XXX` marker summaries in Knowledge source files.
- Preserve each source body without summarizing, paraphrasing, or omitting content.
- Include neutral provenance for each source body: normalized relative source path and, when split, chunk number and source line range.
- Preserve source-document boundaries whenever possible. Split only a source document that individually exceeds `--max-chars`, preferring line boundaries before a character-position fallback.
- Do not add YAML front matter to Knowledge source files in the initial implementation. In particular, do not copy handoff-only `prompt` or `terminal` metadata into this mode.
- Embed `.md` source bodies as raw Markdown after the neutral source heading and provenance block so headings and prose remain useful for retrieval. Embed non-Markdown text and source code in a dynamically sized code fence using the existing fence-safety logic. In both cases, keep the source content unchanged inside its container.

### Management Index and Output Safety

- Record the effective major options, collected source list, generated file list, source-to-output/chunk mapping, skipped files and reasons, warnings, and extracted markers in the management index.
- Keep the management index neutral: include metadata and diagnostics only, with no instructions directed at an AI or other processor.
- Avoid timestamps and other run-specific values that would break deterministic output for the same input and settings.
- Always generate the management index in `knowledge-source` mode; do not add an index-disable option in v1.5.0.
- Detect stale numbered files from an earlier run with the same prefix so they are not accidentally registered. Do not delete unrelated files.
- For v1.5.0, warn about stale output without deleting it. Do not add `--clean-output` until a later change can restrict deletion to artifacts recorded by a prior management index.

### Implementation and Verification

- Keep shared discovery, decoding, exclusion, ordering, marker extraction, size checks, and source splitting in the product core.
- Add a dedicated Knowledge source renderer and management-index renderer without changing the handoff renderer's output contract.
- Extend result types so callers can distinguish Knowledge source files from the management index without breaking existing consumers unnecessarily.
- Add CLI parser, help, renderer, bundler, dry-run, subprocess, and package regression tests for both modes.
- Add golden fixtures proving that Knowledge source bodies contain no handoff instructions or diagnostics and that source/chunk provenance is complete.
- Add a regression fixture proving that omitted `--mode` and explicit `--mode handoff` produce the established handoff output.
- Verify byte-for-byte deterministic output across repeated runs with identical input and settings.
- Define shared fixtures for later Node.js/Java parity verification of option names, ordering, splitting, filenames, provenance, and management-index structure. Java implementation remains work in its own repository.
- Add `docs/release-notes-v1.5.0.md`, include it in npm package contents and package tests, and link it from `README.md` when the feature is implemented.

### Concrete Output Contract

For this command:

```bash
miku-text-bundle --input ./repo --output ./out --mode knowledge-source
```

generate:

```text
out/
├── knowledge-001.md
├── knowledge-002.md
└── knowledge-index.md
```

Only the numbered files are Knowledge source candidates. `knowledge-index.md` is a local management and diagnostic artifact.

Use this initial numbered-file structure:

```markdown
# Knowledge Source 001

## Source: docs/example.md

- Source path: `docs/example.md`

<unchanged raw Markdown source body>
```

When a source is split, add neutral provenance without adding a warning to the Knowledge source body:

```markdown
## Source: docs/large.md

- Source path: `docs/large.md`
- Source chunk: 2 / 4
- Source lines: 301-612

<unchanged source chunk body>
```

Use 1-based inclusive line numbers. For a character fallback inside a single oversized line, also retain 0-based, end-exclusive UTF-16 source character offsets in the internal chunk model and management index. This makes Node.js slicing explicit and gives the Java implementation a reproducible parity target.

Separate multiple source bodies with a neutral Markdown thematic break. Do not place warning prose, receipt instructions, or AI behavior text around the separator. An empty collection still generates `knowledge-001.md` with the file title and no fabricated source body, plus `knowledge-index.md` with zero collected files.

The management index should use this stable section order:

```text
# Knowledge Bundle Index
## Configuration
## Summary
## Generated Files
## Source Mapping
## Skipped Files
## Warnings
## Markers
## Stale Output Candidates
```

In `Configuration`, record effective values rather than only explicitly supplied arguments. Sort extension maps and exclusion lists with the same UTF-16 comparator used elsewhere. Do not record the execution time. In `Source Mapping`, emit one row per source chunk with source path, generated filename, chunk number/count, line range, optional character range, and source/content character counts.

### Source Files and Change Map

Implement the change in this order so handoff behavior remains available throughout development:

1. `src/types.ts`
   - Add `BundleMode = "handoff" | "knowledge-source"`.
   - Add `mode` to `CliOptions` with `handoff` as the parsed default.
   - Extend `BundleChunk` with source line-range fields and optional UTF-16 character offsets used by split chunks.
   - Add additive result fields such as `mode`, `knowledgeSourcePaths`, and `managementIndexPath`; retain the existing `partPaths`, `promptPath`, and `indexPath` fields so v1.4.0 callers continue to compile.
   - In Knowledge source mode, keep `partPaths` equal to the numbered Knowledge source paths, set `indexPath` to the management index, and keep `promptPath` as a compatibility alias of the first numbered file. Document that no prompt content exists in this mode.

2. `src/cli.ts`
   - Parse `--mode` with an exact allowlist and a clear error such as `--mode must be one of: handoff, knowledge-source.`.
   - Preserve `text-bundle` as the handoff default prefix and choose `knowledge` only when Knowledge source mode is selected and `--filename-prefix` was not explicit.
   - Update `--help` sections for defaults, artifacts, overwrite behavior, diagnostics, dry-run behavior, and examples for both modes.

3. `src/bundler.ts`
   - Reuse collection, decoding, marker extraction, UTF-16 path ordering, and file-level chunking.
   - Refactor only enough to select a renderer/output plan by mode. Do not fork file discovery or encoding rules.
   - Preserve the current handoff prompt/index reserve calculation unchanged.
   - In Knowledge source mode, do not reserve prompt or embedded-index characters because both are absent from numbered files. Continue treating `--max-chars` as an approximate source-content limit rather than an exact rendered-file limit.
   - Compute line and character ranges while splitting instead of trying to reconstruct them in the renderer.
   - Plan the management index separately from numbered parts for both normal execution and `--dry-run`.
   - Detect existing `<prefix>-NNN.md` files not present in the current plan and report them as stale candidates. Exclude `<prefix>-index.md` from that numbered-file check.

4. `src/markdown.ts`
   - Leave `buildPromptMarkdown`, the existing handoff `buildPartMarkdown`, and embedded terminal-index behavior byte-compatible.
   - Add separate functions for Knowledge source numbered Markdown and the management index; do not add mode conditionals throughout existing handoff rendering functions.
   - Reuse escaping, table, language selection, and dynamic fence helpers where safe.
   - Ensure management-index table values escape pipes and newlines consistently.

5. `src/main.ts`
   - Keep the existing completion line for handoff mode.
   - Add clear Knowledge source completion/dry-run wording that distinguishes numbered Knowledge source files from the management index.
   - Continue using exit code `0` for successful generation/help/version and `1` for invalid usage or processing failure.

6. Documentation and packaging
   - Update `README.md` with mode selection, exact artifact roles, examples, provenance, index exclusion from registration, caller-controlled `--max-chars`, and the scope boundary around format conversion and registration-target limits.
   - Add `docs/release-notes-v1.5.0.md` and include it in `package.json` `files`.
   - Update package-content expectations in `test/package.test.ts`.
   - Do not add a dependency on `miku-md2docx` or mention it as a required runtime component.

### Required Tests

- `test/cli.test.ts`
  - omitted mode defaults to `handoff`
  - both supported explicit modes parse
  - missing and unknown mode values fail
  - mode-dependent default prefixes and explicit prefix override work
  - help describes both artifact sets and their roles
- `test/markdown.test.ts`
  - Knowledge source Markdown has stable golden output
  - raw Markdown body remains unchanged
  - non-Markdown body uses a collision-safe fence
  - split provenance uses correct chunk, line, and optional character ranges
  - management index has the specified section order and escaped tables
  - no Knowledge source file contains prompt, acknowledgement, terminal, Agent Skill Handoff, skipped-file, warning, or marker sections
- `test/bundler.test.ts`
  - handoff default output remains unchanged
  - explicit handoff equals omitted mode
  - Knowledge source numbering and mapping are deterministic
  - ordinary files are not split merely to isolate documents; boundaries are retained until packing requires a new numbered file
  - a single oversized source splits deterministically on line boundaries
  - a single oversized line uses deterministic UTF-16 character fallback
  - management diagnostics are absent from numbered files and present in the index
  - empty input, custom prefix, 999-part limit, dry-run, and stale-output warning behavior are covered
- `test/cli-subprocess.test.ts`
  - real CLI generation succeeds in both modes
  - `--dry-run --mode knowledge-source` writes no directory or file
  - `--version` remains `1.5.0`
- `test/package.test.ts`
  - the v1.5.0 release note is included and no unintended runtime files are packed

### Execution and Completion Checklist

Run focused tests while implementing, then finish with:

```bash
npm test
npm run build
npm audit --audit-level=moderate
node dist/main.js --input . --output workplace/knowledge-source-check --mode knowledge-source --max-chars 5000
```

Manually inspect all numbered files in `workplace/knowledge-source-check/` for instruction or diagnostic leakage, and inspect the management index for complete mappings. Run the same generation twice into clean comparison directories and compare filenames and bytes. Before completion, run `git diff --check`, review `git diff`, and run `git status --short`. Do not commit generated `dist/`, `bundle/`, `workplace/`, or npm cache artifacts.

## Next Tasks

- Review generated `text-bundle-*.md` from real repository input.
- Decide whether any output wording, prompt wording, default limits, or package metadata need adjustment before the first release.
- Keep `TODO.md` itself in the default bundle input. Marker extraction ignores filename references such as `TODO.md`.
- Confirm the npm package dry-run contents and GitHub Release bundle assets are limited to intended runtime files and docs.
- After final verification, create a `v*` GitHub Release for the first release.
- Future consideration: add an explicit Agent Skill detection override such as `--skill-mode auto|on|off`. For the current version, detection is automatic and not user-configurable.

## Verification Commands

```bash
npm run build
npm audit --audit-level=moderate
node dist/main.js --input . --output out --max-chars 5000
```

Use the generated output directory as the human review artifact for the final check.

## Implementation Notes

- The code intentionally reads only the repository-root `.gitignore`.
- The CLI requires `--input` and `--output`; positional input/output arguments are not supported.
- Default binary extension and directory exclusion lists can be adjusted with `--add-exclude-*` and `--remove-exclude-*` options.
- The default single input file limit is 1,000,000 bytes and can be changed with `--max-input-file-bytes`.
- The generated filename prefix defaults to `text-bundle`; custom prefixes are trimmed and limited to ASCII letters, digits, `.`, `_`, and `-`.
- `workplace/` output is ignored by Git except for `workplace/.gitkeep`.
- `npm pack --dry-run` uses `workplace/.npm-cache` through the `pack:check` script to avoid local npm cache permission issues.
