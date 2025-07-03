# CDK スタック構成と役割

## 概要

このプロジェクトは独立性の高いスタック構成を採用しており、各スタックが明確な責任を持ちます。
基盤スタックの上に、独立して動作するアプリケーションスタックを配置する設計です。

## スタック依存関係

```
┌─────────────┐    ┌─────────────┐
│   Network   │    │   Storage   │
│    Stack    │    │    Stack    │
└──────┬──────┘    └──────┬──────┘
       │                   │
       ├───────────────────┴─────────┐
       │                             │
┌──────▼──────┐  ┌─────────────┐  ┌─▼───────────┐
│  Bot API    │  │  Cache API  │  │    EC2      │
│   Stack     │  │   Stack     │  │   Stack     │
└─────────────┘  └─────────────┘  └─────────────┘
```

## 各スタックの詳細

### 1. Network Stack (`web3cdk-dev-network`)

**役割**: ネットワーク基盤の提供

**管理リソース**:
- VPC（仮想プライベートクラウド）
- パブリック/プライベートサブネット
- インターネットゲートウェイ
- NATゲートウェイ
- セキュリティグループ

**セキュリティグループのポート設定**:
- `22/tcp`: SSH接続
- `80/tcp`: HTTP
- `443/tcp`: HTTPS
- `8545/tcp`: Geth RPC

**他スタックへの提供**:
- VPCリファレンス
- セキュリティグループリファレンス

**更新タイミング**:
- 新しいアプリケーションのポート要件追加時
- ネットワーク構成の変更時

---

### 2. Storage Stack (`web3cdk-dev-storage`)

**役割**: ストレージリソースの管理

**管理リソース**:
- S3バケット（静的ファイル、バックアップ用）
- バケットポリシー
- ライフサイクルルール

**他スタックへの提供**:
- S3バケットリファレンス
- バケットARN

**更新タイミング**:
- 新しいストレージ要件の追加時
- バックアップポリシーの変更時

---

### 3. Bot API Stack (`web3cdk-dev-bot-api`)

**役割**: Discord Bot連携APIの提供

**管理リソース**:
- Lambda関数（Discord Bot APIハンドラー）
- API Gateway（エンドポイント: `/bot/`）
- DynamoDB テーブル（4つ）:
  - `bot-api`: 汎用データ
  - `discord-eoa`: Discord-EOAマッピング
  - `registration-tokens`: 登録トークン
  - `want-requests`: Wantリクエスト
  - `conversations`: 会話履歴

**依存関係**:
- Network Stack（VPC、セキュリティグループ）

**環境変数**:
- `DISCORD_PUBLIC_KEY`
- `DISCORD_APPLICATION_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `API_BASE_URL`

**エンドポイント例**:
- `GET /bot/health`
- `POST /bot/discord`
- `GET /bot/register.html`

---

### 4. Cache API Stack (`web3cdk-dev-cache-api`)

**役割**: スマートコントラクトデータのキャッシュAPI

**管理リソース**:
- Lambda関数（キャッシュAPIハンドラー）
- Lambda関数（イベントモニター）
- API Gateway（エンドポイント: `/cache/`）
- DynamoDB テーブル（キャッシュストア）
- EventBridge ルール（定期実行）

**依存関係**:
- Network Stack（VPC、セキュリティグループ）

**環境変数**:
- `CACHE_CONTRACT_ADDRESSES`
- `CACHE_CHAIN_ID`
- `CACHE_RPC_ENDPOINT`

**エンドポイント例**:
- `GET /cache/contract/{address}`
- `POST /cache/contract/{address}/{function}`

---

### 5. EC2 Stack (`web3cdk-dev-ec2`)

**役割**: Gethノードとリバースプロキシサーバー

**管理リソース**:
- EC2インスタンス
- IAMロール（SSM接続用）
- Elastic IP関連付け
- UserDataスクリプト

**インストールされるソフトウェア**:
- Apache HTTP Server（リバースプロキシ）
- Geth v1.11.6（Ethereumノード）
- Let's Encrypt（SSL証明書）
- 開発ツール（tmux, htop, vim等）

**依存関係**:
- Network Stack（VPC、セキュリティグループ）

**提供サービス**:
- Geth RPC（`/rpc`）
- リバースプロキシ（手動設定）

---

## デプロイ順序

### 推奨デプロイ順序

```bash
# 1. 基盤スタック（必須）
npm run deploy:dev -- --stacks web3cdk-dev-network
npm run deploy:dev -- --stacks web3cdk-dev-storage

# 2. アプリケーションスタック（任意の順序で並列実行可能）
npm run deploy:dev -- --stacks web3cdk-dev-bot-api
npm run deploy:dev -- --stacks web3cdk-dev-cache-api
npm run deploy:dev -- --stacks web3cdk-dev-ec2
```

### 個別スタックの削除

```bash
# 特定スタックのみ削除
npm run destroy:dev -- --stacks web3cdk-dev-bot-api

# 全スタック削除（依存関係を考慮した順序で実行）
npm run destroy:dev
```

## スタック管理のベストプラクティス

### 1. 独立性の維持
- 各スタックは可能な限り独立して動作するように設計
- クロススタック参照は最小限に抑える
- EC2のリバースプロキシ設定は手動で行い、依存を避ける

### 2. 環境変数の管理
- `.env.dev`、`.env.stg`、`.env.prod`で環境別に管理
- 機密情報は AWS Secrets Manager を使用（将来実装）

### 3. リソース命名規則
- `{projectName}-{environment}-{resourceType}`
- 例: `web3cdk-dev-bot-api`

### 4. タグ付け戦略
- 全リソースに以下のタグを付与:
  - `Project`: プロジェクト名
  - `Environment`: 環境名（dev/stg/prod）
  - `Component`: コンポーネント名

## トラブルシューティング

### スタックが削除できない場合
- Export/Import の依存関係を確認
- 依存する側のスタックから先に削除

### デプロイが失敗する場合
- 環境変数が正しく設定されているか確認
- IAMロールの権限を確認
- CloudFormationコンソールでエラー詳細を確認

## 今後の拡張計画

### 検討中のスタック
- **Monitoring Stack**: CloudWatch、X-Ray統合
- **Database Stack**: RDS管理（必要に応じて）
- **CDN Stack**: CloudFront配信

### スケーラビリティ考慮事項
- Lambda同時実行数の制限
- DynamoDBのキャパシティ設定
- API Gatewayのレート制限