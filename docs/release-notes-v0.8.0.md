# Release Notes: v0.8.0

`v0.8.0` は、`v0.5.4` から CLI の使い方とデフォルト収集仕様を大きく見直したリリースです。

## Breaking Changes

- 位置引数による入力・出力指定を廃止しました。
  - 廃止: `miku-text-bundle <inputDir> [outputDir]`
  - 新仕様: `miku-text-bundle --input <dir> --output <dir>`
- 出力ディレクトリの省略を廃止しました。
  - `--output` は必須です。
  - `workplace/miku-text-bundle/<yyyyMMddHHmm>/` への自動出力は行いません。
- `--input-directory` と `--output-directory` を廃止しました。
  - 新仕様では `--input` と `--output` を使います。
- `--include` と `--exclude` を廃止しました。
  - デフォルト収集範囲を広げ、除外リストを操作する設計に変更しました。
- 短縮オプション `-h` と `-v` を廃止しました。
  - ヘルプは `--help`、バージョン表示は `--version` を使います。

## CLI

基本形は次の通りです。

```bash
miku-text-bundle --input <dir> --output <dir>
```

主なオプションは次の通りです。

```text
--input <dir>
--output <dir>
--max-chars <number>
--max-input-file-bytes <number>
--encoding utf-8|shift_jis
--encoding-extension ".java=shift_jis"
--add-exclude-extension ".ext"
--remove-exclude-extension ".ext"
--add-exclude-directory "dir"
--remove-exclude-directory "dir"
--verbose
--help
--version
```

## Default Collection

`v0.5.4` では、デフォルト収集対象は `README.md`、`TODO.md`、`src/`、`lib/`、`app/`、`test/`、`tests/` 配下の主要ソースファイルに限定していました。

`v0.8.0` では、入力ディレクトリ配下の通常ファイルを広く収集候補にします。そのうえで、次のものを候補から外します。

- 既知のバイナリ拡張子に一致するファイル
- デフォルト除外ディレクトリ配下のファイル
- 入力ディレクトリ直下の `.gitignore` で除外されるファイル
- `--output` で指定した出力ディレクトリ配下のファイル

候補に入ったファイルがサイズ上限を超えた場合や、指定文字コードで読めない場合は、従来通り `text-bundle-000-index.md` の Skipped Files に理由を記録します。

## Exclude Lists

除外拡張子リストを操作するオプションを追加しました。

```bash
miku-text-bundle --input . --output out --add-exclude-extension ".wasm,.bin"
miku-text-bundle --input . --output out --remove-exclude-extension ".pdf"
```

除外ディレクトリリストを操作するオプションを追加しました。

```bash
miku-text-bundle --input . --output out --add-exclude-directory "generated"
miku-text-bundle --input . --output out --remove-exclude-directory "dist"
```

## Documentation And Tests

- README を新しい CLI 仕様に更新しました。
- `.gitignore` 制限ドキュメントを新しい除外仕様に合わせて更新しました。
- 完了メッセージに skipped / ignored の合計を表示し、`--verbose` で ignored の内訳を表示するようにしました。
- CLI パーサ、サブプロセス実行、バンドル生成、package dry-run、bundle smoke のテストを新仕様に合わせて更新しました。
- パッケージバージョンと CLI バージョンを `0.8.0` に更新しました。
