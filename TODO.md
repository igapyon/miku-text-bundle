# TODO

## Current Status

- Initial Node.js / TypeScript CLI implementation is in place.
- `npm run build` currently runs TypeScript build, Vitest tests, and `npm pack --dry-run`.
- `npm audit --audit-level=moderate` currently reports `0 vulnerabilities`.
- CLI subprocess smoke test covers `dist/main.js` bundle generation.
- `README.md` documents the current CLI behavior and `.gitignore` limitation.

## Next Tasks

- Add explicit file size limit handling for very large files, especially files pulled in by `--include`.
- Add tests for the exact `text-bundle-index.md` Markdown section structure:
  - summary
  - parts
  - skipped files
  - warnings
  - extracted markers
- Add tests for the exact `text-bundle-prompt.md` section structure:
  - reading order
  - response format
  - expected `text-bundle-response.md` file name
- Add tests for `text-bundle-*.md` metadata details around the fixed `### path` plus backtick code fence format.
- Add package dry-run content assertions if the npm publication contents need to be locked down beyond the current package metadata tests.
- Decide whether `.gitignore` limitations need a dedicated `docs/` note or whether the README note is enough.

## Verification Commands

```bash
npm run build
npm audit --audit-level=moderate
node dist/main.js . --max-chars 5000
```

## Implementation Notes

- The code intentionally reads only the repository-root `.gitignore`.
- Include patterns must not restore `.gitignore`-excluded files or repository-root dot directory files.
- `workplace/` output is ignored by Git except for `workplace/.gitkeep`.
- `npm pack --dry-run` uses `workplace/.npm-cache` through the `pack:check` script to avoid local npm cache permission issues.
