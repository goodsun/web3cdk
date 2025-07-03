# CDK スタックテスト仕様書

## 概要

各CDKスタックのデプロイ後に実施すべきテスト項目を定義します。
これらのテストにより、スタックが正しくデプロイされ、期待通りに動作することを確認します。

---

## 1. Network Stack テスト仕様

### テスト目的
- VPCとネットワークリソースが正しく作成されていること
- セキュリティグループが適切に設定されていること
- 他スタックから参照可能な状態であること

### テスト項目

#### 1.1 VPC作成確認
```bash
# VPCの存在確認
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=web3cdk" "Name=tag:Environment,Values=dev" \
  --query 'Vpcs[*].[VpcId,CidrBlock,State]' \
  --output table
```
**期待値**: 10.0.0.0/16のCIDRブロックを持つVPCが"available"状態で存在

#### 1.2 サブネット確認
```bash
# パブリック・プライベートサブネットの確認
aws ec2 describe-subnets \
  --filters "Name=tag:Project,Values=web3cdk" \
  --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```
**期待値**: 
- パブリックサブネット×2（異なるAZ）
- プライベートサブネット×2（異なるAZ）

#### 1.3 セキュリティグループ確認
```bash
# セキュリティグループとルールの確認
aws ec2 describe-security-groups \
  --filters "Name=tag:Project,Values=web3cdk" \
  --query 'SecurityGroups[*].{
    GroupId:GroupId,
    GroupName:GroupName,
    InboundRules:IpPermissions[*].[FromPort,ToPort,IpProtocol,IpRanges[0].CidrIp]
  }'
```
**期待値**: 以下のインバウンドルールが設定されている
- 22/tcp (SSH): 0.0.0.0/0
- 80/tcp (HTTP): 0.0.0.0/0
- 443/tcp (HTTPS): 0.0.0.0/0
- 8545/tcp (Geth RPC): 0.0.0.0/0

#### 1.4 インターネットゲートウェイ確認
```bash
# IGWの存在とアタッチメント確認
aws ec2 describe-internet-gateways \
  --filters "Name=tag:Project,Values=web3cdk" \
  --query 'InternetGateways[*].[InternetGatewayId,Attachments[0].VpcId,Attachments[0].State]' \
  --output table
```
**期待値**: VPCにアタッチされたIGWが"available"状態で存在

#### 1.5 CloudFormation出力確認
```bash
# エクスポートされた値の確認
aws cloudformation describe-stacks \
  --stack-name web3cdk-dev-network \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue,ExportName]' \
  --output table
```
**期待値**: VPCとセキュリティグループのIDがエクスポートされている

---

## 2. Storage Stack テスト仕様

### テスト目的
- S3バケットが正しく作成されていること
- 適切なセキュリティ設定がされていること
- バックアップ用の設定が有効であること

### テスト項目

#### 2.1 S3バケット存在確認
```bash
# バケットの存在確認
aws s3 ls | grep web3cdk-dev-storage
```
**期待値**: web3cdk-dev-storage-[ランダム文字列]のバケットが存在

#### 2.2 バケット設定確認
```bash
# バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name web3cdk-dev-storage \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text)

# バージョニング確認
aws s3api get-bucket-versioning --bucket $BUCKET_NAME

# 暗号化確認
aws s3api get-bucket-encryption --bucket $BUCKET_NAME

# ライフサイクル確認
aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET_NAME
```
**期待値**:
- バージョニング: 有効
- 暗号化: AES256またはKMS
- ライフサイクル: 設定されている（必要に応じて）

#### 2.3 バケットポリシー確認
```bash
# バケットポリシーの確認
aws s3api get-bucket-policy --bucket $BUCKET_NAME
```
**期待値**: 適切なアクセス制限が設定されている

---

## 3. EC2 Stack テスト仕様

