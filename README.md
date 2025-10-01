# Estate - 不動産分析ツール

このプロジェクトは、Infragistics Reactコンポーネントを使用したスプレッドシート分析ツールです。

## 開発環境

### 必要なもの
- Bun (最新版)
- Node.js 18以上

### ローカル開発

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動
bun run dev
```

開発サーバーは http://localhost:3111 で起動します。

### ビルド

```bash
# プロダクションビルド
bun run build
```

ビルド成果物は `build` ディレクトリに出力されます。

## GitHub Pagesへのデプロイ

このプロジェクトは、GitHub Actionsを使用して自動的にGitHub Pagesにデプロイされます。

### 初回セットアップ

1. GitHubリポジトリの設定で、GitHub Pagesを有効化します：
   - リポジトリの **Settings** > **Pages** に移動
   - **Source** を **GitHub Actions** に設定

2. `main` ブランチにプッシュすると、自動的にデプロイが開始されます：

```bash
git add .
git commit -m "GitHub Pagesのデプロイ設定を追加"
git push origin main
```

3. デプロイが完了すると、以下のURLでアクセスできます：
   - `https://<username>.github.io/estate/`

### 手動デプロイ

GitHubリポジトリの **Actions** タブから、手動でワークフローを実行することもできます。

## 技術スタック

- React 18
- TypeScript
- Vite
- Bun
- Infragistics React Components
  - igniteui-react-spreadsheet
  - igniteui-react-excel
- MathJS
- Axios
- File-saver

## ライセンス

Private
