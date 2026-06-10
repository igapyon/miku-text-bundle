# Release Notes: v1.0.1

`v1.0.1` は、生成AI Web UI へ Text Bundle を渡す際の `000-prompt` 運用説明を明確にした patch release です。

## Changes

- `text-bundle-000-prompt.md` は、Web UI では最初のメッセージ本文として貼り付ける運用を推奨する、と README に追記しました。
- CLI `--help` に、`<prefix>-000-prompt.md` の本文貼り付けは推奨であり必須ではないことを短く追記しました。
- 入力に `SKILL.md` または `skills/<skill-name>/SKILL.md` が含まれる場合、`text-bundle-999-index.md` に Agent Skill handoff 指示を自動追加するようにしました。
- 生成する Markdown ファイルに、`tool`、`version`、`role` を示す短い YAML front matter を追加しました。
- Java 版と揃えやすいように、`--help` の表示契約を更新しました。
- package version と CLI `--version` を `1.0.1` に更新しました。
