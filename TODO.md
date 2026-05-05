# TODO

## Project Definition

- Define the root `.gitignore` matching details used during default file discovery.
- Define the supported UTF-8 and binary detection details for explicitly included files, including file size limits.
- Define include / exclude option syntax. Include options must not re-include `.gitignore`-excluded files or repository-root dot directory files.
- Define the Markdown section structure for `text-bundle-index.md`: summary, parts, skipped files, diagnostics, and extracted markers.
- Define remaining `text-bundle-*.md` metadata details around the fixed `### path` plus backtick code fence format.
- Define the section structure for `text-bundle-prompt.md`.
- Define the exact warning text and chunk metadata for files split because they exceed `--max-chars`.

## Initial Implementation

- Add more fixture coverage for `.gitignore` edge cases.
- Add package metadata tests after the repository URL and publication policy are confirmed.
- Consider adding `npm run pack:check` to regular verification.
