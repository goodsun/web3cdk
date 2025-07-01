# 🏗️ アプリケーション構築方針

## 概要

Web3 CDKプロジェクトにおけるアプリケーション構築の設計方針と原則を定義します。

## 🎯 基本方針

### 1. アプリケーション独立性の原則

各アプリケーション（API）は独立したスタックとして構築し、以下の要素をセットで含みます：

- **Lambda関数**: アプリケーションロジック
- **DynamoDB**: アプリケーション専用のデータストア
- **API Gateway**: エンドポイント管理
- **その他リソース**: 必要に応じて（EventBridge、SQS等）

### 2. 段階的移行と共通化

```
Phase 1: 独立移行 → Phase 2: 知見の蓄積 → Phase 3: 共通化検討
```

**理由**:
- アプリケーションごとに異なるDB使用パターンを尊重
- 実運用を通じて共通化ポイントを発見
- 性急な抽象化による複雑性を回避

## 📁 ディレクトリ構造

```
web3cdk/
├── lambda/
│   ├── cache-api/      # NFTキャッシュAPI
│   ├── bot-api/        # Discord Bot API
│   └── contract-api/   # スマートコントラクトAPI
│
├── lib/
│   └── stacks/
│       ├── cache-api-stack.ts
│       ├── bot-api-stack.ts
│       └── contract-api-stack.ts
```

## 🔧 スタック設計パターン

### 基本構成

```typescript
export class CacheApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    
    // 1. DynamoDB（アプリ専用）
    const table = new dynamodb.Table(...);
    
    // 2. Lambda関数
    const lambdaFunction = new lambda.Function(...);
    
    // 3. API Gateway
    const api = new apigateway.RestApi(...);
    
    // 4. 権限設定
    table.grantReadWriteData(lambdaFunction);
  }
}
```

### 命名規則

- **スタック名**: `{project}-{env}-{api-name}`
  - 例: `web3cdk-dev-cache-api`
- **リソース名**: `{project}-{api-name}-{resource}-{env}`
  - 例: `web3cdk-cache-api-table-dev`

## 📊 アプリケーション別の特性

### CacheAPI
- **特性**: 高頻度読み取り、TTLベースの自動削除
- **主要リソース**: 
  - Lambda (ARM64, 128MB)
  - DynamoDB (1テーブル、TTL有効)
  - EventBridge (5分間隔)

### BotAPI
- **特性**: ユーザー操作駆動、永続データ管理
- **主要リソース**:
  - Lambda (x86_64, 256MB)
  - DynamoDB (5テーブル)
  - Discord連携用の環境変数

### ContractAPI（計画中）
- **特性**: ブロックチェーン連携、トランザクション管理
- **主要リソース**:
  - Lambda
  - DynamoDB
  - Secrets Manager（秘密鍵管理）

## 🚀 デプロイ戦略

### 独立デプロイ

各アプリケーションは独立してデプロイ可能：

```bash
# 個別デプロイ
npm run deploy:dev -- web3cdk-dev-cache-api
npm run deploy:dev -- web3cdk-dev-bot-api

# 全体デプロイ
npm run deploy:dev
```

### 環境変数管理

```
.env.dev
├── 共通設定（CDK_ACCOUNT等）
├── CacheAPI設定（CACHE_*）
├── BotAPI設定（DISCORD_*）
└── ContractAPI設定（CONTRACT_*）
```

## 📈 将来の共通化候補

知見が蓄積された後、以下の共通化を検討：

1. **インフラパターン**
   - DynamoDBのデフォルト設定
   - Lambda関数の基本設定
   - API Gatewayの共通設定

2. **運用機能**
   - ログ集約
   - メトリクス監視
   - エラー通知

3. **セキュリティ**
   - API認証の統一
   - シークレット管理
   - アクセス制御

## ✅ チェックリスト

新しいアプリケーションを追加する際の確認事項：

- [ ] 独立したスタックとして設計されているか
- [ ] 命名規則に従っているか
- [ ] 必要なリソースが明確か
- [ ] 環境変数が整理されているか
- [ ] 他のアプリケーションへの依存がないか
- [ ] デプロイ・削除が独立して可能か

## 📝 更新履歴

- 2025-01-31: 初版作成、独立スタック方針の確立