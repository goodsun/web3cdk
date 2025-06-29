#!/bin/bash

# CDKブートストラップスクリプト - アカウント・リージョンに1回だけ実行

set -e  # エラーが発生したら即座に停止

echo "🚀 CDKブートストラップスクリプト"
echo "=============================="

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
read -p "⚠️  このAWSアカウントでブートストラップを実行しますか？ (y/n): " confirm

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
    read -p "🤔 ブートストラップを再実行して更新しますか？ (y/n): " update_confirm
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