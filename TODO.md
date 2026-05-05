# TODO

## Current Status

- Initial Node.js / TypeScript CLI implementation is in place.
- `npm run build` currently runs TypeScript build, Vitest tests, and `npm pack --dry-run`.
- `npm audit --audit-level=moderate` currently reports `0 vulnerabilities`.
- CLI subprocess smoke test covers `dist/main.js` bundle generation.
- `README.md` documents the current CLI behavior and `.gitignore` limitation.
- Large input files over `--max-input-file-bytes` are skipped before UTF-8 decoding and recorded in `text-bundle-index.md`.
- Tests cover the stable Markdown section structure for index, prompt, and part files.
- CLI subprocess tests cover successful bundle generation, `--max-input-file-bytes`, and failure paths for invalid input directory and unknown options.
- Package dry-run tests assert that npm publication contents are limited to runtime files and docs.
- `.gitignore` matcher limitations are documented in `docs/gitignore-limitations.md`.
- Golden output tests cover representative `text-bundle-index.md`, `text-bundle-prompt.md`, and `text-bundle-*.md` Markdown.
- `text-bundle-prompt.md` supports a generic multi-message paste workflow with `受領しました` acknowledgements and `END_OF_TEXT_BUNDLE`.

## Next Tasks

- Gather initial CLI usage feedback and decide whether any output wording or default limits need adjustment.

## Verification Commands

```bash
npm run build
npm audit --audit-level=moderate
node dist/main.js . --max-chars 5000
```

## Implementation Notes

- The code intentionally reads only the repository-root `.gitignore`.
- Include patterns must not restore `.gitignore`-excluded files or repository-root dot directory files.
- The default single input file limit is 1,000,000 bytes and can be changed with `--max-input-file-bytes`.
- `workplace/` output is ignored by Git except for `workplace/.gitkeep`.
- `npm pack --dry-run` uses `workplace/.npm-cache` through the `pack:check` script to avoid local npm cache permission issues.
