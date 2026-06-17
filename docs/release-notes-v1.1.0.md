# Release Notes: v1.1.0

`v1.1.0` は、Text Bundle の生成ファイル数を減らす minor release です。

## Changes

- 独立した `text-bundle-000-prompt.md` と `text-bundle-999-index.md` を生成せず、Part ファイルだけを生成する形式に変更しました。
- 先頭 Part に prompt セクションを同梱し、最終 Part に index セクションを同梱するようにしました。
- 生成ファイルの上限を `text-bundle-001.md` から `text-bundle-999.md` までに変更しました。
- prompt / index の同梱分を `--max-chars` の分割計算で予約枠として扱い、安全マージンを持たせました。
- README、CLI `--help`、テスト、bundle smoke を compact 出力形式に更新しました。
- package version と CLI `--version` を `1.1.0` に更新しました。
