# Gethプライベートチェーン構築環境 - 詳細仕様書

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [インフラストラクチャ構成](#インフラストラクチャ構成)
3. [Gethプライベートチェーン仕様](#gethプライベートチェーン仕様)
4. [セキュリティ設定](#セキュリティ設定)
5. [環境変数一覧](#環境変数一覧)
6. [デプロイプロセス](#デプロイプロセス)
7. [運用手順](#運用手順)
8. [トラブルシューティング](#トラブルシューティング)

## アーキテクチャ概要

本システムは、AWS CDKを使用して以下のコンポーネントを自動構築します：

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │     Lambda        │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐
│   DynamoDB     │  │       S3        │  │      EC2        │
│                │  │                 │  │   (Geth Node)   │
└────────────────┘  └─────────────────┘  └─────────────────┘
```

## インフラストラクチャ構成

### VPC構成
- **CIDR**: 10.0.0.0/16
- **サブネット**: パブリックサブネット x 2 AZ
- **インターネットゲートウェイ**: 自動作成

### EC2インスタンス
- **インスタンスタイプ**: t3.small
- **OS**: Amazon Linux 2023
- **インストール済みソフトウェア**:
  - Geth 1.11.6
  - Node.js (最新安定版)
  - Apache httpd + mod_ssl
  - python3-certbot-apache（Let's Encrypt SSL証明書用）
  - 開発ツール: tmux, htop, tree, vim, jq, net-tools, nmap-ncat, bind-utils

### セキュリティグループ
| ポート | プロトコル | 用途 | デフォルト設定 |
|--------|------------|------|----------------|
| 22 | TCP | SSH | 0.0.0.0/0 (要制限) |
| 80 | TCP | HTTP (Apache) | 0.0.0.0/0 |
| 8545 | TCP | Geth RPC | 0.0.0.0/0 (要制限) |
| 8546 | TCP | Geth WebSocket | 0.0.0.0/0 (要制限) |

### その他のリソース
- **S3バケット**: `bonsoleil-s3-{environment}`
- **DynamoDBテーブル**: `bonsoleil-table-{environment}`
- **Lambda関数**: `bonsoleil-api-function-{environment}`
- **API Gateway**: REST API (プロキシ統合)

## Gethプライベートチェーン仕様

### ネットワーク設定
- **Chain ID**: 21201
- **コンセンサスアルゴリズム**: Clique (Proof of Authority)
- **ブロック生成間隔**: 0秒（即時）
- **エポック長**: 30000ブロック

### Genesis Block設定
```json
{
  "config": {
    "chainId": 21201,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "clique": {
      "period": 0,
      "epoch": 30000
    }
  },
  "alloc": {
    "0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248": {
      "balance": "500000000000000000000000"
    }
  },
  "difficulty": "0x1",
  "extraData": "0x000000000000000000000000000000000000000000000000000000000000000059d2e0E4DCf3Dc47e83364D4E9A91b310e7132480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "gasLimit": "0x632EA0",
  "nonce": "0x0000000000000042",
  "mixhash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "timestamp": "0x00"
}
```

**重要なポイント:**
- `extraData`: Clique PoAの署名者アドレスを含む（32バイト0 + 20バイトアドレス + 65バイト0）
- `alloc`: 初期残高を設定するアカウント

### Geth起動オプション
```bash
geth --datadir /opt/geth/data \
     --networkid 21201 \
     --http --http.addr 0.0.0.0 --http.port 8545 \
     --http.corsdomain "*" \
     --http.api eth,net,web3,personal,miner \
     --ws --ws.addr 0.0.0.0 --ws.port 8546 \
     --ws.origins "*" \
     --allow-insecure-unlock \
     --mine --miner.threads=1 \
     --miner.etherbase 0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 \
     --nodiscover
```

**重要な設定項目:**
- `--miner.etherbase`: マイニング報酬の受取先アドレス（**必須**）
- `--mine --miner.threads=1`: マイニングを有効化
- `--nodiscover`: ピア検出を無効化（プライベートチェーン用）

### Geth自動起動設定
Gethはsystemdサービスとして自動起動するよう設定されます：

```ini
[Unit]
Description=Geth Ethereum Node
After=network.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=/opt/geth
ExecStart=/usr/local/bin/geth --datadir data --networkid 21201 --http --http.addr 0.0.0.0 --http.port 8545 --http.corsdomain "*" --http.api eth,net,web3,personal,miner --ws --ws.addr 0.0.0.0 --ws.port 8546 --ws.api eth,net,web3,personal,miner --ws.origins "*" --allow-insecure-unlock --mine --miner.threads 1 --miner.etherbase 0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 --nodiscover
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- **自動起動**: システム起動時に自動でGethが開始
- **自動復旧**: プロセス異常終了時に10秒後に再起動
- **ログ出力**: journaldでログ管理（`journalctl -u geth`で確認可能）

## セキュリティ設定

### IAMロール
EC2インスタンスには以下のポリシーが付与されます：
- `AmazonSSMManagedInstanceCore` (Systems Manager接続用)

### 推奨セキュリティ設定

1. **本番環境でのIP制限**
   ```typescript
   // セキュリティグループの設定例
   gethSecurityGroup.addIngressRule(
     ec2.Peer.ipv4('YOUR_IP/32'),  // 特定IPのみ許可
     ec2.Port.tcp(8545),
     'Geth RPC port - Restricted'
   );
   ```

2. **秘密鍵の管理**
   - AWS Secrets Managerの使用を推奨
   - 環境変数での管理は開発環境のみ

## 環境変数一覧

| 変数名 | 説明 | デフォルト値 | 必須 |
|--------|------|--------------|------|
| `GETH_ADDRESS` | Gethアカウントアドレス | 0x18adb29cbb83e7eb95953b7cae542119e8b9ad56 | ○ |
| `GETH_PRIVATE_KEY` | アカウントの秘密鍵 | - | ○ |
| `GETH_PASSWORD` | キーストアパスワード | - | ○ |
| `GETH_INITIAL_BALANCE` | 初期残高（wei） | 500000000000000000000000 | - |
| `EC2_KEY_NAME` | SSH用キーペア名 | - | - |
| `AWS_REGION` | AWSリージョン | ap-northeast-1 | - |

## デプロイプロセス

### 1. 事前準備
```bash
# AWS CLIの設定確認
aws configure list

# CDK Bootstrap（初回のみ）
npx cdk bootstrap
```

### 2. 環境変数設定
```bash
# .env.dev の作成
cp .env.example .env.dev
# エディタで必要な値を設定
```

### 3. デプロイ実行
```bash
# ビルド
npm run build

# デプロイ（開発環境）
npm run deploy:dev
```

### 4. デプロイ確認
```bash
# CloudFormationスタックの確認
aws cloudformation describe-stacks --stack-name bonsoleil-cdk-dev

# 出力値の取得
aws cloudformation describe-stacks \
  --stack-name bonsoleil-cdk-dev \
  --query 'Stacks[0].Outputs' \
  --output table
```

## 運用手順

### EC2インスタンスへのSSH接続
```bash
# 出力されたSSHコマンドを使用
ssh -i ~/.ssh/{key-name}.pem ec2-user@{public-ip}

# Gethコンソールへの接続
sudo -u geth geth attach /var/lib/geth/geth.ipc
```

### ログの確認
```bash
# UserDataの実行ログ
sudo cat /var/log/user-data.log

# Gethサービスのログ
sudo journalctl -u geth -f

# システムログ
sudo tail -f /var/log/messages
```

### Gethの操作
```javascript
// Gethコンソール内での操作例
> eth.blockNumber
> eth.accounts
> personal.newAccount("password")
> eth.sendTransaction({from: eth.accounts[0], to: "0x...", value: web3.toWei(1, "ether")})
```

### バックアップとリストア
```bash
# データディレクトリのバックアップ
sudo tar -czf geth-backup-$(date +%Y%m%d).tar.gz /var/lib/geth

# リストア
sudo systemctl stop geth
sudo tar -xzf geth-backup-20231201.tar.gz -C /
sudo systemctl start geth
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Gethが起動しない

```bash
# エラーログ確認
sudo journalctl -u geth --no-pager | tail -10

# サービスステータス確認
sudo systemctl status geth
```

**よくあるエラーと解決方法:**

| エラーメッセージ | 原因 | 解決方法 |
|------------------|------|----------|
| "etherbase must be explicitly specified" | `--miner.etherbase`オプション未設定 | systemdサービスファイルにetherbaseを追加 |
| "can't start clique chain without signers" | genesis.jsonのextraDataが空 | extraDataに署名者アドレスを設定 |
| "Fatal: Failed to write genesis block" | genesis.jsonの形式エラー | genesis.jsonの構文を確認 |

**手動デバッグ:**
```bash
# 手動起動でエラー詳細確認
sudo -u ec2-user /usr/local/bin/geth --datadir /opt/geth/data --networkid 21201
```

#### 2. キーストアインポートエラー
```bash
# キーストアディレクトリ確認
ls -la /var/lib/geth/keystore/

# パーミッション修正
sudo chown -R geth:geth /var/lib/geth
```

#### 3. RPC接続できない
```bash
# ポート確認
sudo netstat -tlnp | grep 8545

# ファイアウォール確認
sudo iptables -L -n
```

#### 4. SSL証明書の問題

**症状**: HTTPS接続できない、certbotコマンドが見つからない

```bash
# certbotインストール状況確認
which certbot-3
ls -la /usr/bin/certbot*

# Amazon Linux 2023での正しい方法
sudo dnf install -y python3-certbot-apache

# 手動でSSL証明書取得
sudo /usr/bin/certbot-3 --apache -d your-domain.com --email your-email@example.com --agree-tos --non-interactive --redirect
```

**重要**: Amazon Linux 2023では実行ファイルは`/usr/bin/certbot-3`

#### 5. EC2インスタンスにSSH接続できない
- セキュリティグループの設定確認
- キーペアの確認（EC2_KEY_NAME環境変数の設定確認）
- インスタンスのパブリックIP確認
- ElasticIPの関連付け確認

### パフォーマンスチューニング

#### EC2インスタンスサイズの変更
```typescript
// lib/my-cdk-app-stack.ts
instanceType: ec2.InstanceType.of(
  ec2.InstanceClass.T3, 
  ec2.InstanceSize.MEDIUM  // SMALLから変更
),
```

#### Gethのメモリ設定
```bash
# systemdサービスファイルに追加
Environment="GETH_CACHE=2048"
```

### 監視設定

CloudWatchメトリクスの推奨設定：
- CPU使用率: 80%以上で警告
- ディスク使用率: 90%以上で警告
- メモリ使用率: 80%以上で警告

## 付録

### 関連ドキュメント
- [Geth公式ドキュメント](https://geth.ethereum.org/docs)
- [AWS CDK API Reference](https://docs.aws.amazon.com/cdk/api/latest/)
- [Clique PoAの仕様](https://github.com/ethereum/EIPs/issues/225)

### 更新履歴
- 2024-01-26: 初版作成
- Amazon Linux 2023対応
- Node.js/Apache httpd追加
- SSH接続機能追加
- 2025-07-03: 実装時の問題対応を追加
  - Geth etherbase設定の必須化（--miner.etherbase）
  - Clique PoA のsigner設定（extraData）
  - Amazon Linux 2023でのcertbot正しいインストール方法（/usr/bin/certbot-3）
  - トラブルシューティング強化