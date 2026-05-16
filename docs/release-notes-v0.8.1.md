# Release Notes: v0.8.1

`v0.8.1` は、Node.js CLI runtime artifact の entrypoint 判定を改善するバグ修正リリースです。

## Fixes

- Node.js 版 runtime を symlink path 経由で実行した場合でも、同一実ファイルを指していれば CLI として起動するようにしました。
- macOS の `/tmp` と `/private/tmp` のように、同一ファイルへの path 表現が異なる場合でも `--help` や `--version` が表示されます。

## Tests

- `dist/main.js` を symlink path 経由で起動する回帰テストを追加しました。
- single-file CLI bundle の smoke test に symlink path 経由の `--help` / `--version` 確認を追加しました。
