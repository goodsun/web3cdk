# Discord Test Mode

Discord APIとの通信をスキップして単体テストを可能にするテストモード機能です。

## 機能概要

Bot APIにテストモードを追加し、Discord APIへの依存を排除して単体テストを可能にします。

### 実装された機能

1. **Discord API呼び出しスキップ**: `fetchDiscordAPI()` がモックデータを返す
2. **署名検証スキップ**: Discord Webhook署名検証をバイパス  
3. **設定検証スキップ**: Discord設定の必須チェックをバイパス
4. **モックデータ提供**: リアルなDiscordレスポンス形式のテストデータ

## 使用方法

### 1. テストモードの有効化

環境変数 `DISCORD_TEST_MODE=true` を設定してください。

```bash
# .env.dev に追加
DISCORD_TEST_MODE=true
```

### 2. CDKでのデプロイ

```bash
# テストモードでBot APIをデプロイ
export DISCORD_TEST_MODE=true
npm run deploy:dev -- --stacks web3cdk-dev-bot-api
```

### 3. テスト実行例

```bash
# Discord署名なしでWebhookテスト
curl -X POST "https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/bot/discord" \
  -H "Content-Type: application/json" \
  -d '{"type": 1}'

# Discord Member情報テスト（モックデータが返される）
curl -X GET "https://[API_ID].execute-api.ap-northeast-1.amazonaws.com/bot/discord/member/123456789"
```

## モックデータ仕様

### Guild Member Data
```json
{
  "user": {
    "id": "123456789",
    "username": "testuser", 
    "discriminator": "0000",
    "avatar": "test_avatar_hash",
    "global_name": "Test User"
  },
  "nick": "Test Nickname",
  "roles": ["role1", "role2"],
  "joined_at": "2023-01-01T00:00:00.000Z",
  "premium_since": null,
  "deaf": false,
  "mute": false,
  "pending": false,
  "permissions": "0",
  "communication_disabled_until": null
}
```

### Guild Roles Data
```json
[
  {
    "id": "role1",
    "name": "Admin",
    "color": 16711680,
    "hoist": true,
    "position": 10,
    "permissions": "8"
  },
  {
    "id": "role2", 
    "name": "Member",
    "color": 3447003,
    "hoist": false,
    "position": 1,
    "permissions": "104324673"
  }
]
```

## テストケース例

### 1. 基本機能テスト
- ヘルスチェック
- DynamoDB CRUD操作
- 基本的なAPIレスポンス

### 2. Discord機能テスト  
- Member情報取得（モックデータ）
- Member Card生成（モックデータベース）
- Webhook処理（署名検証なし）

### 3. エラーハンドリングテスト
- 無効なパラメータ
- データベースエラー
- レスポンス形式の検証

## 実装詳細

### コード変更箇所

1. **app.ts**: テストモード判定とモック関数追加
   - `isTestMode = process.env.DISCORD_TEST_MODE === 'true'`
   - `getMockDiscordData()` 関数
   - 各Discord関数でのテストモード分岐

2. **bot-api-stack.ts**: 環境変数追加
   - `DISCORD_TEST_MODE: process.env.DISCORD_TEST_MODE || 'false'`

### ログ出力

テストモード時は以下のログが出力されます：

```
[TEST MODE] Skipping Discord API call: /guilds/123/members/456
[TEST MODE] Returning mock data for: /guilds/123/members/456
[TEST MODE] Skipping Discord config validation
[TEST MODE] Skipping Discord signature verification
```

## 本番環境での注意

- 本番環境では `DISCORD_TEST_MODE=false` または未設定にすること
- テストモードでは実際のDiscord機能は動作しません
- セキュリティチェックもバイパスされるため本番使用は厳禁

## 今後の拡張

- より詳細なエラーケースのモック
- 設定可能なモックレスポンス
- テスト専用のAPIエンドポイント
- 自動テストスイートとの統合