### テスト目的
- EC2インスタンスが正しく起動していること
- ElasticIPが関連付けられていること
- 必要なソフトウェアがインストールされていること
- Gethが正常に動作していること

### テスト項目

#### 3.1 インスタンス状態確認
```bash
# インスタンスの確認
aws ec2 describe-instances \
  --filters "Name=tag:Project,Values=web3cdk" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```
**期待値**: running状態のインスタンスが存在

#### 3.2 ElasticIP確認
```bash
# ElasticIPの関連付け確認
aws ec2 describe-addresses \
  --filters "Name=tag:Project,Values=web3cdk" \
  --query 'Addresses[*].[PublicIp,InstanceId,AssociationId]' \
  --output table
```
**期待値**: ElasticIPがインスタンスに関連付けられている

#### 3.3 SSH接続テスト
```bash
# SSH接続（キーファイルパスは環境に応じて変更）
ssh -i ~/.ssh/web3cdk-dev.pem ec2-user@[ElasticIP] "echo 'SSH connection successful'"
```
**期待値**: 接続成功

#### 3.4 インストール済みソフトウェア確認
```bash
# SSHで接続後、以下を実行
ssh -i ~/.ssh/web3cdk-dev.pem ec2-user@[ElasticIP] << 'EOF'
echo "=== Apache Status ==="
sudo systemctl status httpd | head -3
echo "=== Geth Version ==="
geth version | head -3
echo "=== Geth Service Status ==="
sudo systemctl status geth | head -3
echo "=== SSL Certificate ==="
sudo ls -la /etc/letsencrypt/live/
EOF
```
**期待値**:
- Apache: active (running)
- Geth: Version 1.11.6
- Geth Service: active (running)
- SSL証明書: ドメイン名のディレクトリが存在

#### 3.5 Geth RPC接続テスト
```bash
# Geth RPCエンドポイントテスト
curl -X POST http://[ElasticIP]:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq .
```
**期待値**: ブロック番号が返される

#### 3.6 HTTPS接続テスト
```bash
# HTTPS接続確認（ドメインが設定されている場合）
curl -Is https://[ドメイン名] | head -1
```
**期待値**: HTTP/2 200 または HTTP/1.1 200 OK

---

## 4. Bot API Stack テスト仕様

### テスト目的
- Lambda関数が正しくデプロイされていること
- API Gatewayが適切に設定されていること
- DynamoDBテーブルが作成されていること
- エンドポイントが応答すること

### テスト項目

#### 4.1 Lambda関数確認
```bash
# Lambda関数の存在確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `bot-api`)].{Name:FunctionName,Runtime:Runtime,State:State}' \
  --output table

# 環境変数の確認
FUNCTION_NAME=$(aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `bot-api`)].FunctionName' \
  --output text)
aws lambda get-function-configuration \
  --function-name $FUNCTION_NAME \
  --query 'Environment.Variables'
```
**期待値**:
- 関数が"Active"状態
- 必要な環境変数が設定されている（DISCORD_PUBLIC_KEY等）

#### 4.2 DynamoDBテーブル確認
```bash
# テーブルの存在確認
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `web3cdk-dev`)]' \
  --output table

# 各テーブルの詳細確認
for table in bot-api discord-eoa registration-tokens want-requests conversations; do
  echo "=== web3cdk-dev-$table ==="
  aws dynamodb describe-table \
    --table-name "web3cdk-dev-$table" \
    --query 'Table.{TableName:TableName,ItemCount:ItemCount,TableStatus:TableStatus,KeySchema:KeySchema[*].[AttributeName,KeyType]}'
done
```
**期待値**:
- 5つのテーブルがACTIVE状態
- 正しいパーティションキーが設定されている

