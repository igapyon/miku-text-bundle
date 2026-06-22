# Release Notes: v1.2.0

`v1.2.0` は、Text Bundle の Part 本文でファイル境界を読み取りやすくする minor release です。

## Changes

- Part 本文内の 2 つ目以降のファイルチャンク直前に Markdown horizontal rule `---` を出力するようにしました。
- 複数ファイルを含む Part で、前ファイルの code fence 終了位置と次ファイル見出し `### path/to/file` の境界を視認しやすくしました。
- 出力ファイルを書き込まずに収集数、スキップ数、無視数、推定 Part 数を確認する `--dry-run` を追加しました。
- package version と CLI `--version` を `1.2.0` に更新しました。
