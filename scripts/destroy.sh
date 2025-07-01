#!/bin/bash

# CDK削除スクリプト - 安全なリソース削除

set -e  # エラーが発生したら即座に停止

# 使い方の表示
if [ $# -eq 0 ]; then
    echo "使い方: $0 <環境>"
    echo "  環境: dev, stg, または prod"
    echo ""
    echo "例:"
    echo "  $0 dev    # 開発環境のスタックを削除"
    exit 1
fi

ENV=$1
echo "🗑️  $ENV 環境を削除します"
echo "======================"

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

echo "📋 削除するスタック:"
echo "  アカウント: $CDK_ACCOUNT"
echo "  リージョン: ${CDK_REGION:-ap-northeast-1}"
echo "  環境: $CDK_ENV"
echo "  スタック群: web3cdk-$ENV-* (全スタック)"

# プロダクション環境の場合は特別な確認
if [ "$ENV" = "prod" ]; then
    echo ""
    echo "⚠️  警告: 本番環境のスタックを削除しようとしています！"
    echo "この操作は元に戻せません！"
    read -p "'destroy production' と入力して確認してください: " confirm
    if [ "$confirm" != "destroy production" ]; then
        echo "削除がキャンセルされました"
        exit 0
    fi
else
    # 開発/ステージング環境でも確認
    echo ""
    read -p "本当にスタックを削除しますか？ (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "削除がキャンセルされました"
        exit 0
    fi
fi

# スタックの削除
echo ""
echo "🗑️  スタックを削除しています..."
npx cdk destroy --all --force

echo ""
echo "✅ スタックが正常に削除されました！"