#### 4.3 API Gateway確認
```bash
# API Gatewayの確認
API_URL=$(aws cloudformation describe-stacks \
  --stack-name web3cdk-dev-bot-api \
  --query 'Stacks[0].Outputs[?OutputKey==`BotApiUrl`].OutputValue' \
  --output text)

# ヘルスチェック
curl -s $API_URL/health | jq .

# エンドポイント一覧
curl -s $API_URL | jq .
```
**期待値**:
- ヘルスチェックが成功
- エンドポイント一覧が表示される

#### 4.4 Discord Bot機能テスト
```bash
# Discord署名検証のテスト（モック）
curl -X POST $API_URL/discord \
  -H "Content-Type: application/json" \
  -d '{"type": 1}'
```
**期待値**: 401エラー（署名なしのため）

---

## 5. Cache API Stack テスト仕様

### テスト目的
- Lambda関数とイベントモニターが正しくデプロイされていること
- API Gatewayが適切に設定されていること
- DynamoDBキャッシュテーブルが作成されていること
- EventBridgeルールが設定されていること

### テスト項目

#### 5.1 Lambda関数確認
```bash
# Cache API関数の確認
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `cache`)].{Name:FunctionName,State:State}' \
  --output table
```
**期待値**: CacheApiとCacheEventMonitorの2つの関数が存在

#### 5.2 EventBridgeルール確認
```bash
# 定期実行ルールの確認
aws events list-rules \
  --query 'Rules[?contains(Name, `cache`)].{Name:Name,State:State,ScheduleExpression:ScheduleExpression}' \
  --output table
```
**期待値**: 5分ごとに実行されるルールが有効

#### 5.3 API エンドポイントテスト
```bash
# API URLの取得
CACHE_API_URL=$(aws cloudformation describe-stacks \
  --stack-name web3cdk-dev-cache-api \
  --query 'Stacks[0].Outputs[?OutputKey==`CacheApiUrl`].OutputValue' \
  --output text)

# ヘルスチェック
curl -s $CACHE_API_URL | jq .

# キャッシュデータ取得テスト（コントラクトアドレスは例）
curl -s $CACHE_API_URL/contract/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D | jq .
```
**期待値**:
- APIが応答する
- 適切なJSONレスポンスが返る


---

## テスト実行の自動化

### 統合テストスクリプト例

```bash
#!/bin/bash
# test-stack.sh

STACK_NAME=$1
ENVIRONMENT=${2:-dev}

case $STACK_NAME in
  network)
    echo "Testing Network Stack..."
    # Network Stack のテストコマンドを実行
    ;;
  storage)
    echo "Testing Storage Stack..."
    # Storage Stack のテストコマンドを実行
    ;;
  bot-api)
    echo "Testing Bot API Stack..."
    # Bot API Stack のテストコマンドを実行
    ;;
  cache-api)
    echo "Testing Cache API Stack..."
    # Cache API Stack のテストコマンドを実行
    ;;
  ec2)
    echo "Testing EC2 Stack..."
    # EC2 Stack のテストコマンドを実行
    ;;
  *)
    echo "Usage: $0 {network|storage|bot-api|cache-api|ec2} [environment]"
    exit 1
    ;;
esac
```

---

## トラブルシューティング

### 共通の問題と対処法

1. **リソースが見つからない**
   - タグフィルターが正しいか確認
   - スタック名が正しいか確認
   - リージョンが正しいか確認

2. **権限エラー**
   - IAMロールの権限を確認
   - AWS CLIの認証情報を確認

3. **接続エラー**
   - セキュリティグループの設定を確認
   - ネットワークACLを確認
   - インスタンスの状態を確認

---

## 継続的なモニタリング

デプロイ後も以下の項目を定期的に確認：

1. **CloudWatch メトリクス**
   - Lambda関数の実行回数とエラー率
   - API Gatewayのレスポンスタイム
   - EC2インスタンスのCPU/メモリ使用率

2. **コスト監視**
   - 各スタックのコスト追跡
   - 異常な使用量の検出

3. **セキュリティ監査**
   - セキュリティグループの定期的な見直し
   - 不要なリソースの削除