# Web3 CDK - シンプルで効率的なCDKツール群

AWS CDKをシンプルかつ効率的に立ち上げるためのツール群です。

## 🚀 クイックスタート

### 1. セットアップ
```bash
# 初期セットアップの実行
npm run setup
```

### 2. ブートストラップ
```bash
# CDKブートストラップ
npm run bootstrap
```

### 3. デプロイ
```bash
# 開発環境へデプロイ
npm run deploy:dev

# ステージング環境へデプロイ
npm run deploy:stg

# 本番環境へデプロイ
npm run deploy:prod
```

## 📋 必要な環境変数（たった3つ！）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| CDK_ACCOUNT | AWSアカウントID | 123456789012 |
| CDK_REGION | リージョン | ap-northeast-1 |
| CDK_ENV | 環境名 | dev, stg, prod |

## 🛠️ 利用可能なコマンド

```bash
npm run setup         # 初期セットアップ
npm run bootstrap     # CDKブートストラップ
npm run list          # スタック一覧表示
npm run build         # TypeScriptのビルド
npm run test          # テストの実行
npm run diff:dev      # 開発環境の差分確認
npm run diff:stg      # ステージング環境の差分確認
npm run diff:prod     # 本番環境の差分確認
npm run deploy:dev    # 開発環境へデプロイ
npm run deploy:stg    # ステージング環境へデプロイ
npm run deploy:prod   # 本番環境へデプロイ
npm run destroy:dev   # 開発環境のスタック削除
npm run destroy:stg   # ステージング環境のスタック削除
npm run destroy:prod  # 本番環境のスタック削除
npm run research      # 孤立スタック調査ツール
```

## 📁 プロジェクト構成

```
web3cdk/
├── 📋 プロジェクト管理
│   ├── package.json          # Node.js設定
│   ├── README.md            # プロジェクト説明  
│   └── LICENSE              # ライセンス
│
├── 📁 ソースコード
│   └── src/                 # メインソースコード
│       ├── bin/            # CDKエントリポイント
│       └── lib/            # CDKスタック定義
│
├── 📁 開発・運用
│   ├── scripts/            # 管理スクリプト
│   │   ├── setup.sh        # 初期セットアップ
│   │   ├── bootstrap.sh    # CDKブートストラップ
│   │   ├── list-stacks.sh  # スタック一覧表示
│   │   ├── diff.sh         # 差分確認
│   │   ├── deploy.sh       # デプロイメント
│   │   ├── destroy.sh      # リソース削除
│   │   └── investigate-stack.sh # 孤立スタック調査
│   ├── test/              # テストファイル
│   └── docs/              # ドキュメント
│
└── 📁 設定ファイル
    ├── config/             # 環境・CDK設定
    │   ├── environments/   # 環境別設定
    │   ├── cdk.json        # CDK設定
    │   └── .env.*          # 環境変数
    └── tools/              # 開発ツール設定
        ├── tsconfig.json   # TypeScript設定
        ├── jest.config.js  # テスト設定
        └── *.code-workspace # エディタ設定
```

## 🔄 開発フロー（初学者向け）

1. **初回のみ**: `npm run setup`でセットアップ
2. **初回のみ**: `npm run bootstrap`でCDKブートストラップ
3. **開発**: コードを修正
4. **テスト**: `npm run test`でテスト実行
5. **差分確認**: `npm run diff:dev`で変更点を確認
6. **デプロイ**: `npm run deploy:dev`でデプロイ
7. **確認**: AWS Consoleで確認

### 💡 上級者向けTips

複数スタックがある場合は、CDKの標準コマンドで個別制御も可能：

```bash
# 特定スタックのみ操作
npx cdk deploy my-api-stack      # APIスタックのみデプロイ
npx cdk diff my-web-stack        # Webスタックの差分確認
npx cdk destroy my-db-stack      # DBスタックのみ削除

# 全体操作
npx cdk deploy --all             # 全スタック一括デプロイ
npx cdk diff --all               # 全スタック差分確認
npx cdk ls                       # スタック一覧表示
```

**初学者の方**: まずは `npm run` コマンドから始めて、慣れてきたら `npx cdk` コマンドも試してみてください！

## 🔧 トラブルシューティング

### 孤立スタックの調査・削除

CDKブートストラップを削除した後に残ってしまったスタックがある場合：

```bash
# 例: MyProdStackを調査する場合
# 1. 環境ファイルを作成
cat > .env.myprod << EOF
CDK_ACCOUNT=123456789012
CDK_REGION=ap-northeast-1
STACK_NAME=MyProdStack
EOF

# 2. 調査ツールを実行
npm run research myprod
```

このツールでは以下の操作が可能です：
- スタック詳細表示
- リソース一覧表示
- スタック削除（CDK実行ロールが削除されていても対応）

**注意**: CDKブートストラップ削除後は通常の削除ができないため、特別な手順が必要です。ツールが解決策を提示します。

## 📖 詳細ドキュメント

- [プロジェクト設計書](docs/project-design.md)
- [CDK Bootstrap ガイド](docs/cdk-bootstrap-guide.md)

## ⚡ 特徴

- **シンプル**: 環境変数は3つだけ
- **安全**: 本番環境へのデプロイは確認付き
- **効率的**: 1コマンドでデプロイ完了
- **拡張可能**: 段階的に機能追加可能

## 🤝 貢献

Issue や Pull Request は大歓迎です！
