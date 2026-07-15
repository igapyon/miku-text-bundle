# Release Notes: v1.3.0

`v1.3.0` は、実運用で見つかった Text Bundle Part の文字数超過と読み込み応答を改善する minor release です。

> Note: このリリースで追加した `128000` 文字の実用上限は、v1.4.0 で撤廃されました。現行の分割仕様は [v1.4.0 のリリースノート](release-notes-v1.4.0.md) と README を参照してください。

## Changes

- 生成済み Markdown の実文字数を確認し、各 Part が実用上限の `128000` 文字を超えそうな場合は chunk を次 Part に送るようにしました。
- 多数の小さいファイルによる見出し、fence、metadata、index、prompt のオーバーヘッドも分割判定に含めるようにしました。
- final terminal Part 以外の Part 末尾に、分析を抑制して `OK` のみ返すための acknowledgement footer を追加しました。
- CLI / package version を `1.3.0` に更新しました。

## Verification

- `npm run build`
