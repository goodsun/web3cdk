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

# SSL証明書管理
./scripts/download-ssl-certs.sh [環境]  # SSL証明書バックアップ（.envから自動取得）
```

## 📁 プロジェクト構成

```
web3cdk/
├── 📋 プロジェクト管理 (ルート)
│   ├── package.json          # Node.js設定
│   ├── README.md            # プロジェクト説明  
│   ├── LICENSE              # ライセンス
│   ├── CLAUDE.md            # Claude Code設定
│   └── cdk.json             # CDK設定
│
├── 📁 ソースコード
│   ├── src/                 # メインソースコード
│   │   ├── bin/            # CDKエントリポイント
│   │   └── lib/            # CDKスタック定義
│   └── lib/                 # CDK構成要素（constructs）
│
├── 📁 開発・運用
│   ├── scripts/            # 管理スクリプト
│   │   ├── setup.sh        # 初期セットアップ
│   │   ├── bootstrap.sh    # CDKブートストラップ
│   │   ├── list-stacks.sh  # スタック一覧表示
│   │   ├── diff.sh         # 差分確認
│   │   ├── deploy.sh       # デプロイメント
│   │   ├── destroy.sh      # リソース削除
│   │   ├── investigate-stack.sh # 孤立スタック調査
│   │   ├── download-ssl-certs.sh # SSL証明書バックアップ
│   │   └── regression-test.sh # 🧪 自動リグレッションテスト
│   └── docs/               # ドキュメント（目的別整理）
│       ├── index.md        # 📖 ドキュメント索引
│       ├── guides/         # 📋 ガイド・マニュアル
│       ├── design/         # 🏗️ 設計書
│       ├── architecture/   # 🏛️ アーキテクチャ
│       ├── development/    # 📝 開発リソース
│       ├── checklists/     # ✅ チェックリスト
│       ├── testing/        # 🧪 テスト・品質保証
│       ├── planning/       # 📋 計画書
│       └── manual/         # 📚 既存マニュアル
│
├── 📁 機密保管庫
│   └── backup/             # バックアップ専用（Git管理外）
│       ├── README.md       # 🔒 保管庫説明（Git管理）
│       ├── ssl/           # SSL証明書バックアップ
│       ├── database/      # DBバックアップ（将来用）
│       └── config/        # 設定バックアップ（将来用）
│
└── 📁 設定ファイル
    ├── .env.*             # 環境変数（Git管理外）
    └── tools/             # 開発ツール設定
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
8. **品質保証**: `./scripts/regression-test.sh`でリグレッションテスト

## 🏗️ スタック構成

本プロジェクトは以下の複数スタックで構成されています：

| スタック名 | 説明 | 主なリソース |
|-----------|------|------------|
| `web3cdk-{env}-network` | ネットワーク基盤 | VPC, Subnet, SecurityGroup |
| `web3cdk-{env}-ec2` | Webサーバー | EC2, ElasticIP, Apache |
| `web3cdk-{env}-storage` | ストレージ | S3 Bucket |
| `web3cdk-{env}-cache-api` | キャッシュAPI | Lambda, DynamoDB, API Gateway |
| `web3cdk-{env}-bot-api` | Discord Bot API | Lambda, DynamoDB, API Gateway |

### 💡 上級者向けTips

複数スタック構成なので、CDKの標準コマンドで個別制御も可能：

```bash
# 特定スタックのみ操作
npx cdk deploy web3cdk-dev-cache-api    # Cache APIスタックのみデプロイ
npx cdk diff web3cdk-dev-ec2             # EC2スタックの差分確認
npx cdk destroy web3cdk-dev-bot-api      # Bot APIスタックのみ削除

# 全体操作（推奨）
npx cdk deploy --all             # 全スタック一括デプロイ
npx cdk diff --all               # 全スタック差分確認
npx cdk ls                       # スタック一覧表示
```

**初学者の方**: まずは `npm run` コマンドから始めて、慣れてきたら `npx cdk` コマンドも試してみてください！

