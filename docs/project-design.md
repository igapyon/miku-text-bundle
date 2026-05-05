# miku-text-bundle Project Design Notes

This document records project-internal design positioning that is useful for maintainers but not necessary for general README readers.

## miku-soft Positioning

`miku-text-bundle` is positioned as a miku-soft `10 main application`.

The initial product shape is a Node.js / TypeScript CLI main application.

The product is not a source-code-only analysis tool. It is a repository text bundling tool intended to collect local text files and produce Markdown artifacts for generative AI handoff.

## Product Boundary

The product core should keep the semantics for file discovery, exclusion, decoding, splitting, diagnostics, and Markdown output.

CLI scripts, release workflows, and bundle scripts are entrypoints or packaging surfaces around that core.
