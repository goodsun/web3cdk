# Web3 CDK 統合マニュアル

## 目次

1. [概要](#概要)
2. [基本コマンド](#基本コマンド)
3. [スタック構成](#スタック構成)
4. [個別スタック操作](#個別スタック操作)
5. [開発フロー](#開発フロー)
6. [トラブルシューティング](#トラブルシューティング)
7. [ベストプラクティス](#ベストプラクティス)

## 概要

Web3 CDKは、AWS CDKを使用してWeb3インフラストラクチャを管理するツールです。

### 環境

- **dev**: 開発環境
- **stg**: ステージング環境
- **prod**: 本番環境

## 基本コマンド

### セットアップ

```bash
# 初期設定
npm run setup        # AWS認証・環境設定
npm run bootstrap    # CDKブートストラップ（初回のみ）
```

### デプロイ

```bash
# 全スタックデプロイ
npm run deploy:dev   # 開発環境
npm run deploy:stg   # ステージング環境
npm run deploy:prod  # 本番環境

# 個別スタックデプロイ
npm run deploy:dev -- --stacks web3cdk-dev-network   # ネットワークのみ
npm run deploy:dev -- --stacks web3cdk-dev-ec2       # EC2のみ
npm run deploy:dev -- --stacks web3cdk-dev-storage   # ストレージのみ
npm run deploy:dev -- --stacks web3cdk-dev-cache-api # Cache APIのみ
npm run deploy:dev -- --stacks web3cdk-dev-bot-api   # Bot APIのみ
```

### 削除

```bash
# 全スタック削除
npm run destroy:dev  # 開発環境
npm run destroy:stg  # ステージング環境
npm run destroy:prod # 本番環境

# 個別スタック削除
npm run destroy:dev -- --stacks web3cdk-dev-ec2      # EC2のみ削除
```

### 確認・調査

```bash
npm run list         # スタック一覧表示
npm run research     # 孤立スタック調査
npm run diff:dev     # 開発環境の差分確認
```

## スタック構成

### 5つのスタック

| スタック名 | 説明 | 依存関係 |
|-----------|------|----------|
| network | VPC、サブネット、セキュリティグループ | なし |
| ec2 | EC2インスタンス、Geth、Apache | network, bot-api, cache-api |
| storage | S3バケット、DynamoDB | なし |
| cache-api | キャッシュAPI（Lambda + API Gateway） | なし |
| bot-api | Discord Bot API（Lambda + API Gateway） | なし |

### デプロイ順序

1. network, storage, cache-api, bot-api（並列可能）
2. ec2（他のスタックの出力を参照）

## 個別スタック操作

### EC2スタックの再作成

```bash
# 1. EC2スタックのみ削除
npm run destroy:dev -- --stacks web3cdk-dev-ec2

# 2. EC2スタックのみ再作成
npm run deploy:dev -- --stacks web3cdk-dev-ec2
```

**メリット:**
- 他のスタック（API、Storage等）は影響を受けない
- ElasticIPは再利用可能
- SSH鍵は再利用可能

### API更新

```bash
# Lambda関数のコード更新時
npm run deploy:dev -- --stacks web3cdk-dev-bot-api
npm run deploy:dev -- --stacks web3cdk-dev-cache-api
```

## 開発フロー

### 1. インフラ変更時

```bash
# 1. TypeScriptコード修正
vim lib/constructs/ec2-stack.ts

# 2. 差分確認
npm run diff:dev

# 3. デプロイ
npm run deploy:dev
```

### 2. 環境変数変更時

```bash
# 1. 環境変数編集
vim .env.dev

# 2. デプロイ（変更があるスタックのみ更新される）
npm run deploy:dev
```

### 3. 緊急時の個別更新

```bash
# 特定スタックのみ素早く更新
npm run deploy:dev -- --stacks web3cdk-dev-cache-api
```

## トラブルシューティング

### よくある問題

#### Q: EC2にSSH接続できない

```bash
# 1. キーペア確認
ls -la ~/.ssh/web3cdk-dev.pem

# 2. EC2_KEY_NAME環境変数確認
grep EC2_KEY_NAME .env.dev

# 3. EC2再デプロイ
npm run deploy:dev -- --stacks web3cdk-dev-ec2
```

#### Q: スタック削除でエラー

```bash
# 1. 依存関係確認
npm run list

# 2. EC2から順に削除
npm run destroy:dev -- --stacks web3cdk-dev-ec2
npm run destroy:dev -- --stacks web3cdk-dev-bot-api
# ... 続く
```

#### Q: デプロイが遅い

```bash
# 個別スタックデプロイで高速化
npm run deploy:dev -- --stacks web3cdk-dev-bot-api
```

## ベストプラクティス

### 1. 個別スタックデプロイの活用

- **Lambda更新**: 該当APIスタックのみデプロイ
- **EC2設定変更**: EC2スタックのみデプロイ
- **全体更新**: 初回やネットワーク変更時のみ

### 2. 環境管理

```bash
# 環境ごとに.envファイルを管理
.env.dev     # 開発環境
.env.stg     # ステージング環境
.env.prod    # 本番環境
```

### 3. SSH鍵の管理

- キーペアは環境ごとに分ける
- EC2削除してもキーペアは残るので再利用可能
- `~/.ssh/`に安全に保管

### 4. 本番デプロイ

```bash
# 1. ステージングで確認
npm run deploy:stg

# 2. 差分確認
npm run diff:prod

# 3. 本番デプロイ（確認プロンプトあり）
npm run deploy:prod
```

## 関連ドキュメント

- [CDK Bootstrap Guide](./cdk-bootstrap-guide.md)
- [詳細仕様書](../design/specification.md)
- [ベストプラクティス](../checklists/cdk-best-practices-checklist.md)