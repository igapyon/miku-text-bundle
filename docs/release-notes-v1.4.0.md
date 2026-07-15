# Release Notes: v1.4.0

`v1.4.0` は、Markdown Part の分割方針を用途に合わせて見直す minor release です。

## Changes

- CLI / package version を `1.4.0` に更新しました。
- `--max-chars` のデフォルト値が `120000` であることを明記しました。
- 生成済み Markdown Part の固定文字数上限を撤廃しました。Part の分割は引き続き、`--max-chars` で指定するソース本文文字数の近似上限を基準に行います。

## Compatibility

- CLI のオプション、出力形式、既存の既定値に変更はありません。
- `--max-chars` を超える実際の Markdown Part が生成される場合があります。生成先に文字数制限がある場合は、小さめの `--max-chars` を指定して生成結果を確認してください。
