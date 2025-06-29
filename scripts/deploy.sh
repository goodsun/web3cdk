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
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | sed 's/#.*//' | grep '=' | xargs)
elif [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | sed 's/#.*//' | grep '=' | xargs)
fi

# 環境変数の設定
export CDK_ENV=$ENV

# 必須環境変数のチェック
if [ -z "$CDK_ACCOUNT" ]; then
    echo "❌ CDK_ACCOUNTが設定されていません"
    echo "まず npm run setup を実行してください"
    exit 1
fi

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
echo "🚀 スタックをデプロイしています..."
npx cdk deploy --require-approval never

# 結果の表示
echo ""
echo "✅ デプロイが完了しました！"
echo ""
echo "AWSコンソールでスタックを確認:"
echo "https://console.aws.amazon.com/cloudformation/home?region=${CDK_REGION:-ap-northeast-1}"