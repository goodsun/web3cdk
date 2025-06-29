# 開発で得た学び

このドキュメントは、Web3 CDKプロジェクトの開発過程で得た技術的な学びをまとめたものです。

## 🎯 コマンド設計の原則

### npm run を基本とする
- `./scripts/setup.sh` より `npm run setup` の方が初学者に優しい
- パッケージマネージャーを通すことで一貫性のあるインターフェースを提供
- プラットフォーム間の差異を吸収できる

### パラメータはシンプルに
- `npm run research myprod` のように短く直感的に
- 長いファイルパスより、短い識別子を使う
- 必要な情報は内部で自動補完する

### エラーメッセージは親切に
- エラーの原因を明確に説明
- 解決策を具体的なコマンドで提示
- コピペで実行できるようにする

## 🔧 環境変数の読み込み問題

### 問題: .envファイルのコメント行が変数に含まれる
```bash
# 問題のあるコード
export $(grep -v '^#' .env | xargs)
```

このコードではインラインコメント（行末のコメント）が処理されない：
```
CDK_ACCOUNT=123456789012  # 本番アカウント
```

### 解決: インラインコメントも除外
```bash
# 改善されたコード
export $(grep -v '^#' "$ENV_FILE" | sed 's/#.*//' | grep '=' | xargs)
```

処理の流れ：
1. `grep -v '^#'` - 行頭が#の行を除外
2. `sed 's/#.*//'` - #以降を削除（インラインコメント対応）
3. `grep '='` - 変数定義行のみ抽出
4. `xargs` - 環境変数として設定

## 📋 CDKブートストラップ削除後の対処

### 問題の本質
CDKブートストラップを削除すると、実行ロール（`cdk-hnb659fds-cfn-exec-role`）も削除され、既存スタックが削除できなくなる。

### なぜ起きるのか
1. CloudFormationはスタック作成時のロールで削除しようとする
2. `AWSCloudFormationFullAccess`があっても、存在しないロールは使えない
3. コンソールからの削除も同じロールを要求するため失敗する

### 解決策
1. **実行ロールを再作成する**
   ```bash
   aws iam create-role --role-name cdk-hnb659fds-cfn-exec-role-ACCOUNT-REGION \
     --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"cloudformation.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
   
   aws iam attach-role-policy --role-name cdk-hnb659fds-cfn-exec-role-ACCOUNT-REGION \
     --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
   ```

2. **リソースを個別に削除**
   - 最終手段として、スタック内のリソースを手動で削除
   - 全リソース削除後、スタックは自動的に削除される

## 🎨 初学者への配慮

### UIの細かい配慮
- **ページャー操作の説明**: `(表示が多い場合は [q]キーで次へ)` を追加
- **権限エラーの具体的解決策**: コピペ可能なコマンドを提供
- **エラー原因の説明**: なぜ失敗するのかを分かりやすく説明

### 日本語化の重要性
- エラーメッセージも日本語で表示
- 技術用語は適度にカタカナ表記
- 絵文字で視覚的にわかりやすく

## 📁 プロジェクト構成の重要性

### ルートディレクトリはシンプルに
- 初見で圧倒されないように最小限のファイルのみ
- README、package.json、LICENSE程度に留める

### CDK特有の制約
- `cdk.json`はルートに置く必要がある（CDKの仕様）
- これは移動できない制約として受け入れる

### 論理的なグループ分け
```
src/       - ソースコード
scripts/   - 運用スクリプト
config/    - 設定ファイル
tools/     - 開発ツール設定
docs/      - ドキュメント
test/      - テストコード
```

## 🔍 デバッグのコツ

### スクリプトのデバッグ
- `set -e` で即座にエラー停止
- エラー時は具体的な対処法を表示
- 環境変数の内容を確認できるようにする

### 権限エラーの調査
```bash
# 現在の認証情報を確認
aws sts get-caller-identity

# ポリシーの確認
aws iam get-user-policy --user-name YOUR_USER_NAME --policy-name YOUR_POLICY_NAME
```

## 📝 まとめ

これらの学びは、初学者にも優しく、かつ実用的なツールを作る上で重要な知見です。特に：

1. **エラーは必ず起きる前提で設計する**
2. **解決策は具体的に提示する**
3. **初学者の視点を忘れない**
4. **制約は明確に文書化する**

これらを意識することで、より良い開発者体験を提供できます。