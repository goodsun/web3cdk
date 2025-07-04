# test環境ガイド

## 概要

test環境は、リグレッションテスト専用に設計された独立した環境です。本番環境や開発環境に影響を与えることなく、安全にテストを実行できます。

## 🎯 test環境の目的

- **リグレッションテスト**: コード変更後の動作確認
- **CI/CD統合**: 自動テストパイプラインでの利用
- **安全な検証**: 本番環境への影響を回避
- **並行開発**: 他の開発作業との分離

## 🏗️ アーキテクチャ

### スタック構成

```
web3cdk-test-network    # VPC、セキュリティグループ
web3cdk-test-storage    # S3、DynamoDB
web3cdk-test-cache-api  # Lambda、API Gateway
web3cdk-test-bot-api    # Lambda、API Gateway
```

### リソース命名規則

| リソースタイプ | 命名パターン | 例 |
|----------------|-------------|-----|
| CloudFormationスタック | `web3cdk-test-{component}` | `web3cdk-test-network` |
| Lambda関数 | `web3cdk-test-{function}` | `web3cdk-test-cache-api` |
| DynamoDBテーブル | `web3cdk-test-{table}` | `web3cdk-test-cache-table` |
| S3バケット | `web3cdk-test-{bucket}-{account}-{region}` | `web3cdk-test-storage-498997347996-ap-northeast-1` |

## ⚙️ 設定ファイル (.env.test)

### 基本設定

```bash
# 環境識別
CDK_ENV=test
PROJECT_NAME=web3cdk
ORG_NAME=bonsoleil

# AWS設定
CDK_ACCOUNT=498997347996
CDK_REGION=ap-northeast-1
AWS_PROFILE=bonsoleil
```

### セキュリティ設定

```bash
# テスト環境用の緩い設定
ADMIN_CIDR=0.0.0.0/0

# 固定IPは使用しない
USE_ELASTIC_IP=false
ELASTIC_IP_ALLOCATION_ID=
```

### アプリケーション設定

```bash
# テスト用ダミー値
DISCORD_PUBLIC_KEY=test_discord_public_key
DISCORD_APP_ID=test_discord_app_id
DISCORD_BOT_TOKEN=test_discord_bot_token
DISCORD_GUILD_ID=test_discord_guild_id

# テスト用チェーン設定
GETH_CHAIN_ID=21202  # テスト専用ID
GETH_PRIVATE_KEY=test_private_key_for_regression_testing
GETH_PASSWORD=test_password_for_regression_testing
```

### テスト固有設定

```bash
# テストモード有効化
TEST_MODE=true
TEST_DISCORD_ENABLED=false  # Discord連携無効
TEST_RPC_ENABLED=true
TEST_CLEANUP_ON_FAILURE=true
```

## 🚀 使用方法

### 基本的な使用フロー

```bash
# 1. test環境にデプロイ
./scripts/deploy.sh test

# 2. テスト実行
./scripts/regression-test.sh
# → 選択肢1 (test) を選択

# 3. 環境削除
./scripts/destroy.sh test
```

### 個別コンポーネントのテスト

```bash
# ネットワークのみ
./scripts/deploy.sh test --stacks web3cdk-test-network

# Cache APIのみ
./scripts/deploy.sh test --stacks web3cdk-test-cache-api

# 個別削除
./scripts/destroy.sh test --stacks web3cdk-test-cache-api
```

### 設定のカスタマイズ

```bash
# test環境設定をカスタマイズ
cp .env.dev .env.test
vim .env.test

# 特定の設定でテスト
CDK_ENV=test ./scripts/deploy.sh test
```

## 🔧 運用管理

### ライフサイクル管理

#### 作成
```bash
# test環境の初回作成
./scripts/deploy.sh test
```

#### 更新
```bash
# 設定変更後の更新
./scripts/deploy.sh test
```

#### 削除
```bash
# 通常削除
./scripts/destroy.sh test

# 強制削除（リグレッションテスト用）
./scripts/destroy.sh test -f
```

### モニタリング

#### リソース確認
```bash
# スタック一覧
aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, `test`)]'

# 詳細調査
./scripts/investigate-stack.sh test network
```

#### コスト監視
```bash
# test環境のリソースタグでフィルタリング
aws ce get-cost-and-usage \
  --time-period Start=2025-07-01,End=2025-07-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## 🔒 セキュリティ考慮事項

### 1. 機密情報の扱い

- **本番データ使用禁止**: テスト用ダミー値を使用
- **APIキー分離**: 本番APIキーとは別のテスト用キーを使用
- **アクセス制限**: 必要最小限の権限のみ

### 2. ネットワーク設定

```bash
# テスト環境では緩い設定
ADMIN_CIDR=0.0.0.0/0  # 本番では適切なCIDRに制限

