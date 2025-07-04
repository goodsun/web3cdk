# リグレッションテスト実行ガイド

## 概要

このガイドでは、web3cdkプロジェクトのリグレッションテストの実行方法について説明します。

## 🎯 リグレッションテストとは

コードベースの変更後に、既存の機能が正常に動作することを確認するための自動テストです。

### 実行対象
- CDK Bootstrap確認
- 環境セットアップ
- インフラストラクチャのデプロイ
- Lambda関数の動作確認
- API連携テスト
- リソースのクリーンアップ

## 🚀 クイックスタート

### 最も簡単な実行方法

```bash
# プロジェクトルートで実行
./scripts/regression-test.sh
```

対話的に以下を選択：
1. **テスト環境**: `test` (推奨)
2. **テスト範囲**: `フルテスト` (推奨)
3. **実行確認**: `y`

## 🏗️ テスト環境の選択

### 1. test環境 (推奨) ⭐
- **用途**: リグレッションテスト専用
- **特徴**: 他の環境に影響しない
- **スタック名**: `web3cdk-test-*`
- **設定ファイル**: `.env.test`

```bash
# test環境での実行例
./scripts/regression-test.sh
# → 選択肢1を選択
```

### 2. dev環境
- **用途**: 開発環境での動作確認
- **注意**: 他の開発作業に影響する可能性
- **スタック名**: `web3cdk-dev-*`

### 3. staging環境
- **用途**: ステージング環境での動作確認
- **注意**: staging環境のリソースが一時的に削除される

### 4. prod環境 (非推奨)
- **用途**: 本番環境での動作確認
- **⚠️ 警告**: 本番環境への影響があるため非推奨

## 📋 テスト範囲の選択

### 1. フルテスト (推奨)
すべてのコンポーネントをテストします。

**実行内容**:
1. Bootstrap確認
2. Setup実行
3. 全スタックのデプロイ
4. Lambda関数テスト
5. DynamoDB動作確認
6. 全リソースの削除

**所要時間**: 約15-20分

### 2. 基本機能のみ
インフラストラクチャの基本機能のみテストします。

**実行内容**:
1. Bootstrap確認
2. Setup実行
3. デプロイ/削除

**所要時間**: 約10-15分

### 3. Lambda関数のみ
既存の環境でLambda関数の動作のみテストします。

**実行内容**:
1. Lambda関数のデプロイ
2. APIテスト

**所要時間**: 約5-10分

## 🔧 設定ファイル

### test環境の設定 (.env.test)

test環境専用の設定ファイルが自動的に使用されます。

**特徴**:
- テスト用のダミー値を使用
- 本番データに影響しない
- Discord連携は無効化
- 固定IPは使用しない

### カスタム設定

test環境の設定をカスタマイズする場合：

```bash
# .env.testを編集
vim .env.test

# または既存環境をベースにコピー
cp .env.dev .env.test
# 必要に応じて編集
```

## 📊 テスト結果の確認

### ログの場所

```bash
# 最新のテスト結果
ls -la docs/testing/test-results/

# 特定のテスト結果確認
cat docs/testing/test-results/YYYYMMDD_HHMMSS/summary.md
```

### 結果の解釈

#### ✅ 成功パターン
```
| テスト項目 | 結果 | 備考 |
|------------|------|------|
| Bootstrap | ✅ 成功 | 既存のCDKToolkitを使用 |
| Setup | ✅ 成功 | .env.test.YYYYMMDD を作成 |
| Deploy | ✅ 成功 | 全スタックデプロイ完了 |
| Lambda関数 | ✅ 成功 | API応答正常 |
| DynamoDB | ✅ 成功 | テーブル作成確認 |
| Destroy | ✅ 成功 | 全リソース削除完了 |
```

#### ❌ 失敗パターン
失敗した場合は、詳細ログを確認：

```bash
# 詳細ログの確認
cat docs/testing/test-results/YYYYMMDD_HHMMSS/regression-test.log | grep -A 10 -B 10 "❌"
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. AWS認証エラー
```bash
# AWS認証確認
aws sts get-caller-identity

# プロファイル設定確認
export AWS_PROFILE=your-profile-name
```

#### 2. スタックが残っている
```bash
# test環境のスタック削除
./scripts/destroy.sh test

# 強制削除
./scripts/destroy.sh test -f
```

#### 3. Bootstrap関連エラー
```bash
# Bootstrapの状態確認
aws cloudformation describe-stacks --stack-name CDKToolkit

# 必要に応じてBootstrap実行
./scripts/bootstrap.sh
```

#### 4. タイムアウトエラー
大規模なスタックの場合、タイムアウトが発生する可能性があります：

```bash
# 手動でのステップ実行
./scripts/bootstrap.sh
./scripts/setup.sh test
./scripts/deploy.sh test
# テスト実行
./scripts/destroy.sh test
```

## 🔄 CI/CDでの自動実行

### GitHub Actions例

```yaml
name: Regression Test
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  regression-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run regression test
        run: |
          export REGRESSION_TEST=true
          echo -e "1\n1\ny" | ./scripts/regression-test.sh
```

### 定期実行

```yaml
# 毎日午前2時に実行
on:
  schedule:
    - cron: '0 2 * * *'
```

## 📋 ベストプラクティス

### 1. 実行タイミング
- **コード変更後**: プルリクエスト前に実行
- **リリース前**: 本番デプロイ前の最終確認
- **定期実行**: 週次または月次で環境の健全性確認

### 2. 環境選択
- **開発中**: test環境を使用
- **チーム共有**: dev環境は避ける
- **本番前**: staging環境で最終確認

### 3. 失敗時の対応
1. ログの詳細確認
2. 手動での再現確認
3. 問題解決後の再実行
4. 必要に応じてissue作成

### 4. リソース管理
- test環境のリソースは適切に削除
- 不要なスタックが残らないよう定期確認
- コスト監視の設定

## 🔗 関連ドキュメント

- [リグレッションテスト仕様書](./regression-test-plan.md)
- [CDKマニュアル](../guides/cdk-manual.md)
- [スタックテスト仕様](./stack-test-specifications.md)
- [トラブルシューティング](../development/development-learnings.md)

## 📞 サポート

問題が発生した場合：
1. このガイドのトラブルシューティングを確認
2. ログファイルの詳細を確認
3. チームメンバーに相談
4. 必要に応じてGitHubでissue作成