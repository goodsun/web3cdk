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

## 🔄 EC2 User Data変更の落とし穴

### 問題: User Data変更後にデプロイしても反映されない
EC2のUser Data（起動スクリプト）を変更してデプロイしても、既存のインスタンスでは新しいスクリプトが実行されない。

#### なぜ起きるのか
1. **User Dataはインスタンス作成時のみ実行**される
2. **CDKのdiffでは`may be replaced`と表示**されるが気づきにくい
3. **初学者は「デプロイ成功 = 設定反映済み」と誤解**しやすい

#### 初学者が詰まるポイント
```bash
# コード変更
userData.addCommands('dnf install -y httpd');

# デプロイ実行
npm run deploy:dev  # ← 成功！

# SSH接続
ssh ec2-user@server
$ sudo systemctl status httpd
Unit httpd.service could not be found.  # ← なぜ？😭
```

### 解決策

#### 1. diff時の警告機能
```bash
# scripts/diff.sh で自動検知
if echo "$DIFF_OUTPUT" | grep -q "may be replaced.*UserData"; then
    echo -e "\033[1;31m⚠️  EC2インスタンスが再作成されます\033[0m"
    # 詳細な説明を表示
fi
```

#### 2. 手動でのインスタンス削除（推奨）
```bash
# 安全で確実な方法
npx cdk destroy web3cdk-dev-ec2  # EC2スタックのみ削除
npm run deploy:dev               # 再デプロイ
```

#### 3. 強制再作成（非推奨）
```typescript
// CDK側でタグを変更して強制再作成
cdk.Tags.of(this.instance).add('ForceRecreate', '2025-07-01-v2');
```

**注意**: 強制再作成は**リソースの残骸**が発生しやすく、初学者には推奨しない。

### 予防策

#### User Data変更の可視化
- **赤文字での警告表示**
- **具体的な影響の説明**（IPアドレス変更など）
- **次のステップの案内**

#### 初学者向けドキュメント
```markdown
## ⚠️ User Data変更時の注意
設定スクリプト（User Data）を変更した場合：
1. EC2インスタンスが再作成されます
2. IPアドレスが変更される可能性があります
3. DNS設定の更新が必要な場合があります
```

## 🛠️ Amazon Linux 2023での開発ツール選定

### curl-minimalの競合問題
Amazon Linux 2023では、`curl`と`curl-minimal`パッケージが競合する。

#### 問題のログ
```
Error: package curl-minimal conflicts with curl provided by curl
```

#### 解決策
```bash
# curl-minimalを削除してからcurlをインストール
dnf remove -y curl-minimal
dnf install -y curl
```

### 開発ツールの選定
初学者フレンドリーかつ現代的なツールセット：

#### 必須ツール
```bash
tmux         # セッション管理（screenより推奨）
htop         # カラフルなプロセス監視
tree         # ディレクトリ構造表示
vim          # エディタ（nanoより高機能）
jq           # JSON処理
```

#### ネットワーク・デバッグ
```bash
net-tools    # netstat, ifconfig
nmap-ncat    # nc（telnetより便利）
bind-utils   # dig, nslookup
```

#### ファイル検索
```bash
mlocate      # locate/updatedb（fd-findが使えないため）
```

**注意**: `fd-find`パッケージはAmazon Linux 2023では利用不可。

### locate世代への配慮
```bash
# mlocate初期化（バックグラウンド実行）
updatedb &
```

初回の`updatedb`実行により、すぐに`locate`コマンドが使用可能。

## 🪤 Amazon Linux 2023でのcertbot設定の罠

### 問題: pipとdnfパッケージの混在
初期実装では`pip3 install certbot certbot-apache`を使用していたが、Amazon Linux 2023では正しく動作しない。

#### 症状
```
ModuleNotFoundError: No module named 'cryptography'
```

#### 原因
- pipとdnfでインストールしたPythonパッケージのパス競合
- certbotがシステムのPythonモジュールを正しく認識できない

#### 解決策
```bash
# ❌ 間違い
pip3 install certbot certbot-apache

# ✅ 正解
dnf install -y python3-certbot-apache cronie
```

### certbotコマンドの違い
Amazon Linux 2023では`certbot-3`コマンドを使用する必要がある。

```bash
# ❌ 間違い
certbot --apache -d domain.com

# ✅ 正解
/usr/bin/certbot-3 --apache -d domain.com
```

### レガシーシステムとの比較が重要
既存の動作実績のあるシステムと比較することで、以下の違いを発見：
- パッケージインストール方法（pip vs dnf）
- 実行コマンドパス（certbot vs certbot-3）
- 必要な依存パッケージ（cronie）

## 🔧 curl-minimalパッケージ競合の詳細

### grub2-efiとの依存関係問題
```bash
# ❌ 危険なコマンド
dnf remove -y curl-minimal
# Error: The operation would result in removing protected packages: grub2-efi-x64-ec2

# ✅ 安全な方法
dnf install -y httpd mod_ssl git wget unzip python3-pip || true
dnf install -y curl --allowerasing || true
```

`--allowerasing`オプションで競合パッケージを自動的に置き換える。

## 📋 CloudFormation状態不整合の対処

### UPDATE_ROLLBACK_FAILED状態
EC2インスタンスを手動削除した後にデプロイすると発生。

#### 対処手順
1. `aws cloudformation continue-update-rollback`を試行
2. 失敗する場合は`aws cloudformation delete-stack`で強制削除
3. ネストされたスタックも含めて削除確認

### スタック削除後もリソースが残る問題
CloudFormationスタックは削除されたが、EC2インスタンスが残存するケース。

```bash
# リソースの手動削除が必要
aws ec2 terminate-instances --instance-ids <instance-id>
```

## 🎯 初学者向け設計の重要ポイント

### 1. エラーの可視化
- User Data変更時の赤い警告表示
- 具体的な影響の説明
- 次のアクションの明示

### 2. 自動化の徹底
- 手動作業を極力排除
- エラー時も継続する設計（`|| true`）
- 依存関係の自動解決

### 3. テスト手法の活用
```bash
# Let's Encrypt制限を回避
certbot-3 certonly --dry-run
```

### 4. ドキュメント化
- 罠の事前共有
- 具体的な解決手順
- なぜそうなるのかの説明

## 📝 まとめ

これらの学びは、初学者にも優しく、かつ実用的なツールを作る上で重要な知見です。特に：

1. **エラーは必ず起きる前提で設計する**
2. **解決策は具体的に提示する**
3. **初学者の視点を忘れない**
4. **制約は明確に文書化する**
5. **User Data変更は要注意ポイント**
6. **パッケージ競合問題への対策**
7. **レガシーシステムとの比較で問題を発見**
8. **CloudFormation状態管理の重要性**

これらを意識することで、より良い開発者体験を提供できます。