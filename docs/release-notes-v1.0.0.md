# Release Notes: v1.0.0

`v1.0.0` は、複数 Text Bundle を扱う生成AI agent の実運用を意識して、生成ファイル名と CLI help contract を強化したリリースです。

## Highlights

- `--filename-prefix <prefix>` を追加しました。
- 未指定時の生成ファイル名は従来どおり `text-bundle-000-prompt.md`、`text-bundle-001.md`、`text-bundle-999-index.md` です。
- prefix 指定時は、prompt、part、index の実ファイル名と prompt 内の読み込み順、index の Parts 表が指定 prefix を反映します。
- `--help` を生成AI agent やスクリプトが安全に実行判断しやすい runtime contract として拡充しました。
- package version と CLI `--version` を `1.0.0` に更新しました。

## filename prefix

次のように指定できます。

```bash
miku-text-bundle --input skills/igapyon-skill-compactor --output workplace/text-bundle-dist --filename-prefix igapyon-skill-compactor-text-bundle
```

この場合、生成ファイル名は次のようになります。

```text
igapyon-skill-compactor-text-bundle-000-prompt.md
igapyon-skill-compactor-text-bundle-001.md
igapyon-skill-compactor-text-bundle-999-index.md
```

prefix は前後の空白を trim したうえで、ASCII letters、digits、`.`、`_`、`-` のみを許可します。空文字、パス区切り、改行、制御文字などはエラーになります。

## Help Contract

`--help` は単なる option list ではなく、短い runtime contract として次を表示します。

- 必須引数と既定値
- 入力ファイルの扱いと主な除外
- 生成される Markdown artifact
- 既存生成ファイルの上書き挙動
- stdout / stderr の扱い
- diagnostics と exit code
- 安全に実行できる例

通常実行の stdout は進捗・完了テキストであり、安定した machine-readable API ではありません。安定した生成AI handoff artifact は、出力ディレクトリに生成される Markdown ファイルです。

## Verification

- `npm run build`
- Vitest tests
- `npm pack --dry-run`
- single-file CLI bundle smoke test
