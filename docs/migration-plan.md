# Web3 CDK 構成移植計画書

## 概要
レガシーCDKシステムの構成をクリーンな環境へ移植する計画書。
データ移行は不要で、インフラ構成のみを再構築します。

## 移植戦略
EC2インスタンスとドメイン設定を最初に行い、後続のサービス（Lambda、Geth RPC）のエンドポイントとなるドメインを事前に確立します。

## フェーズ別実装計画

### Phase 1: EC2インスタンスとドメイン・SSL設定 【最優先】
**期間**: 1日
**目的**: 全サービスの基盤となるドメインとSSL環境を確立

#### 実装内容
1. **VPCとネットワーク設定**
   ```typescript
   - VPC（10.0.0.0/16）
   - パブリックサブネット
   - インターネットゲートウェイ
   - セキュリティグループ
   ```

2. **EC2インスタンス**
   ```typescript
   - Amazon Linux 2023
   - t3.small
   - Apache HTTP Server
   - Node.js環境
   - Claude Code開発環境
   ```

3. **ドメイン・SSL設定**
   ```typescript
   - Elastic IP（オプション）
   - Let's Encrypt SSL証明書
   - Apache リバースプロキシ設定
   ```

#### 必要な環境変数
```bash
EC2_KEY_NAME=your-key-pair-name
DOMAIN_NAME=your-domain.com
EMAIL=admin@your-domain.com
USE_ELASTIC_IP=true
ELASTIC_IP_ALLOCATION_ID=eipalloc-xxxxx  # 既存のEIPを使用する場合
```

#### 成果物
- `lib/constructs/network-stack.ts`
- `lib/constructs/ec2-stack.ts`
- SSL証明書設定完了
- HTTPSアクセス可能なドメイン

### Phase 2: 基本インフラストラクチャ（S3、DynamoDB）
**期間**: 1日
**目的**: データ層の構築

#### 実装内容
1. **S3バケット**
   ```typescript
   - バージョニング有効
   - 暗号化（S3_MANAGED）
   - 自動削除設定
   ```

2. **DynamoDBテーブル（5つ）**
   ```typescript
   - メインテーブル（id, timestamp）
   - Discord EOAマッピング（discord_id）
   - 登録トークン（token, TTL付き）
   - Wantリクエスト（request_id, TTL付き）
   - 会話テーブル（conversation_id）
   ```

#### 成果物
- `lib/constructs/storage-stack.ts`
- `lib/constructs/database-stack.ts`

### Phase 3: Lambda関数とAPI Gateway
**期間**: 1-2日
**目的**: APIサービス層の構築

#### 実装内容
1. **Lambda関数**
   ```typescript
   - Node.js 22.x
   - Express.js統合
   - DynamoDBアクセス
   - Discord Bot機能
   ```

2. **API Gateway**
   ```typescript
   - REST API
   - CORS設定
   - Lambda統合
   - カスタムドメイン統合
   ```

#### 成果物
- `lib/constructs/lambda-stack.ts`
- `lib/constructs/api-gateway-stack.ts`
- `lambda/` ディレクトリ

### Phase 4: Gethブロックチェーン設定
**期間**: 1日
**目的**: プライベートブロックチェーンの構築

#### 実装内容
1. **Geth設定**
   ```typescript
   - プライベートネットワーク
   - Chain ID: 21201
   - RPC/WSエンドポイント
   - マイニング設定
   ```

2. **システムサービス**
   ```typescript
   - systemdサービス設定
   - 自動起動設定
   - ログ管理
   ```

#### 成果物
- Gethブロックチェーン稼働
- RPC/WSエンドポイント公開

### Phase 5: 統合テストと最終調整
**期間**: 1日
**目的**: 全体の動作確認と最適化

#### 実装内容
- エンドツーエンドテスト
- パフォーマンスチューニング
- セキュリティ設定の確認
- ドキュメント整備

## 実装順序の根拠

1. **EC2・ドメイン優先の理由**
   - SSL証明書の発行には時間がかかる可能性がある
   - 後続サービスのエンドポイントURLが事前に確定する
   - 開発環境が早期に利用可能になる

2. **段階的な構築**
   - 各フェーズが独立して動作確認可能
   - 問題の早期発見と修正が可能
   - ロールバックが容易

## 次のステップ

1. 環境変数の準備（特にドメイン名の決定）
2. Phase 1のEC2スタック実装開始
3. ドメインのDNS設定準備