# TODO

## Current Status

- Initial Node.js / TypeScript CLI implementation is functionally in place.
- The project is in late-stage hardening before the first practical release.
- `npm run build` currently runs TypeScript build, CLI bundle generation, Vitest tests, `npm pack --dry-run`, and bundle smoke testing.
- `npm audit --audit-level=moderate` currently reports `0 vulnerabilities`.
- GitHub Actions release asset workflow attaches the CLI bundle and source archive to `v*` GitHub Releases after checking the tag version against `package.json`.
- CLI subprocess smoke test covers `dist/main.js` bundle generation.
- `README.md` documents the current CLI behavior and `.gitignore` limitation.
- Large input files over `--max-input-file-bytes` are skipped before UTF-8 decoding and recorded in `text-bundle-999-index.md`.
- Tests cover the stable Markdown section structure for index, prompt, and part files.
- CLI subprocess tests cover successful bundle generation, `--max-input-file-bytes`, and failure paths for invalid input directory and unknown options.
- Package dry-run tests assert that npm publication contents are limited to runtime files and docs.
- CLI bundle smoke test covers `bundle/miku-text-bundle.mjs` bundle generation.
- `.gitignore` matcher limitations are documented in `docs/gitignore-limitations.md`.
- Golden output tests cover representative `text-bundle-999-index.md`, `text-bundle-000-prompt.md`, and `text-bundle-*.md` Markdown.
- `text-bundle-000-prompt.md` supports a generic multi-message paste workflow with `受領しました` acknowledgements and `text-bundle-999-index.md` as the terminal file.
- `--filename-prefix` can replace the generated Markdown file basename prefix while preserving the default `text-bundle` names when omitted.

## Next Tasks

- Review generated `text-bundle-999-index.md`, `text-bundle-000-prompt.md`, and `text-bundle-*.md` from real repository input.
- Decide whether any output wording, prompt wording, default limits, or package metadata need adjustment before the first release.
- Keep `TODO.md` itself in the default bundle input. Marker extraction ignores filename references such as `TODO.md`.
- Confirm the npm package dry-run contents and GitHub Release bundle assets are limited to intended runtime files and docs.
- After final verification, create a `v*` GitHub Release for the first release.

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
