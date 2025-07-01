# Web3 CDK 移植手順書

## 前提条件
- ✅ CDK Bootstrap 完了
- AWS CLI 設定済み
- Node.js 環境準備済み

## Phase 1: EC2インスタンスとドメイン・SSL設定

### ステップ1: 環境変数の準備

#### 1-1. setup.shを実行
```bash
npm run setup dev
```

#### 1-2. .env.devファイルを編集
setup.sh実行後、以下の値を設定してください：

```bash
# 自動設定される項目
EC2_KEY_NAME=web3cdk-dev    # PROJECT_NAME-CDK_ENVで自動生成
ADMIN_CIDR=xxx.xxx.xxx.xxx/32  # 現在のIPで自動設定

# オプション設定
USE_ELASTIC_IP=true
ELASTIC_IP_ALLOCATION_ID=eipalloc-xxxxx  # 既存EIPがある場合のみ

# Phase 4で使用（今は設定不要）
DOMAIN_NAME=your-domain.com
EMAIL=admin@your-domain.com
```

#### 1-3. AWSキーペアの確認・作成
キーペア名は自動生成されます（例：web3cdk-dev）

```bash
# 自動生成されたキーペア名の確認
source .env.dev
echo "キーペア名: $EC2_KEY_NAME"

# 既存キーペアの確認
aws ec2 describe-key-pairs --key-names $EC2_KEY_NAME --region ap-northeast-1

# 存在しない場合は新規作成
aws ec2 create-key-pair --key-name $EC2_KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/${EC2_KEY_NAME}.pem
chmod 400 ~/.ssh/${EC2_KEY_NAME}.pem
```

### ステップ2: ネットワーク構成の実装
```bash
# VPCスタックの作成
lib/constructs/network-stack.ts
```

**実装内容:**
- VPC (10.0.0.0/16)
- パブリックサブネット
- インターネットゲートウェイ
- セキュリティグループ

### ステップ3: EC2インスタンスの実装
```bash
# EC2スタックの作成
lib/constructs/ec2-stack.ts
```

**実装内容:**
- Amazon Linux 2023
- t3.small インスタンス
- Apache HTTP Server
- Node.js 環境
- Claude Code 開発環境

### ステップ4: ドメインとSSL設定
**手動作業:**
1. Elastic IP の割り当て
2. ドメインのDNS設定
3. Let's Encrypt SSL証明書取得
4. Apache リバースプロキシ設定

### ステップ5: Phase 1のデプロイ

#### 5-1. 環境変数の読み込み
```bash
source .env.dev
```

#### 5-2. メインスタックのデプロイ
```bash
npm run deploy:dev
```

#### 5-3. デプロイ結果の確認
デプロイ完了後、以下の出力を確認：
- VPC ID
- EC2 Instance ID  
- Public IP Address
- SSH Connection Command

#### 5-4. SSH接続テスト
```bash
# 出力されたSSH接続コマンドを実行
ssh -i ~/.ssh/[your-key-name].pem ec2-user@[public-ip]
```

**確認項目:**
- [ ] EC2インスタンス起動確認
- [ ] SSH接続確認
- [ ] Apache起動確認 (`systemctl status httpd`)
- [ ] Node.js動作確認 (`node --version`)

## Phase 2: 基本インフラストラクチャ

### ステップ5: S3バケットの作成
```bash
# ストレージスタックの作成
lib/constructs/storage-stack.ts
```

**実装内容:**
- バージョニング有効
- 暗号化 (S3_MANAGED)
- 自動削除設定

### ステップ6: DynamoDBテーブルの作成
```bash
# データベーススタックの作成
lib/constructs/database-stack.ts
```

**実装するテーブル:**
- メインテーブル (id, timestamp)
- Discord EOAマッピング (discord_id)
- 登録トークン (token, TTL付き)
- Wantリクエスト (request_id, TTL付き)
- 会話テーブル (conversation_id)

## Phase 3: Lambda関数とAPI Gateway

### ステップ7: Lambda関数の実装
```bash
# Lambdaスタックの作成
lib/constructs/lambda-stack.ts
lambda/ ディレクトリ
```

**実装内容:**
- Node.js 22.x
- Express.js統合
- DynamoDBアクセス
- Discord Bot機能

### ステップ8: API Gatewayの設定
```bash
# API Gatewayスタックの作成
lib/constructs/api-gateway-stack.ts
```

**実装内容:**
- REST API
- CORS設定
- Lambda統合
- カスタムドメイン統合

## Phase 4: Gethブロックチェーン設定

### ステップ9: Geth設定
**EC2内での作業:**
- プライベートネットワーク設定
- Chain ID: 21201
- RPC/WSエンドポイント設定
- マイニング設定

### ステップ10: システムサービス設定
- systemdサービス設定
- 自動起動設定
- ログ管理設定

## Phase 5: 統合テストと最終調整

### ステップ11: エンドツーエンドテスト
- 全機能の動作確認
- パフォーマンステスト
- セキュリティ設定確認

### ステップ12: ドキュメント整備
- API仕様書更新
- 運用手順書作成
- トラブルシューティングガイド

## チェックリスト

### Phase 1 完了確認
- [ ] VPC作成完了
- [ ] EC2インスタンス起動
- [ ] SSL証明書取得
- [ ] ドメインアクセス確認

### Phase 2 完了確認
- [ ] S3バケット作成
- [ ] DynamoDBテーブル5つ作成
- [ ] データアクセステスト

### Phase 3 完了確認
- [ ] Lambda関数デプロイ
- [ ] API Gateway設定
- [ ] エンドポイントテスト

### Phase 4 完了確認
- [ ] Gethブロックチェーン起動
- [ ] RPC/WSエンドポイント確認
- [ ] マイニング動作確認

### Phase 5 完了確認
- [ ] 全機能統合テスト
- [ ] パフォーマンス確認
- [ ] ドキュメント完成

## 緊急時対応

### ロールバック手順
各Phaseで問題が発生した場合:
```bash
# スタック削除
npx cdk destroy [stack-name]

# 前のPhaseに戻る
git checkout [previous-phase-tag]
```

### トラブルシューティング
- CloudFormationスタック確認
- CloudWatchログ確認
- IAMロール・ポリシー確認
- VPCネットワーク設定確認

## 推定期間
- Phase 1: 1日
- Phase 2: 1日  
- Phase 3: 1-2日
- Phase 4: 1日
- Phase 5: 1日

**合計: 5-6日**