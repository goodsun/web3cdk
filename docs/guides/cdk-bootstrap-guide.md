# AWS CDK Bootstrap 完全ガイド

## CDK Bootstrapとは

CDK Bootstrapは、AWS CDKアプリケーションをデプロイするために必要な基本的なリソースをAWSアカウントとリージョンに準備するプロセスです。

## なぜBootstrapが必要か？

1. **アセットの保存場所**: CDKは大きなLambda関数のコードやCloudFormationテンプレートをS3バケットに保存する必要があります
2. **Dockerイメージの保存**: コンテナベースのアプリケーションはECRリポジトリが必要です
3. **権限管理**: CDKがCloudFormation経由でリソースを作成するための適切なIAMロールが必要です
4. **クロスアカウントデプロイ**: 複数のAWSアカウント間でのデプロイを可能にします

## Bootstrap Stack（CDKToolkit）の内容

Bootstrapを実行すると、`CDKToolkit`という名前のCloudFormationスタックが作成され、以下のリソースが含まれます：

### 1. S3バケット
- **名前**: `cdk-{qualifier}-assets-{account-id}-{region}`
- **用途**: 
  - CloudFormationテンプレート（50KB以上）
  - Lambda関数のコード
  - その他のアセットファイル
- **設定**: 
  - バージョニング有効
  - 暗号化有効
  - パブリックアクセスブロック

### 2. ECRリポジトリ
- **名前**: `cdk-{qualifier}-container-assets-{account-id}-{region}`
- **用途**: Dockerイメージの保存
- **設定**: イメージスキャン有効

### 3. IAMロール

#### a. FilePublishingRole
- **名前**: `cdk-{qualifier}-file-publishing-role-{account-id}-{region}`
- **用途**: S3へのアセットアップロード

#### b. ImagePublishingRole
- **名前**: `cdk-{qualifier}-image-publishing-role-{account-id}-{region}`
- **用途**: ECRへのDockerイメージプッシュ

#### c. LookupRole
- **名前**: `cdk-{qualifier}-lookup-role-{account-id}-{region}`
- **用途**: 既存リソースの参照（VPC、AMIなど）

#### d. CloudFormationExecutionRole
- **名前**: `cdk-{qualifier}-cfn-exec-role-{account-id}-{region}`
- **用途**: CloudFormationがリソースを作成するための権限
- **デフォルト権限**: AdministratorAccess（カスタマイズ可能）

#### e. DeploymentActionRole
- **名前**: `cdk-{qualifier}-deploy-role-{account-id}-{region}`
- **用途**: CDK CLIがCloudFormationスタックを操作するための権限

### 4. SSMパラメータ
- **名前**: `/cdk-bootstrap/{qualifier}/version`
- **用途**: Bootstrapバージョンの追跡

## Bootstrap実行方法

### 基本的な実行
```bash
npx cdk bootstrap
```

### 特定のアカウント・リージョンを指定
```bash
npx cdk bootstrap aws://123456789012/us-east-1
```

### カスタムqualifierを使用
```bash
npx cdk bootstrap --qualifier mycompany
```

### 信頼するアカウントを指定（クロスアカウントデプロイ用）
```bash
npx cdk bootstrap --trust 234567890123,345678901234
```

### CloudFormationExecutionRoleのポリシーをカスタマイズ
```bash
npx cdk bootstrap --cloudformation-execution-policies arn:aws:iam::aws:policy/ReadOnlyAccess
```

## Bootstrapのカスタマイズ

### 1. カスタムBootstrapテンプレート
```bash
# デフォルトテンプレートを出力
npx cdk bootstrap --show-template > bootstrap-template.yaml

# カスタマイズしたテンプレートを使用
npx cdk bootstrap --template bootstrap-template.yaml
```

### 2. 環境変数による設定
```bash
export CDK_NEW_BOOTSTRAP=1  # 新しいBootstrapバージョンを使用
export CDK_BOOTSTRAP_QUALIFIER=mycompany  # カスタムqualifier
```

## Bootstrapバージョン

### 確認方法
```bash
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version
```

### モダンBootstrap（v2以降）の特徴
- より細かい権限制御
- クロスアカウントデプロイのサポート
- ECRリポジトリの自動作成
- より安全なデフォルト設定

## ベストプラクティス

### 1. 環境ごとにqualifierを分ける
```typescript
// cdk.json
{
  "context": {
    "@aws-cdk/core:bootstrapQualifier": "prod"
  }
}
```

### 2. 最小権限の原則
```bash
# CloudFormationExecutionRoleの権限を制限
npx cdk bootstrap --cloudformation-execution-policies \
  arn:aws:iam::aws:policy/PowerUserAccess
```

### 3. 定期的なBootstrapの更新
```bash
# 既存のBootstrapスタックを更新
npx cdk bootstrap --force
```

### 4. クロスアカウントデプロイの設定
```bash
# 開発環境から本番環境へのデプロイを許可
# 本番環境で実行
npx cdk bootstrap --trust 123456789012  # 開発アカウントID
```

## トラブルシューティング

### 1. Bootstrap未実行エラー
```
Error: This stack uses assets, so the toolkit stack must be deployed to the environment
```
**解決策**: `npx cdk bootstrap`を実行

### 2. Bootstrapバージョン不一致
```
Error: The toolkit stack version is 4, but the minimum required version is 6
```
**解決策**: `npx cdk bootstrap --force`で更新

### 3. 権限不足エラー
```
Error: User: arn:aws:iam::123456789012:user/developer is not authorized to perform: iam:CreateRole
```
**解決策**: Bootstrap実行ユーザーに適切な権限を付与

## まとめ

CDK Bootstrapは、CDKアプリケーションの基盤となる重要なプロセスです。適切に設定・管理することで、安全で効率的なインフラストラクチャのデプロイが可能になります。