# miku-text-bundle

`miku-text-bundle` は、指定ディレクトリ以下のテキストファイルを収集し、生成AIに渡しやすいサイズの分割 Markdown バンドルとして出力する CLI ツールです。

最初の対象レイヤーは `10 main application` です。初期プロダクト形態は Node.js / TypeScript の CLI メインアプリケーションであり、ソースコード専用の解析ツールではありません。

## コンセプト

`miku-text-bundle` は、指定フォルダからリポジトリ内の対象テキストファイルを収集し、生成AIツールに渡しやすい Markdown バンドルとして書き出します。

主な入力ディレクトリはリポジトリルートを想定します。初期対象は、リポジトリ直下の `README.md` と `TODO.md`、および一般的なソースディレクトリ配下のソースファイルです。

このツールはファイル境界を保つことを重視します。初期方針では、ファイルは丸ごといずれかのバンドル Part に割り当て、ファイル途中では分割しません。

## 入力

- 対象入力ディレクトリ。通常はリポジトリルート。
- 出力ディレクトリ。省略時は日時付きのデフォルト出力先を使う。
- バンドル Part ごとの最大文字数。
- 単一入力ファイルの最大読み込み bytes。
- include / exclude オプション。

## デフォルト収集範囲

初期デフォルトの収集範囲は次のとおりです。

- `README.md`
- `TODO.md`
- `src/`, `lib/`, `app/`, `test/`, `tests/` などの一般的なソースフォルダ配下のソースファイル。
- ソースファイル拡張子は `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.java`, `.cs`。

入力ディレクトリ以下のファイルを収集対象にするかどうかを判定するとき、リポジトリルートの `.gitignore` を尊重します。初期版ではサブディレクトリ配下の `.gitignore` は読みません。

`.gitignore` 判定は、このツールが必要とする初期範囲の実装です。Git 本体の ignore 仕様と完全互換ではありません。否定パターン、サブディレクトリごとの `.gitignore`、高度な ignore ルールは初期版では対象外です。

詳細は `docs/gitignore-limitations.md` に記録します。

リポジトリルート直下のドットフォルダは、`.gitignore` の内容に関係なく暗黙に収集対象外とします。たとえば `.git/`, `.vscode/`, `.codex/` などはデフォルトでは収集しません。

`.gitignore` で除外されたファイル、およびリポジトリルート直下のドットフォルダ配下のファイルは、include オプションでも収集対象に戻せません。

追加の Markdown、設定ファイル、テキスト拡張子は、`.gitignore` と暗黙除外ルールに反しない範囲で、include オプションまたはデフォルト拡張によって後から対象にできる想定です。

初期版の入力文字コードは UTF-8 のみとします。UTF-8 として読めないファイル、およびバイナリと判定したファイルはスキップし、`text-bundle-000-index.md` に警告として記録します。

単一入力ファイルのデフォルト読み込み上限は 1,000,000 bytes です。デフォルト収集や include オプションでこの上限を超えるファイルが対象になった場合、そのファイルは読み込まずにスキップし、`text-bundle-000-index.md` に理由を記録します。上限は `--max-input-file-bytes` で変更できます。

## 出力

出力ディレクトリを指定しない場合、デフォルト出力先は次の形式にします。

```text
workplace/miku-text-bundle/<yyyyMMddHHmm>/
```

例:

```text
workplace/miku-text-bundle/202605051252/
```

`<yyyyMMddHHmm>` は実行時のローカル日時で更新します。

同じ分に既に同名の出力ディレクトリが存在する場合は、末尾に `-1`, `-2` のような連番 suffix を付けます。

```text
workplace/miku-text-bundle/202605051252/
workplace/miku-text-bundle/202605051252-1/
workplace/miku-text-bundle/202605051252-2/
```

- `text-bundle-000-index.md`
- `text-bundle-001.md`, `text-bundle-002.md` 以降の分割 Markdown ファイル。
- `text-bundle-000-prompt.md`

出力ファイルはすべて Markdown 形式とします。

- `text-bundle-000-index.md` は、出力概要、各 Part に含まれるファイル一覧、スキップされたファイル、診断情報、抽出した `TODO` / `FIXME` / `XXX` マーカーを Markdown として記録する。
- `text-bundle-*.md` は、Part ごとの収集ファイルを Markdown 見出しとコードフェンスで記録する。
- 生成AIへの依頼文は、バンドル処理後の回答ファイルを取り出しやすいように、`workplace/miku-text-bundle/<yyyyMMddHHmm>/text-bundle-000-prompt.md` へ静的な Markdown として出力する。
- バンドル Part が複数ファイルに分かれる場合でも、生成AIへの依頼文は `text-bundle-000-prompt.md` 1つにまとめる。この依頼文の中で `text-bundle-000-index.md` とすべての `text-bundle-*.md` を処理対象として列挙する。
- `text-bundle-000-prompt.md` には、複数メッセージで順番に貼り付けるための受領手順、Part の読み込み順、完了合図、回答形式、処理後の回答ファイル名 `text-bundle-response.md` を記録する。
- 収集元ファイルのパス、文字数、行数など、生成AIに渡す際の確認に必要なメタ情報も Markdown 内に含める。

