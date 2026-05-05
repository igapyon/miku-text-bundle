# TODO

## Project Definition

- Select one or more reference miku-soft main applications for Node.js / TypeScript CLI repository shape.
- Define the root `.gitignore` matching details used during default file discovery.
- Define the supported UTF-8 and binary detection details for explicitly included files, including file size limits.
- Define include / exclude option syntax. Include options must not re-include `.gitignore`-excluded files or repository-root dot directory files.
- Define the Markdown section structure for `text-bundle-index.md`: summary, parts, skipped files, diagnostics, and extracted markers.
- Define remaining `text-bundle-*.md` metadata details around the fixed `### path` plus backtick code fence format.
- Define the section structure for `text-bundle-prompt.md`.
- Define the exact warning text and chunk metadata for files split because they exceed `--max-chars`.

## Initial Implementation

- Create the minimal Node.js / TypeScript CLI source layout.
- Implement `miku-text-bundle <inputDir> <outputDir> --max-chars 120000`.
- Implement default output directory creation as `workplace/miku-text-bundle/<yyyyMMddHHmm>/` when `<outputDir>` is omitted.
- Add `-1`, `-2`, and later suffixes when the default output directory already exists for the same minute.
- Discover `README.md`, `TODO.md`, and default source files from the input repository root.
- Exclude repository-root dot directories during default file discovery.
- Respect only the repository-root `.gitignore` in the initial discovery path.
- Skip non-UTF-8 and binary files, and record warnings in `text-bundle-index.md`.
- Generate `text-bundle-index.md` and numbered `text-bundle-*.md` parts.
- Generate a static Markdown prompt file under the output directory for generative AI handoff.
- Include Part reading order, response format, and `text-bundle-response.md` as the expected response file in `text-bundle-prompt.md`.
- Split a single oversized file by line only when it exceeds `--max-chars`, and write split warnings outside Markdown code fences.
- Extract `TODO`, `FIXME`, and `XXX` markers with file path and line number.
- Add focused tests or smoke commands once executable behavior exists.
- Update README with actual usage, build, and verification commands.