# セキュリティグループ
# - SSH: 0.0.0.0/0 (テスト環境のみ)
# - HTTP/HTTPS: 0.0.0.0/0
# - 8545: 0.0.0.0/0 (Gethポート)
```

### 3. データ保護

- **暗号化**: DynamoDBとS3の暗号化は本番と同等
- **バックアップ**: テスト環境は定期バックアップ不要
- **削除**: テスト完了後は確実にリソース削除

## ⚡ パフォーマンス最適化

### 1. デプロイ時間短縮

```bash
# 並行デプロイ（注意: 依存関係を考慮）
./scripts/deploy.sh test --stacks web3cdk-test-network &
wait
./scripts/deploy.sh test --stacks web3cdk-test-storage &
./scripts/deploy.sh test --stacks web3cdk-test-cache-api &
wait
```

### 2. リソース最適化

- **EC2インスタンス**: 最小サイズ (t3.micro)
- **DynamoDB**: オンデマンド課金
- **Lambda**: 最小メモリ設定

### 3. コスト最適化

```bash
# 一時的なリソースの自動削除設定
TEST_CLEANUP_ON_FAILURE=true
TEST_AUTO_CLEANUP_HOURS=24  # 24時間後自動削除
```

## 🔄 CI/CD統合

### GitHub Actions設定例

```yaml
name: Test Environment
on:
  push:
    branches: [develop]

jobs:
  test-environment:
    runs-on: ubuntu-latest
    environment: test
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
          
      - name: Deploy to test
        run: |
          export REGRESSION_TEST=true
          ./scripts/deploy.sh test
          
      - name: Run tests
        run: |
          # API テスト
          curl -f https://$(aws cloudformation describe-stacks --stack-name web3cdk-test-cache-api --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
          
      - name: Cleanup
        if: always()
        run: |
          export REGRESSION_TEST=true
          ./scripts/destroy.sh test -f
```

### Jenkins Pipeline例

```groovy
pipeline {
    agent any
    
    environment {
        AWS_REGION = 'ap-northeast-1'
        REGRESSION_TEST = 'true'
    }
    
    stages {
        stage('Deploy Test Environment') {
            steps {
                sh './scripts/deploy.sh test'
            }
        }
        
        stage('Run Tests') {
            steps {
                sh './scripts/regression-test.sh'
            }
        }
        
        stage('Cleanup') {
            steps {
                sh './scripts/destroy.sh test -f'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'docs/testing/test-results/**/*', fingerprint: true
                }
            }
        }
    }
}
```

## 🚨 トラブルシューティング

### よくある問題

#### 1. リソース名の競合
```bash
# スタック名の重複確認
aws cloudformation describe-stacks --stack-name web3cdk-test-network

# 強制削除して再作成
./scripts/destroy.sh test -f
./scripts/deploy.sh test
```

#### 2. 権限エラー
```bash
# IAM権限確認
aws iam get-user
aws iam list-attached-user-policies --user-name $(aws sts get-caller-identity --query User.UserName --output text)
```

#### 3. タイムアウト
```bash
# 手動でのステップ実行
./scripts/deploy.sh test --stacks web3cdk-test-network
./scripts/deploy.sh test --stacks web3cdk-test-storage
./scripts/deploy.sh test --stacks web3cdk-test-cache-api
./scripts/deploy.sh test --stacks web3cdk-test-bot-api
```

### デバッグ方法

#### ログレベル設定
```bash
# 詳細ログ出力
export CDK_DEBUG=true
./scripts/deploy.sh test
```

#### CloudFormationイベント確認
```bash
# スタックイベント確認
aws cloudformation describe-stack-events --stack-name web3cdk-test-network
```

## 📊 メトリクス・監視

### CloudWatchメトリクス

#### Lambda関数
- 実行時間
- エラー率
- 実行回数

#### DynamoDB
- 読み取り/書き込み容量
- スロットリング
- エラー率

#### API Gateway
- レスポンス時間
- リクエスト数
- エラー率

### アラート設定

```bash
# エラー率が高い場合のアラート
aws cloudwatch put-metric-alarm \
  --alarm-name "test-lambda-error-rate" \
  --alarm-description "Test Lambda error rate high" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=web3cdk-test-cache-api
```

## 🔗 関連リソース

- [リグレッションテスト実行ガイド](./regression-test-guide.md)
- [環境設定ドキュメント](../guides/cdk-manual.md)
- [セキュリティガイドライン](../design/application-architecture.md)
- [コスト最適化ガイド](../development/development-learnings.md)