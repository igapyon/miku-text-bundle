# .gitignore Limitations

`miku-text-bundle` uses a small `.gitignore` matcher for initial repository file discovery.

The matcher intentionally covers only the scope needed by the current CLI behavior. It is not a complete implementation of Git's ignore engine.

## Supported Scope

- Reads only the `.gitignore` file at the input directory root.
- Supports basic file, directory, root-anchored, and glob patterns used by the current tests.
- Applies `.gitignore` exclusions before include patterns.
- Keeps repository-root dot directories excluded even when include patterns match them.

## Current Limitations

- Does not read `.gitignore` files in subdirectories.
- Does not support negated patterns such as `!file.txt`.
- Does not aim for full compatibility with every Git ignore edge case.
- Does not let include patterns restore files excluded by `.gitignore` or repository-root dot directory rules.

If a future workflow needs exact Git compatibility, replace or extend the matcher in the product core and add fixture-based regression tests before changing the documented behavior.
