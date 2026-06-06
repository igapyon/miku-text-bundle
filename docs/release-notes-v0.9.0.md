# Release Notes: v0.9.0

`v0.9.0` は、Text Bundle の読み込み順と終端仕様を見直したリリースです。

## Changes

- Index file name を `text-bundle-000-index.md` から `text-bundle-999-index.md` に変更しました。
- `text-bundle-999-index.md` を最後に読む終端ファイルとして扱うようにしました。
- Prompt の読み込み順を `text-bundle-000-prompt.md`、分割 Markdown ファイル、`text-bundle-999-index.md` に変更しました。
- `END_OF_TEXT_BUNDLE` の送信手順を廃止しました。
- `text-bundle-999-index.md` を予約名とし、分割 Markdown ファイルの上限を `text-bundle-998.md` までにしました。
- バンドル内の入力ファイル順を、POSIX 相対パスの UTF-16 code unit 昇順として明確化しました。

## Tests

- Prompt の読み込み順と終端ファイル仕様の golden test を更新しました。
- `text-bundle-999-index.md` が予約名として扱われる回帰テストを追加しました。
- UTF-16 code unit 順のファイル並びを確認する回帰テストを追加しました。
- CLI subprocess test と single-file CLI bundle smoke test を `text-bundle-999-index.md` 仕様に更新しました。
