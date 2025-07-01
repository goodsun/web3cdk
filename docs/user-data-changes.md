# User Data変更時の注意事項

## ⚠️ 重要な注意
EC2インスタンスのUser Data（起動スクリプト）を変更した場合、**インスタンスの再作成が必要**です。

## 🤔 なぜ再作成が必要なのか？

### User Dataの仕組み
- User Dataは**インスタンス作成時のみ実行**される
- 既存のインスタンスでは新しいUser Dataは実行されない
- AWSの仕様として、起動後のUser Data変更は反映されない

### よくある誤解
```bash
# ❌ これでは新しい設定は反映されない
git add lib/constructs/ec2-stack.ts
git commit -m "Add httpd installation"
npm run deploy:dev  # デプロイ成功！でも反映されない
```

## 🔍 変更の検知方法

### CDK diff での確認
```bash
npm run diff:dev
```

User Data変更時は以下のように表示されます：
```
[~] AWS::EC2::Instance Ec2/Web3CdkInstance may be replaced
 └─ [~] UserData (may cause replacement)
```

### 自動警告機能
新しいdiff scriptでは、User Data変更を検知すると**赤い警告**が表示されます：

```
⚠️  重要な注意事項 ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 EC2インスタンスが再作成されます

📋 再作成の理由:
  • User Data（起動スクリプト）が変更されました
  • 既存インスタンスでは新しい設定が適用されません
  • AWS CDKが自動的に古いインスタンスを削除して新規作成します
```

## 🔧 対処方法

### 推奨: 手動でインスタンス削除
```bash
# 1. EC2スタックのみ削除
npx cdk destroy web3cdk-dev-ec2

# 2. 確認メッセージで 'y' を入力

# 3. 再デプロイ
npm run deploy:dev
```

### 非推奨: 強制再作成
CDK側でタグ変更等による強制再作成も可能ですが、**リソースの残骸**が発生する可能性があるため推奨しません。

## 💾 影響を受けるもの

### 変更されるもの
- **IPアドレス**: 新しいパブリックIPが割り当てられる（Elastic IP使用時は除く）
- **インスタンスID**: 新しいIDが生成される
- **SSH Host Key**: 新しいキーが生成される

### 失われるもの
- **ログファイル**: `/var/log/` 以下のファイル
- **一時ファイル**: `/tmp/` や `/home/ec2-user/` の作業ファイル
- **手動インストール**: User Data以外で手動インストールしたソフトウェア

### 保持されるもの
- **Elastic IP**: 設定している場合は同じIPアドレス
- **セキュリティグループ**: 同じ設定が適用される
- **VPC設定**: ネットワーク設定は維持される

## 🎯 デプロイ後の確認手順

### 1. 新しいIPアドレスの確認
```bash
# CDKの出力で確認
npm run deploy:dev | grep "InstancePublicIp"

# または AWS CLIで確認
aws ec2 describe-instances --query 'Reservations[*].Instances[*].PublicIpAddress'
```

### 2. DNS設定の更新（ドメイン使用時）
カスタムドメインを使用している場合：
```bash
# 新しいIPアドレスにDNSレコードを更新
# 例：dev.bon-soleil.com → 新しいIP
```

### 3. SSH接続テスト
```bash
# ~/.ssh/known_hosts から古いエントリを削除
ssh-keygen -R OLD_IP_ADDRESS

# 新しいIPで接続テスト
ssh -i ~/.ssh/web3cdk-dev.pem ec2-user@NEW_IP_ADDRESS
```

### 4. サービス動作確認
```bash
# HTTPアクセス確認
curl -I http://NEW_IP_ADDRESS

# 必要なサービスの確認
sudo systemctl status httpd
```

## 🚨 トラブルシューティング

### デプロイが失敗する場合
```bash
# リソースが残っている可能性
aws cloudformation describe-stacks --stack-name web3cdk-dev-ec2

# 必要に応じて手動でクリーンアップ
```

### SSH接続できない場合
```bash
# セキュリティグループの確認
aws ec2 describe-security-groups --group-ids sg-xxxxx

# ADMIN_CIDRの設定確認
grep ADMIN_CIDR .env.dev
```

## 📋 予防策とベストプラクティス

### 1. 段階的な開発
- User Dataは最初に完成形に近づけておく
- 頻繁な変更を避ける設計にする

### 2. テスト環境での確認
- 本番環境での変更前に、開発環境で十分テストする

### 3. バックアップの習慣
- 重要なファイルは定期的にS3等にバックアップ
- 設定手順はドキュメント化しておく

### 4. Elastic IPの活用
- IPアドレス変更の影響を最小化
- DNS設定の更新頻度を減らす

## 💡 まとめ

User Data変更は**インスタンス再作成**を伴う重要な操作です：

1. **事前確認**: `npm run diff:dev` で警告をチェック
2. **安全な削除**: `npx cdk destroy web3cdk-dev-ec2`
3. **再デプロイ**: `npm run deploy:dev`
4. **動作確認**: 新しいIPでのアクセステスト

この手順を守ることで、**安全で確実**なUser Data変更が可能です。