## 🔧 トラブルシューティング

### EC2インスタンスのミニマルリセット（2段階方式）

起動処理でうまくいかなかった場合や、インスタンスの設定を完全にリセットしたい場合：

```bash
# ステップ1: ミニマルインスタンスを作成（SSL証明書なし）
EC2_MINIMAL_RESET=true npm run deploy:dev

# ステップ2: フル構成に自動置き換え
npm run deploy:dev
```

**動作説明：**
- **ステップ1**: 最小限のEC2インスタンスを作成（Apache/SSL設定なし）
- **ステップ2**: UserDataの差分により、フル構成のインスタンスに自動置き換え

**メリット：**
- Let's Encrypt証明書の制限（週5回）を回避
- 連続再作成による問題を防止
- 安全で確実なリセット方法

**使用ケース：**
- Apache設定の初期化に失敗した場合
- SSL証明書設定でエラーが発生した場合
- User Dataスクリプトの実行でインスタンスが不安定になった場合

**注意事項：**
- 事前にSSHキーペアの削除が必要です
- `EC2_MINIMAL_RESET`を設定したままだと、常にミニマルインスタンスが作成されます

### SSL証明書のバックアップとリストア

EC2インスタンス再作成前に、Let's Encryptで作成したSSL証明書をバックアップできます：

```bash
# SSL証明書のダウンロード（.env.devのDOMAIN_NAMEを使用）
./scripts/download-ssl-certs.sh dev

# ドメインを直接指定する場合
./scripts/download-ssl-certs.sh dev your-domain.com
```

**ダウンロードされるファイル：**
- `cert1.pem` - サーバー証明書
- `chain1.pem` - 中間証明書  
- `fullchain1.pem` - フル証明書チェーン
- `privkey1.pem` - 秘密鍵

**保存場所：** `backup/ssl/[環境]/[ドメイン]/[タイムスタンプ]/`

**復元方法：**
1. 新しいEC2インスタンスにSSH接続
2. 証明書ファイルを `/etc/letsencrypt/archive/[ドメイン]/` にアップロード
3. Apache設定でSSL証明書のパスを更新
4. Apache再起動: `sudo systemctl restart httpd`

**注意：** 証明書の有効期限は通常3ヶ月です。期限切れの場合は新しい証明書を取得してください。

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

### 📋 ガイド・マニュアル
- [CDK Bootstrap ガイド](docs/guides/cdk-bootstrap-guide.md)
- [移行手順書](docs/guides/migration-step-by-step.md)

### 🏗️ 設計書
- [プロジェクト設計書](docs/design/project-design.md)
- [仕様書](docs/design/specification.md)
- [最適化ロードマップ](docs/design/project-optimization-roadmap.md)

### 📝 開発リソース
- [開発時の学び](docs/development/development-learnings.md)
- [User Data変更履歴](docs/development/user-data-changes.md)
- [コンソール色設定ガイド](docs/development/console-color-guide.md)

### ✅ チェックリスト
- [CDKベストプラクティス](docs/checklists/cdk-best-practices-checklist.md)

### 🧪 テスト・品質保証
- [**リグレッションテスト実行ガイド**](docs/testing/regression-test-guide.md) - 自動テストの実行方法
- [**test環境ガイド**](docs/testing/test-environment-guide.md) - テスト専用環境の使用方法
- [リグレッションテスト仕様書](docs/testing/regression-test-plan.md) - テスト項目と計画
- [スタックテスト仕様](docs/testing/stack-test-specifications.md) - コンポーネント別テスト手順

### 📋 計画書
- [移行計画書](docs/planning/migration-plan.md)

## ⚡ 特徴

- **シンプル**: 環境変数は3つだけ
- **安全**: 本番環境へのデプロイは確認付き
- **効率的**: 1コマンドでデプロイ完了
- **拡張可能**: 段階的に機能追加可能

## 🤝 貢献

Issue や Pull Request は大歓迎です！
