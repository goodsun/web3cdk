# CDK効率化ツール群 設計書

## 🎯 プロジェクトの目標

1. **シンプル**: 最小限の設定で動作
2. **確実**: エラーが起きにくい設計
3. **効率的**: 繰り返し作業の自動化
4. **拡張可能**: 段階的に機能追加

## 📋 基本方針

### 1. 段階的アプローチ
- Stage 1: 最小限のCDKプロジェクト構築
- Stage 2: 環境設定の自動化
- Stage 3: デプロイメントの簡素化
- Stage 4: 再利用可能なコンポーネント化

### 2. ファイル構成（シンプル版）
```
web3cdk/
├── bin/
│   └── app.ts              # CDKアプリのエントリーポイント
├── lib/
│   ├── stacks/            # スタック定義
│   │   └── base-stack.ts  # 基本スタック
│   └── constructs/        # 再利用可能なConstruct
├── config/
│   ├── defaults.json      # デフォルト設定
│   └── environments/      # 環境別設定
├── scripts/
│   ├── setup.sh          # 初期セットアップ
│   ├── deploy.sh         # デプロイメント
│   └── destroy.sh        # リソース削除
└── test/
    └── stack.test.ts     # スタックのテスト
```

### 3. 環境設定の簡素化
- 環境変数の最小化
- 設定ファイルの一元管理
- デフォルト値の活用

## 🚀 Stage 1: 最小限のCDKプロジェクト

### 目標
- S3バケット1つだけの最小スタック
- 環境変数は3つまで
- 1コマンドでデプロイ可能

### 必要な環境変数
```bash
CDK_ENV=dev|stg|prod     # 環境名
CDK_ACCOUNT=123456789012  # AWSアカウントID
CDK_REGION=ap-northeast-1 # リージョン
```

## 🔧 Stage 2: 環境設定の自動化

### setup.shスクリプト
1. AWS CLIの存在確認
2. 認証情報の確認
3. 必要な環境変数の設定
4. CDK bootstrapの実行確認

### config管理
```json
// config/defaults.json
{
  "project": {
    "name": "web3cdk",
    "description": "Simple CDK project"
  },
  "tags": {
    "Project": "web3cdk",
    "ManagedBy": "CDK"
  }
}
```

## 📦 Stage 3: デプロイメントの簡素化

### deploy.shスクリプト
```bash
# シンプルな使い方
./scripts/deploy.sh dev   # 開発環境にデプロイ
./scripts/deploy.sh prod  # 本番環境にデプロイ
```

### 機能
1. 環境の自動検証
2. 差分の確認（cdk diff）
3. デプロイ実行（cdk deploy）
4. 結果のサマリー表示

## 🧩 Stage 4: 再利用可能なコンポーネント

### 基本Construct例
1. **VPCConstruct**: 標準的なVPC設定
2. **S3Construct**: セキュアなS3バケット
3. **LambdaConstruct**: Lambda関数の基本設定

### 使用例
```typescript
// 既存のConstructを組み合わせるだけ
const vpc = new VPCConstruct(this, 'VPC');
const storage = new S3Construct(this, 'Storage');
const api = new LambdaConstruct(this, 'API', { vpc });
```

## ✅ ベストプラクティス

1. **命名規則**
   - リソース名: `{project}-{env}-{resource}`
   - 例: `web3cdk-dev-storage`

2. **タグ付け**
   - 全リソースに共通タグを自動付与
   - 環境、プロジェクト、管理者を明記

3. **セキュリティ**
   - 最小権限の原則
   - 暗号化をデフォルトに
   - パブリックアクセスは明示的に

4. **コスト管理**
   - 環境別にコスト配分タグ
   - 不要リソースの自動削除設定

## 🔄 次のステップ

1. Stage 1の実装から開始
2. 動作確認後、次のStageへ
3. フィードバックを元に改善
4. ドキュメントの継続的更新