`text-bundle-*.md` では、各収集ファイルを `### path/to/file.ts` のような見出しで区切ります。ファイル本文は拡張子に応じた通常の backtick code fence で囲みます。外側に tilde fence を使うのは、生成AIへの回答形式指示だけとします。

原則としてファイル途中では分割しません。ただし、1ファイルだけで `--max-chars` を超える場合は例外として分割します。この場合は行単位で、各 chunk が `--max-chars` 以内に近づくように分割します。コードフェンスの外側に「このファイルはサイズ上限を超えたため、やむを得ず分割した」ことを Markdown で明記し、分割番号と元ファイルパスを記録します。`text-bundle-000-index.md` にも警告として記録します。

生成AIへの依頼文には、複数メッセージで順番に貼り付けるための手順と、定型文として次のような出力形式指示を含めます。

```text
markdown テキスト形式で出力してください。

○最終的な回答は Markdown テキスト形式で出力し、さらに ~~~~ で囲まれた一塊として出力してください。markdown 内に backtick による code fence が含まれる場合があるため、外側の囲みは tilde を使ってください。
```

## 初期CLI案

```text
miku-text-bundle <inputDir> <outputDir> --max-chars 120000 --max-input-file-bytes 1000000
miku-text-bundle <inputDir> --max-chars 120000 --max-input-file-bytes 1000000
```

## 開発

依存関係をインストールします。

```bash
npm install
```

ビルド、テスト、package dry-run を実行します。

```bash
npm run build
```

ローカルで CLI を実行します。

```bash
node dist/main.js . --max-chars 120000
```

## 初期動作方針

- 入力ディレクトリはデフォルトでリポジトリルートとして扱う。
- 対象ディレクトリ配下から、リポジトリ概要ファイルとデフォルト対象のソースファイルを収集する。
- リポジトリルート直下のドットフォルダは暗黙に収集対象外とする。
- デフォルトのファイル探索では、リポジトリルートの `.gitignore` を尊重する。
- `.gitignore` とリポジトリルート直下ドットフォルダの除外は、include オプションでは解除できない。
- UTF-8 として読めないファイルやバイナリファイルはスキップし、index に警告として記録する。
- ソースコード専用ではなく、リポジトリ内テキストのバンドルツールとして扱う。
- バンドル出力はファイル単位で分割する。
- 初期実装では原則としてファイル途中の分割は行わない。
- ただし、単一ファイルが `--max-chars` を超える場合は、Markdown のコードフェンス外側に分割注記を置いたうえで例外的に分割する。
- `TODO`, `FIXME`, `XXX` マーカーを抽出する。
- `text-bundle-000-index.md` から各 Part に含まれるファイルを一覧できるようにする。
- GitHub リポジトリ操作は人間が担当する。

## リポジトリ構成

- `docs/`: miku-soft 設計文書と今後のプロジェクト文書。
- `workplace/`: 参照リポジトリ、展開したアーカイブ、生成ファイル、検証成果物などのローカル専用作業領域。
- `LICENSE`: Apache License 2.0。
- `TODO.md`: 初期リリース前の確認事項と具体的な後続作業。

## リポジトリ運用ルール

`workplace/` は `workplace/.gitkeep` を除いて Git 管理対象外にします。

ローカルの VS Code 設定である `.vscode/` は Git 管理対象外にします。共有が必要な設定は、サニタイズした例またはドキュメントとしてコミットします。

`.codex/` 配下のローカル Codex 設定および配置ファイルは Git 管理対象外にします。

Node.js、フロントエンド、Java、Maven の生成物は Git 管理対象外にします。現在の初期実装は Node.js / TypeScript CLI として進めています。

## miku-soft 文書

このリポジトリにコピーした共有 miku-soft 設計文書は次のとおりです。

- `docs/miku-soft-00-overview-design-v20260427.md`
- `docs/miku-soft-10-mainapp-design-v20260505.md`
- `docs/miku-soft-20-javaapp-design-v20260501.md`
- `docs/miku-soft-30-straight-conversion-v20260425.md`
- `docs/miku-soft-40-agentskills-design-v20260501.md`
- `docs/miku-soft-50-mcp-design-v20260501.md`
