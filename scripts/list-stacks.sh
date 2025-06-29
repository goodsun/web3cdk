#!/bin/bash

# CDKスタック一覧表示スクリプト - AWSアカウント上のスタック確認

set -e  # エラーが発生したら即座に停止

echo "📋 CDKスタック一覧表示ツール"
echo "============================="

# 環境変数の読み込み
ENV_FILE_FOUND=false
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs) 2>/dev/null || true
    ENV_FILE_FOUND=true
fi

# .env.dev, .env.stg, .env.prodからも読み込み試行
for env_file in .env.dev .env.stg .env.prod; do
    if [ -f "$env_file" ]; then
        export $(grep -v '^#' "$env_file" | xargs) 2>/dev/null || true
        ENV_FILE_FOUND=true
        break
    fi
done

REGION=${CDK_REGION:-ap-northeast-1}

echo "🔍 AWSアカウント情報:"
if [ -z "$CDK_ACCOUNT" ]; then
    echo "  アカウント: ⚠️  未設定"
    echo "  リージョン: $REGION (デフォルト)"
    echo ""
    echo "💡 セットアップが必要です:"
    echo "  1. npm run setup を実行してください"
    echo "  2. または手動で以下を設定:"
    echo "     export CDK_ACCOUNT=your-aws-account-id"
    echo "     export CDK_REGION=your-preferred-region"
    echo ""
else
    echo "  アカウント: $CDK_ACCOUNT"
    echo "  リージョン: $REGION"
    echo ""
fi

# AWS CLIの確認
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLIがインストールされていません"
    echo "💡 AWS CLIをインストールしてください: https://aws.amazon.com/cli/"
    echo ""
    echo "🔍 セットアップなしでも確認できる情報:"
    echo ""
    # プロジェクト設定の表示のみ実行
    show_project_config_only
    exit 0
fi

# AWS認証確認
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS認証情報が設定されていません"
    echo "💡 aws configure を実行してください"
    echo ""
    echo "🔍 セットアップなしでも確認できる情報:"
    echo ""
    # プロジェクト設定の表示のみ実行
    show_project_config_only
    exit 0
fi

echo "📊 CloudFormationスタック一覧:"
echo "================================"

# CloudFormationスタックの取得
STACKS=$(aws cloudformation list-stacks \
    --region $REGION \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
    --query 'StackSummaries[?contains(StackName, `CDK`) || contains(StackName, `cdk`) || contains(StackName, `web3cdk`) || contains(StackName, `bonsoleil`)].[StackName,StackStatus,CreationTime]' \
    --output table 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$STACKS" ]; then
    echo "$STACKS"
    echo ""
    
    # スタック数を表示
    STACK_COUNT=$(aws cloudformation list-stacks \
        --region $REGION \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
        --query 'StackSummaries[?contains(StackName, `CDK`) || contains(StackName, `cdk`) || contains(StackName, `web3cdk`) || contains(StackName, `bonsoleil`)]' \
        --output text 2>/dev/null | wc -l)
    echo "📈 関連スタック数: $STACK_COUNT個"
else
    echo "🔍 関連するスタックが見つかりませんでした"
fi

echo ""
echo "🛠️ CDKToolkitスタック (Bootstrap):"
echo "================================="

# CDKToolkitスタックの確認
BOOTSTRAP_STACK=$(aws cloudformation describe-stacks \
    --stack-name CDKToolkit \
    --region $REGION \
    --query 'Stacks[0].[StackName,StackStatus,CreationTime]' \
    --output table 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "$BOOTSTRAP_STACK"
    
    # Bootstrap詳細情報
    echo ""
    echo "📋 Bootstrap詳細:"
    aws cloudformation describe-stacks \
        --stack-name CDKToolkit \
        --region $REGION \
        --query 'Stacks[0].{
            StackId: StackId,
            CreationTime: CreationTime,
            LastUpdatedTime: LastUpdatedTime
        }' \
        --output table 2>/dev/null
else
    echo "❌ CDKToolkitスタックが見つかりません"
    echo "💡 ブートストラップが必要です: npm run bootstrap"
fi

echo ""
# プロジェクト設定を表示する関数
show_project_config_only() {
    echo "🔧 現在のプロジェクト設定:"
    echo "========================="
    
    # 環境設定ファイルの確認と表示
    local config_found=false
    for env_file in .env.local .env.dev .env.stg .env.prod; do
        if [ -f "$env_file" ]; then
            echo "📝 環境設定ファイル: $env_file"
            grep -E '^(PROJECT_NAME|ORG_NAME|CDK_ENV|STACK_NAME|APP_NAME)=' "$env_file" 2>/dev/null | sed 's/^/  /' || true
            config_found=true
            echo ""
        fi
    done
    
    if [ "$config_found" = false ]; then
        echo "⚠️  環境設定ファイルが見つかりません"
        echo "💡 npm run setup を実行して設定を作成してください"
        echo ""
    fi
    
    echo "💡 便利なコマンド:"
    echo "  npm run setup       # 初期セットアップ"
    echo "  npm run bootstrap   # CDKブートストラップ"
    echo "  npm run diff:dev    # 開発環境の差分確認"
    echo "  npm run deploy:dev  # 開発環境にデプロイ"
}

# AWS情報が利用可能な場合のみスタック一覧を表示
show_project_config_only