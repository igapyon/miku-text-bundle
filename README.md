# miku-text-bundle

`miku-text-bundle` は、指定ディレクトリ以下のテキストファイルを収集し、生成AIに渡しやすい分割 Markdown バンドルとして出力する CLI ツールです。

リポジトリ全体の概要、主要なソース、TODO、テストなどを、ファイル境界を保ったまま Markdown にまとめます。大きな入力は複数の Part に分け、貼り付け順を案内する prompt ファイルも生成します。

## 使い方

```bash
miku-text-bundle --input <dir> --output <dir>
```

ヘルプとバージョンを確認できます。

```bash
miku-text-bundle --help
miku-text-bundle --version
```

ローカルでビルド済みの CLI を直接実行する場合は次のように使います。

```bash
node dist/main.js --input . --output out --max-chars 120000
```

`--input` と `--output` は必須です。出力先の自動生成は行いません。

CLI の詳細は [[miku-text-bundle] CLI リファレンス](https://qiita.com/igapyon/items/c67f37ffe4d0fd1eed9d) を参照してください。

`v0.8.1` の変更点は [docs/release-notes-v0.8.1.md](docs/release-notes-v0.8.1.md) を参照してください。
`v0.5.4` から `v0.8.0` への変更点は [docs/release-notes-v0.8.0.md](docs/release-notes-v0.8.0.md) を参照してください。

## 主なオプション

- `--input <dir>`: 入力ディレクトリを指定する。
- `--output <dir>`: 出力ディレクトリを指定する。
- `--max-chars <number>`: バンドル Part ごとの最大文字数を指定する。デフォルトは `120000`。
- `--max-input-file-bytes <number>`: 単一入力ファイルの最大読み込み bytes を指定する。デフォルトは `1000000`。
- `--encoding utf-8|shift_jis`: 入力ファイルのデフォルト文字コードを指定する。デフォルトは `utf-8`。
- `--encoding-extension ".java=shift_jis"`: 拡張子ごとの文字コードを指定する。カンマ区切りで複数指定できます。
- `--add-exclude-extension ".ext"`: 除外拡張子リストに拡張子を追加する。カンマ区切りで複数指定できます。
- `--remove-exclude-extension ".ext"`: 除外拡張子リストから拡張子を削除する。カンマ区切りで複数指定できます。
- `--add-exclude-directory "dir"`: 除外ディレクトリリストにディレクトリを追加する。カンマ区切りで複数指定できます。
- `--remove-exclude-directory "dir"`: 除外ディレクトリリストからディレクトリを削除する。カンマ区切りで複数指定できます。
- `--verbose`: 収集数、スキップ数、Part 数、無視したファイルの内訳を標準出力に表示する。
- `--help`: ヘルプを表示する。
- `--version`: バージョンを表示する。

通常実行では、完了時に収集数、スキップ数、無視したディレクトリ数、無視したファイル数を表示します。

```text
completed: 3 part(s), 128 file(s) collected, 4 file(s) skipped, 12 directories ignored, 245 file(s) ignored
```

`--verbose` を指定すると、無視したファイル数の内訳も表示します。

```text
ignoredDirectories=12
ignoredFiles=245
ignoredByDirectory=23
ignoredByExtension=180
ignoredByGitignore=42
ignoredByOutputDirectory=0
```

## デフォルト収集範囲

デフォルトでは、入力ディレクトリ配下の通常ファイルを広く収集候補にします。既知のバイナリ拡張子、除外ディレクトリ、`.gitignore` で除外されたファイル、出力ディレクトリ配下のファイルは候補から外します。

既知のバイナリ拡張子に一致したファイルと、除外ディレクトリ配下のファイルは、`text-bundle-000-index.md` の Skipped Files には記録しません。候補に残ったファイルがサイズ上限を超えた場合や、指定文字コードで読めない場合は Skipped Files に理由を記録します。

このツールでは、最初から候補にしないものを ignored、候補に入ったが読み込めなかったものを skipped として扱います。

## 除外ルール

入力ディレクトリ直下の `.gitignore` を読み、収集対象から除外します。

現在の `.gitignore` 判定は、このツールが必要とする範囲に絞った実装です。Git 本体の ignore 仕様と完全互換ではありません。詳細は [docs/gitignore-limitations.md](docs/gitignore-limitations.md) を参照してください。

デフォルト除外ディレクトリは次の通りです。

```text
.codex
.git
.idea
.vscode
build
coverage
dist
node_modules
target
temp
tmp
workplace
```

デフォルト除外拡張子は次の通りです。

```text
.7z .aac .avi .bmp .bz2 .class .db .dll .doc .docx .dylib .exe
.flac .gif .gz .ico .jar .jpeg .jpg .m4a .mkv .mov .mp3 .mp4
.ogg .otf .parquet .pdf .png .ppt .pptx .rar .so .sqlite .svgz
.tar .tgz .tiff .ttf .war .wav .webm .webp .woff .woff2 .xls
.xlsx .xz .zip
```

除外リストは CLI オプションで調整できます。

```bash
miku-text-bundle --input . --output out --add-exclude-extension ".wasm,.bin"
miku-text-bundle --input . --output out --remove-exclude-extension ".pdf"
miku-text-bundle --input . --output out --add-exclude-directory "generated"
miku-text-bundle --input . --output out --remove-exclude-directory "dist"
```

## 入力ファイルの扱い

入力文字コードのデフォルトは UTF-8 です。`--encoding shift_jis` を指定すると、収集対象ファイルをデフォルトで Shift_JIS として読みます。

拡張子ごとに文字コードを変える場合は、`--encoding-extension` を使います。拡張子ルールはデフォルト文字コードより優先されます。

```bash
miku-text-bundle --input . --output out --encoding utf-8 --encoding-extension ".java=shift_jis,.properties=shift_jis"
```

対応する文字コードは `utf-8` と `shift_jis` です。文字コードの自動判定は行いません。指定された文字コードとして読めないファイル、またはバイナリと判定したファイルはスキップし、`text-bundle-000-index.md` に理由を記録します。

単一入力ファイルのデフォルト読み込み上限は `1000000` bytes です。上限を超えるファイルは読み込まずにスキップし、`text-bundle-000-index.md` に理由を記録します。上限は `--max-input-file-bytes` で変更できます。

## 出力ファイル

出力先には次の Markdown ファイルを生成します。

- `text-bundle-000-index.md`
- `text-bundle-001.md`, `text-bundle-002.md` 以降の分割 Markdown ファイル
- `text-bundle-000-prompt.md`

`text-bundle-000-index.md` には、出力概要、Part 一覧、スキップされたファイル、警告、抽出した `TODO` / `FIXME` / `XXX` マーカーを記録します。

`text-bundle-*.md` には、収集したファイルを `### path/to/file.ts` のような見出しで区切り、本文を backtick code fence で記録します。

`text-bundle-000-prompt.md` には、複数メッセージで生成AIへ貼り付けるための順序、受領手順、完了合図 `END_OF_TEXT_BUNDLE`、回答ファイル名 `text-bundle-response.md`、回答形式を記録します。

## 分割方針

基本的には、ファイル途中では分割せず、ファイル単位で Part に割り当てます。

ただし、単一ファイルだけで `--max-chars` を超える場合は例外として行単位で分割します。この場合は、Part 本文と index の両方に分割したことを警告として記録します。

## 開発

依存関係をインストールします。

```bash
npm install
```

ビルド、テスト、package dry-run、bundle smoke を実行します。

```bash
npm run build
```

依存関係の audit を実行します。

```bash
npm audit --audit-level=moderate
```

実リポジトリ入力で確認する場合は、次のコマンドで生成物を作成し、`out/` を確認します。

```bash
node dist/main.js --input . --output out --max-chars 5000
```

## Release assets

ビルド時に GitHub Release 用の CLI bundle と source archive を生成します。

```text
bundle/miku-text-bundle.mjs
bundle/miku-text-bundle-sources.tgz
```

`v*` GitHub Release では、Release asset workflow がこれらを tag version 付きの asset 名にコピーして添付します。`package.json` の version と一致する tag に加えて、`v0.5.0.1` のような dot suffix 付き tag も同じ package version 系列として扱います。

## リポジトリ運用

`workplace/` は `workplace/.gitkeep` を除いて Git 管理対象外にします。参照リポジトリ、展開したアーカイブ、生成ファイル、検証成果物などのローカル専用作業領域として使います。

ローカルの VS Code 設定である `.vscode/`、ローカル Codex 設定である `.codex/`、Node.js やその他言語の生成物は Git 管理対象外にします。

## 設計メモ

開発者向けの設計メモや miku-soft 関連文書は `docs/` に置いています。プロジェクト固有の位置づけは [docs/project-design.md](docs/project-design.md) を参照してください。
