# 🧹 コードベース残骸調査レポート

**調査日時**: 2025年7月3日  
**調査対象**: web3cdkプロジェクト全体  
**目的**: インフラ構築完了後の不要な残骸とクリーンアップ対象の特定

## 📋 調査結果サマリー

### ⚠️ 優先度高（即座に対応が必要）
- DISCORD_TEST_MODE環境変数の残存
- テスト用ファイルの散乱
- 重複するディレクトリ構造

### ⚠️ 優先度中（確認後対応）
- .d.ts型定義ファイルの管理
- cdk.out/内の古いasset
- 未定義環境変数の整理

---

## 1. 🔧 環境変数の残骸

### 削除が必要なもの
- ❌ **DISCORD_TEST_MODE** 
  - **場所**: `lib/stacks/bot-api-stack.ts` (line 105)
  - **状況**: bot-api本体からは削除済みだが、CDKスタック定義に残存
  - **影響**: 新規デプロイ時に不要な環境変数が設定される

### 未定義の環境変数
- ⚠️ **NFT関連の環境変数**
  - `NFT_CONTRACT_ADDRESS`
  - `NFT_CHAIN_ID` 
  - `NFT_RPC_URL`
  - **状況**: bot-api内で使用されているが.env.devに定義なし
  - **影響**: ランタイムでundefinedになる可能性

---

## 2. 📁 不要なファイル

### テスト用ファイル（削除推奨）
| ファイル名 | パス | 内容 | 削除可否 |
|-----------|------|------|----------|
| `test-payload.json` | ルート | 簡単なテストペイロード | ✅ 削除可 |
| `payload.txt` | ルート | Discord Interactionペイロード | ✅ 削除可 |
| `response.json` | ルート | APIレスポンスサンプル | ✅ 削除可 |

### 型定義ファイル（.gitignore対象）
```
./lambda/bot-api/app.d.ts
./lambda/bot-api/handler.d.ts
./lambda/cache-api/*.d.ts
./lib/stacks/*.d.ts
./lib/constructs/*.d.ts
```
**推奨対応**: .gitignoreに*.d.tsを追加

---

## 3. 📂 ディレクトリ構造の問題

### 重複構造の疑い
```
lib/                    # 新しいCDKスタック構造
└── stacks/
    ├── bot-api-stack.ts
    └── cache-api-stack.ts

src/lib/                # 古い構造の可能性？
└── stacks/
    └── base-stack.ts
```

**推奨対応**: `src/`ディレクトリの用途確認後、不要であれば削除

### CDKアウトプットの蓄積
```
cdk.out/
├── asset.442affaf37b9800a7af34394f60a8630624f9c18c2fbd17b6b3f2fb4406ac4d5/
├── asset.4546933b662cbd68ac2910b168cae3236ac93ca30626bc35621cfe7f5d2d6798/
├── asset.8b4d1daba8704aafaf043159a58f6ab94fa3b06eba9216bb39bd279ede9c317f/
└── ... (他多数)
```

**推奨対応**: 古いassetディレクトリの定期的なクリーンアップ

---

## 4. 💻 コード内の残骸

### bot-api-stack.ts
**Line 105**: 
```typescript
DISCORD_TEST_MODE: process.env.DISCORD_TEST_MODE || 'false',
```
**問題**: 削除済み機能の環境変数設定が残存

**Line 107**:
```typescript
CORS_ORIGIN: process.env.BOT_CORS_ORIGIN || '*',
```
**確認事項**: BOT_CORS_ORIGIN環境変数の使用状況

### ドキュメント
- `docs/testing/discord-test-mode.md` - 削除したテストモードのドキュメント

---

## 5. 🧹 推奨クリーンアップアクション

### Phase 1: 即座に削除可能
```bash
# テストファイルの削除
rm test-payload.json payload.txt response.json

# テストモードドキュメントの削除
rm docs/testing/discord-test-mode.md

# .gitignoreに型定義ファイルを追加
echo "*.d.ts" >> .gitignore
```

### Phase 2: 確認後削除
1. **src/ディレクトリの調査**
   - 用途の確認
   - lib/との重複チェック
   - 不要であれば削除

2. **環境変数の整理**
   ```typescript
   // bot-api-stack.tsから削除
   - DISCORD_TEST_MODE: process.env.DISCORD_TEST_MODE || 'false',
   
   // .env.devに追加または削除判断
   - NFT_CONTRACT_ADDRESS
   - NFT_CHAIN_ID
   - NFT_RPC_URL
   ```

3. **cdk.out/のクリーンアップ**
   ```bash
   # 古いassetsの削除（要注意）
   npx cdk destroy --all  # 必要に応じて
   rm -rf cdk.out/
   ```

### Phase 3: 継続的改善
1. **ビルド成果物の管理**
   - .gitignore の強化
   - CI/CD でのクリーンアップ自動化

2. **コード品質の向上**
   - 未使用インポートの削除
   - デッドコードの特定と削除

---

## ⚠️ 注意事項

### 削除時の確認必須項目
1. **環境変数**: 本番環境での影響確認
2. **ディレクトリ**: 他のスクリプトからの参照確認
3. **CDK assets**: アクティブなスタックとの関連確認

### バックアップ推奨
- 大規模削除前のGitコミット
- 重要なファイルのバックアップ作成

---

## 📊 クリーンアップ効果予測

### ファイル数削減
- テストファイル: 3個削除
- 型定義ファイル: 10+個をgitignore対象化
- ドキュメント: 1個削除

### メンテナンス性向上
- 環境変数の明確化
- ディレクトリ構造の単純化
- デプロイ時の不要な設定削除

### リスク軽減
- 未定義環境変数によるランタイムエラー防止
- 古い設定による混乱回避
- セキュリティ面での不要な露出削除

---

**次回アクション**: このレポートを基に優先順位を決定し、段階的なクリーンアップを実施する