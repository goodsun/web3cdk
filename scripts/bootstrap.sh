#!/bin/bash

# CDKブートストラップスクリプト - アカウント・リージョンに1回だけ実行
# 既存スタックがある場合は安全に更新されます（削除・再作成ではなく差分更新）

# 自動モードの確認（環境変数またはコマンドライン引数）
AUTO_MODE=false
if [ "$1" = "--auto" ] || [ "$REGRESSION_TEST" = "true" ]; then
    AUTO_MODE=true
fi

echo ""
echo -e "\033[36m╔══════════════════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[36m║                        🏗️  CDK ブートストラップ                              ║\033[0m"
echo -e "\033[36m║                   AWS環境にCDK実行基盤を構築します                           ║\033[0m"
echo -e "\033[36m╚══════════════════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

set -e  # エラーが発生したら即座に停止

# 1. AWS CLIの確認
echo ""
echo "1️⃣ AWS CLIを確認しています..."
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLIがインストールされていません。"
    echo "まずAWS CLIをインストールしてください: https://aws.amazon.com/cli/"
    exit 1
fi
echo "✅ AWS CLIが見つかりました: $(aws --version)"

# 2. AWS認証情報の確認
echo ""
echo "2️⃣ AWS認証情報を確認しています..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS認証情報が設定されていません。"
    echo "aws configure を実行してください。"
    exit 1
fi

# AWS アカウント情報の表示と確認
echo ""
echo "🔍 現在のAWSアカウント情報:"
echo "================================================"
aws sts get-caller-identity --output table
echo ""

# 現在のプロファイル表示
if [ -n "$AWS_PROFILE" ]; then
    echo "📋 アクティブなプロファイル: $AWS_PROFILE"
else
    echo "📋 アクティブなプロファイル: default"
fi

echo ""
if [ "$AUTO_MODE" = true ]; then
    echo "✅ 自動モード: ブートストラップを続行します"
    confirm="y"
else
    read -p "⚠️  このAWSアカウントでブートストラップを実行しますか？ (y/n): " confirm
fi

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo "❌ ユーザーによってブートストラップがキャンセルされました"
    echo ""
    echo "💡 AWSアカウントを変更するには:"
    echo "   export AWS_PROFILE=プロファイル名"
    echo "   npm run bootstrap"
    echo ""
    echo "💡 利用可能なプロファイル:"
    if [ -f ~/.aws/credentials ]; then
        grep '^\\[' ~/.aws/credentials | sed 's/\\[//g' | sed 's/\\]//g' | sed 's/^/   - /'
    else
        echo "   プロファイルが見つかりません。aws configure を実行してください。"
    fi
    exit 0
fi

echo "✅ ブートストラップを続行します"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "ap-northeast-1")
echo "✅ AWSアカウント: $ACCOUNT_ID"
echo "✅ リージョン: $REGION"

# 3. ブートストラップ実行
echo ""
echo "3️⃣ CDKブートストラップ..."

# ブートストラップスタック確認
BOOTSTRAP_STACK="CDKToolkit"
if aws cloudformation describe-stacks --stack-name $BOOTSTRAP_STACK --region $REGION &> /dev/null; then
    echo "✅ CDKブートストラップスタックは既に存在します"
    echo ""
    echo "📋 ブートストラップ情報:"
    aws cloudformation describe-stacks --stack-name $BOOTSTRAP_STACK --region $REGION --query 'Stacks[0].{StackName:StackName,Status:StackStatus,Created:CreationTime}' --output table
    echo ""
    echo ""
    echo "💡 再実行時の動作："
    echo "   ✅ 既存リソースは削除されません（差分更新のみ）"
    echo "   ✅ デプロイ済みスタックへの影響はありません"
    echo "   ✅ CDKの最新機能・権限設定に更新されます"
    echo ""
    if [ "$AUTO_MODE" = true ]; then
        echo "✅ 自動モード: ブートストラップを再実行して更新します"
        update_confirm="y"
    else
        read -p "🤔 ブートストラップを再実行して更新しますか？ (y/n): " update_confirm
    fi
    if [ "$update_confirm" != "y" ] && [ "$update_confirm" != "Y" ]; then
        echo "ℹ️  ブートストラップをスキップしました"
        exit 0
    fi
fi

echo "🚀 CDKブートストラップを実行しています..."
npx cdk bootstrap

echo ""
echo "✅ ブートストラップが正常に完了しました！"
echo ""
echo "📋 作成されたブートストラップリソース:"
echo "├── CloudFormationスタック: CDKToolkit"
echo "├── S3バケット: cdk-hnb659fds-assets-$ACCOUNT_ID-$REGION"
echo "├── IAMロール: cdk-hnb659fds-*"
echo "└── SSMパラメータ: /cdk-bootstrap/hnb659fds/*"
echo ""
echo "💡 このブートストラップは同じアカウント/リージョンの複数のCDKプロジェクトで共有できます"
echo ""
echo "📋 次のステップ:"
echo "1. プロジェクトセットアップを実行: npm run setup"
echo "2. スタックをデプロイ: npx cdk deploy"
echo ""
echo "ブートストラップを楽しんでください！ 🎉"
