#!/bin/bash

# CDK差分確認スクリプト - デプロイ前の安全確認

set -e  # エラーが発生したら即座に停止

# 使い方の表示
if [ $# -eq 0 ]; then
    echo "使い方: $0 <環境>"
    echo "  環境: dev, stg, または prod"
    echo ""
    echo "例:"
    echo "  $0 dev    # 開発環境の差分確認"
    echo "  $0 prod   # 本番環境の差分確認"
    exit 1
fi

ENV=$1
echo "🔍 $ENV 環境の差分を確認します"
echo "============================"

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

echo "📋 差分確認設定:"
echo "  アカウント: $CDK_ACCOUNT"
echo "  リージョン: ${CDK_REGION:-ap-northeast-1}"
echo "  環境: $CDK_ENV"

# TypeScriptのビルド
echo ""
echo "🔨 TypeScriptをビルドしています..."
npm run build

# CDK差分の確認
echo ""
echo "🔍 CDK差分を確認しています..."
echo "================================================"
npx cdk diff --app "npx ts-node --project tools/tsconfig.json src/bin/web3cdk.ts"

echo ""
echo "✅ 差分確認が完了しました！"
echo ""
echo "💡 次のステップ:"
echo "  差分を確認してデプロイ: npm run deploy:$ENV"