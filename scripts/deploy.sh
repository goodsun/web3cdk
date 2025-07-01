#!/bin/bash

# CDKデプロイスクリプト - シンプルで確実なデプロイ

set -e  # エラーが発生したら即座に停止

# 使い方の表示
if [ $# -eq 0 ]; then
    echo "使い方: $0 <環境>"
    echo "  環境: dev, stg, または prod"
    echo ""
    echo "例:"
    echo "  $0 dev    # 開発環境にデプロイ"
    echo "  $0 prod   # 本番環境にデプロイ"
    exit 1
fi

ENV=$1
echo "🚀 $ENV 環境にデプロイします"
echo "========================"

# 環境の検証
if [[ ! "$ENV" =~ ^(dev|stg|prod)$ ]]; then
    echo "❌ 無効な環境: $ENV"
    echo "有効な選択肢: dev, stg, prod"
    exit 1
fi

# 環境変数の読み込み
ENV_FILE=".env.${ENV}"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 環境設定ファイル $ENV_FILE が見つかりません"
    echo ""
    echo "💡 解決方法:"
    echo "  1. セットアップを実行: npm run setup $ENV"
    echo "  2. 手動で作成: cp .env.example $ENV_FILE"
    echo ""
    exit 1
fi

echo "📁 環境設定ファイルを読み込み中: $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | sed 's/#.*//' | grep '=' | xargs)

# 環境変数の設定
export CDK_ENV=$ENV

# 必須環境変数のチェック
echo ""
echo "🔍 必須環境変数をチェック中..."
MISSING_VARS=()

if [ -z "$CDK_ACCOUNT" ]; then
    MISSING_VARS+=("CDK_ACCOUNT")
fi

if [ -z "$PROJECT_NAME" ]; then
    MISSING_VARS+=("PROJECT_NAME")
fi

if [ -z "$CDK_REGION" ]; then
    MISSING_VARS+=("CDK_REGION")
fi

# Phase 1で必要な環境変数
if [ -z "$EC2_KEY_NAME" ]; then
    MISSING_VARS+=("EC2_KEY_NAME")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ 以下の必須環境変数が設定されていません:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "💡 解決方法:"
    echo "  1. セットアップを再実行: npm run setup $ENV"
    echo "  2. $ENV_FILE を手動で編集"
    echo ""
    exit 1
fi

echo "✅ 必須環境変数チェック完了"

echo "📋 デプロイ設定:"
echo "  アカウント: $CDK_ACCOUNT"
echo "  リージョン: ${CDK_REGION:-ap-northeast-1}"
echo "  環境: $CDK_ENV"

# プロダクション環境の場合は確認
if [ "$ENV" = "prod" ]; then
    echo ""
    echo "⚠️  警告: 本番環境にデプロイしようとしています"
    read -p "本当に実行しますか？ (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "デプロイがキャンセルされました"
        exit 0
    fi
fi

# TypeScriptのビルド
echo ""
echo "🔨 TypeScriptをビルドしています..."
npm run build

# CDK差分の確認
echo ""
echo "🔍 差分を確認しています..."
npx cdk diff

# デプロイの実行
echo ""
echo -e "\033[1;33m🚀 スタックをデプロイしています（全スタック一括）...\033[0m"
echo -e "\033[34m💡 上級者向けTips: 個別デプロイも可能です\033[0m"
echo -e "\033[35m   npx cdk deploy web3cdk-$ENV-network    # ネットワークのみ\033[0m"
echo -e "\033[35m   npx cdk deploy web3cdk-$ENV-ec2        # EC2のみ\033[0m"  
echo -e "\033[35m   npx cdk deploy web3cdk-$ENV-storage    # ストレージのみ\033[0m"
echo ""
npx cdk deploy --all --require-approval never

# 結果の表示
echo ""
echo "✅ デプロイが完了しました！"
echo ""
echo "AWSコンソールでスタックを確認:"
echo "https://console.aws.amazon.com/cloudformation/home?region=${CDK_REGION:-ap-northeast-1}"