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

## Agent-Readable File Block Contract

Both `handoff` and `knowledge-source` outputs use the same file block renderer. Each collected file or split chunk starts with a searchable Markdown heading in the form `### FILE: <path>` and is enclosed by matching `--- BEGIN FILE: <path> ---` and `--- END FILE: <path> ---` markers using its normalized POSIX relative path. The stable heading prefix lets agents and scripts find candidate headings with searches such as `rg '^### FILE:'`; it is not a collision-free manifest because source bodies may contain the same line and split files repeat the same path. Exact enumeration uses the handoff terminal index or Knowledge source management index.

The block identifies known content as `Source code block` or `Source text block`, provides a human-readable `Language:` value, and encloses the original text in a tilde code fence. Common programming, markup, configuration, and structured-text extensions have explicit mappings. Unknown extensions use the neutral `Source content block` and `Language: Unknown` values. The fence info string remains the concise Markdown language identifier. When the content already contains three or more consecutive tildes, the outer fence is one tilde longer than the longest sequence in the content.

Split chunks additionally include their chunk number and original source line range after the BEGIN marker. Source-body whitespace is preserved; document-level blank-line compaction must not rewrite fenced source content. Backslashes and control characters in display paths are escaped to keep headings, boundaries, and index cells on one line without conflating literal escape text with escaped controls. Workflow-specific prompt, acknowledgement, terminal index, and management-index behavior remains outside this shared file block contract.
