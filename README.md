# miku-text-bundle

`miku-text-bundle` は、指定ディレクトリ以下のテキストファイルを収集し、生成AIに渡しやすい分割 Markdown バンドルとして出力する CLI ツールです。

リポジトリ全体の概要、主要なソース、TODO、テストなどを、ファイル境界を保ったまま Markdown にまとめます。大きな入力は複数の Part に分け、貼り付け順を案内する prompt ファイルも生成します。

## 使い方

```bash
miku-text-bundle <inputDir> [outputDir] --max-chars 120000 --max-input-file-bytes 1000000
```

ローカルでビルド済みの CLI を直接実行する場合は次のように使います。

```bash
node dist/main.js . --max-chars 120000
```

`outputDir` を省略した場合は、入力ディレクトリ配下の次の場所に出力します。

```text
workplace/miku-text-bundle/<yyyyMMddHHmm>/
```

同じ分に既に同名の出力ディレクトリがある場合は、末尾に `-1`, `-2` のような連番 suffix を付けます。

## 主なオプション

- `--input-directory <dir>`: 入力ディレクトリを名前付きで指定する。
- `--output-directory <dir>`: 出力ディレクトリを名前付きで指定する。
- `--max-chars <number>`: バンドル Part ごとの最大文字数を指定する。デフォルトは `120000`。
- `--max-input-file-bytes <number>`: 単一入力ファイルの最大読み込み bytes を指定する。デフォルトは `1000000`。
- `--include "glob"`: 追加で収集するファイルパターンを指定する。カンマ区切りで複数指定できます。
- `--exclude "glob"`: 収集対象から除外するファイルパターンを指定する。カンマ区切りで複数指定できます。
- `--verbose`: 収集数、スキップ数、Part 数を標準出力に表示する。

## デフォルト収集範囲

デフォルトでは、入力ディレクトリをリポジトリルートとして扱い、次のファイルを収集します。

- `README.md`
- `TODO.md`
- `src/`, `lib/`, `app/`, `test/`, `tests/` 配下のソースファイル
- 対象拡張子: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.java`, `.cs`

`--include` を使うと、Markdown や設定ファイルなどを追加で収集できます。ただし、`.gitignore` で除外されたファイルや、リポジトリルート直下のドットフォルダ配下のファイルは、`--include` でも収集対象に戻せません。

## 除外ルール

入力ディレクトリ直下の `.gitignore` を読み、収集対象から除外します。

現在の `.gitignore` 判定は、このツールが必要とする範囲に絞った実装です。Git 本体の ignore 仕様と完全互換ではありません。詳細は [docs/gitignore-limitations.md](docs/gitignore-limitations.md) を参照してください。

リポジトリルート直下のドットフォルダは、`.gitignore` の内容に関係なく収集対象外です。たとえば `.git/`, `.vscode/`, `.codex/` などは収集しません。

## 入力ファイルの扱い

入力文字コードは UTF-8 を前提にします。UTF-8 として読めないファイル、またはバイナリと判定したファイルはスキップし、`text-bundle-000-index.md` に理由を記録します。

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

実リポジトリ入力で確認する場合は、次のコマンドで生成物を作成し、`workplace/miku-text-bundle/<yyyyMMddHHmm>/` を確認します。

```bash
node dist/main.js . --max-chars 5000
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
