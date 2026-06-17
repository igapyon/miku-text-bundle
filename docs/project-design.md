# miku-text-bundle Project Design Notes

This document records project-internal design positioning that is useful for maintainers but not necessary for general README readers.

## miku-soft Positioning

`miku-text-bundle` is positioned as a miku-soft `10 main application`.

The initial product shape is a Node.js / TypeScript CLI main application.

The product is not a source-code-only analysis tool. It is a repository text bundling tool intended to collect local text files and produce Markdown artifacts for generative AI handoff.

## Product Boundary

The product core should keep the semantics for file discovery, exclusion, decoding, splitting, diagnostics, and Markdown output.

CLI scripts, release workflows, and bundle scripts are entrypoints or packaging surfaces around that core.

## Encoding Policy

Input decoding supports explicit `utf-8` and `shift_jis` selection.

The default encoding is `utf-8`. Extension rules may override the default encoding for files with exact final extensions such as `.java` or `.properties`.

The tool does not perform encoding auto detection. Files that cannot be decoded with the selected encoding, or files detected as binary, are skipped and recorded in the final Part index section.
