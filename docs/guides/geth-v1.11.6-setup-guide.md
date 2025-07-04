# Geth v1.11.6 詳細設定・起動ガイド

このドキュメントでは、Geth v1.11.6を使用したプライベートブロックチェーンの構築方法について、特にPoA（Proof of Authority）のClique合意アルゴリズムを使用した設定を詳細に説明します。

## 目次
1. [バージョン情報](#バージョン情報)
2. [genesis.jsonの詳細解説](#genesisjsonの詳細解説)
3. [アカウントとキーストアの設定](#アカウントとキーストアの設定)
4. [Geth起動コマンドの詳細](#geth起動コマンドの詳細)
5. [トラブルシューティング](#トラブルシューティング)

## バージョン情報

- **Geth バージョン**: 1.11.6-ea9e62ca
- **合意アルゴリズム**: Clique (PoA)
- **用途**: プライベートブロックチェーン

## genesis.jsonの詳細解説

### 完全なgenesis.jsonの例

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
  "coinbase": "0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248",
  "difficulty": "0x1",
  "extraData": "0x417567757200000000000000000000000000000000000000000000000000000059d2e0E4DCf3Dc47e83364D4E9A91b310e7132480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "gasLimit": "0x632EA0",
  "nonce": "0x0",
  "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "timestamp": "0x59e50516"
}
```

### configセクションの詳細

#### chainId
- **説明**: ネットワークを識別する一意のID
- **値**: 21201（任意の値、ただしメインネットやテストネットのIDと重複しないこと）
- **重要性**: トランザクションのリプレイアタックを防ぐ

#### ハードフォーク設定（〜Block）
```json
"homesteadBlock": 0,      // Homestead機能を最初から有効化
"eip150Block": 0,         // ガスコスト調整
"eip155Block": 0,         // チェーンIDを含むトランザクション署名
"eip158Block": 0,         // 空アカウントの削除
"byzantiumBlock": 0,      // Byzantiumハードフォーク
"constantinopleBlock": 0, // Constantinopleハードフォーク
"petersburgBlock": 0,     // Petersburgハードフォーク
"istanbulBlock": 0        // Istanbulハードフォーク
```

**注意**: Geth v1.11.6では`berlinBlock`や`londonBlock`は含めません。これらを含めるとPoAでの動作に問題が生じる可能性があります。

#### cliqueセクション
```json
"clique": {
  "period": 0,    // ブロック生成間隔（秒）。0=即座にマイニング
  "epoch": 30000  // 投票履歴をリセットする間隔（ブロック数）
}
```

### allocセクション
- **説明**: 初期残高の配分
- **形式**: `"アドレス": {"balance": "残高（wei単位）"}`
- **例**: 500000 ETH = "500000000000000000000000" wei

### ジェネシスブロックパラメータ

#### coinbase
- **説明**: マイニング報酬の送付先アドレス
- **PoAでの設定**: 認証者（signer）のアドレスを設定
- **重要**: `0x0000...`ではなく、実際のマイナーアドレスを設定する必要がある

#### difficulty
- **説明**: マイニング難易度
- **PoAでの値**: `"0x1"`（最小値）
- **理由**: PoAでは計算競争ではなく認証によるため

#### extraData
- **説明**: PoAでの認証者情報を含む追加データ
- **構造**: 
  ```
  0x + プレフィックス(32バイト) + 認証者アドレス(20バイト) + サフィックス(65バイト)
  ```
- **例**: 
  ```
  0x4175677572000000000000000000000000000000000000000000000000000000
  ↑ "Augur"のHEX（プレフィックス）
                                                                    59d2e0E4DCf3Dc47e83364D4E9A91b310e713248
                                                                    ↑ 認証者アドレス（0xなし）
  0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
  ↑ サフィックス（署名用の領域）
  ```

#### gasLimit
- **説明**: ブロックあたりのガス上限
- **値**: `"0x632EA0"`（6,500,000 gas）
- **考慮事項**: ネットワークの用途に応じて調整

#### nonce
- **説明**: PoWでのマイニング用ノンス
- **PoAでの値**: `"0x0"`（使用しない）

#### mixHash, parentHash
- **説明**: ブロックチェーンの整合性確認用
- **初期値**: すべて0のハッシュ値

#### timestamp
- **説明**: ジェネシスブロックのタイムスタンプ
- **値**: `"0x59e50516"`（2017年10月17日のUNIXタイムスタンプ）
- **注意**: 任意の値で問題ないが、未来の時刻は避ける

## アカウントとキーストアの設定

### 1. 必要なディレクトリ構造
```bash
/opt/geth/
├── data/           # ブロックチェーンデータ
├── keystore/       # アカウントキーファイル
├── genesis.json    # ジェネシスファイル
└── password.txt    # パスワードファイル（権限600）
```

### 2. アカウントのインポート手順
```bash
# 1. パスワードファイルの作成
echo "your-secure-password" > /opt/geth/password.txt
chmod 600 /opt/geth/password.txt

# 2. 秘密鍵ファイルの準備（一時的）
echo "your-private-key-without-0x" > /tmp/private_key.txt
chmod 600 /tmp/private_key.txt

# 3. アカウントのインポート
geth --datadir /opt/geth/data account import \
  --password /opt/geth/password.txt \
  /tmp/private_key.txt

# 4. キーストアファイルのコピー
cp -r /opt/geth/data/keystore/* /opt/geth/keystore/

# 5. 一時ファイルの削除
rm -f /tmp/private_key.txt
```

### 3. ジェネシスブロックの初期化
```bash
geth --datadir /opt/geth/data init /opt/geth/genesis.json
```

## Geth起動コマンドの詳細

### 完全な起動コマンド
```bash
geth --datadir /opt/geth/data \
  --networkid 21201 \
  --http --http.addr 0.0.0.0 --http.port 8545 \
  --http.corsdomain "*" \
  --http.api eth,net,web3,personal,miner \
  --ws --ws.addr 0.0.0.0 --ws.port 8546 \
  --ws.origins "*" \
  --allow-insecure-unlock \
  --keystore /opt/geth/keystore \
  --password /opt/geth/password.txt \
  --unlock 59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 \
  --mine --miner.threads=1 \
  --miner.etherbase=0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 \
  --nodiscover
```

### 各オプションの詳細説明

#### 基本設定
- `--datadir`: ブロックチェーンデータの保存先
- `--networkid`: genesis.jsonのchainIdと一致させる

#### HTTP RPC設定
- `--http`: HTTP-RPCサーバーを有効化
- `--http.addr 0.0.0.0`: すべてのIPからの接続を許可
- `--http.port 8545`: RPCポート
- `--http.corsdomain "*"`: CORS設定（開発環境用）
- `--http.api`: 利用可能なAPIモジュール

#### WebSocket設定
- `--ws`: WebSocketサーバーを有効化
- `--ws.addr`, `--ws.port`: WebSocketの設定
- `--ws.origins "*"`: 接続元制限（開発環境用）

#### アカウント設定（重要）
- `--keystore`: キーストアディレクトリの指定
- `--password`: パスワードファイルの指定
- `--unlock`: アンロックするアカウント（0xなし）
- `--allow-insecure-unlock`: HTTP経由でのアンロックを許可

#### マイニング設定
- `--mine`: マイニングを有効化
- `--miner.threads`: マイニングスレッド数
- `--miner.etherbase`: マイニング報酬の送付先

#### ネットワーク設定
- `--nodiscover`: 他のノードの自動探索を無効化

## トラブルシューティング

### マイニングが開始されない場合

1. **アカウントがアンロックされているか確認**
   ```bash
   # Gethコンソールで確認
   > eth.coinbase
   > personal.listWallets
   ```

2. **extraDataの認証者アドレスが正しいか確認**
   - アドレスは0xを除いた40文字
   - coinbaseアドレスと一致している必要がある

3. **キーストアファイルの存在確認**
   ```bash
   ls -la /opt/geth/keystore/
   ```

### よくあるエラーと対処法

#### "Failed to unlock account"
- パスワードファイルの権限を確認（600である必要）
- パスワードに改行が含まれていないか確認

#### "Clique: no signers"
- extraDataに認証者アドレスが正しく設定されているか確認
- アドレスの前後のパディングが正しいか確認

#### "Chain config is not compatible"
- 既存のデータディレクトリを削除して再初期化
- genesis.jsonのハードフォーク設定を確認

### systemdサービスとしての設定

```ini
[Unit]
Description=Geth Private Blockchain
After=network.target

[Service]
Type=simple
User=geth
ExecStart=/usr/local/bin/geth \
    --datadir /opt/geth/data \
    --networkid 21201 \
    --http --http.addr 0.0.0.0 --http.port 8545 \
    --http.corsdomain "*" \
    --http.api eth,net,web3,personal,miner \
    --ws --ws.addr 0.0.0.0 --ws.port 8546 \
    --ws.origins "*" \
    --allow-insecure-unlock \
    --keystore /opt/geth/keystore \
    --password /opt/geth/password.txt \
    --unlock 59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 \
    --mine --miner.threads=1 \
    --miner.etherbase=0x59d2e0E4DCf3Dc47e83364D4E9A91b310e713248 \
    --nodiscover
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## セキュリティ上の注意事項

1. **本番環境では以下を変更すること**：
   - `--http.corsdomain`を特定のドメインに制限
   - `--ws.origins`を特定のオリジンに制限
   - `--allow-insecure-unlock`を無効化
   - より強力なパスワードを使用

2. **ファイアウォール設定**：
   - 8545, 8546ポートへのアクセスを制限
   - 必要な IPアドレスのみ許可

3. **秘密鍵の管理**：
   - バックアップを安全に保管
   - 定期的なローテーション