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

# CDK差分実行と結果保存
DIFF_OUTPUT=$(npx cdk diff --all --app "npx ts-node --project tools/tsconfig.json src/bin/web3cdk.ts" 2>&1)
echo "$DIFF_OUTPUT"

# User Data変更による再作成の警告
if echo "$DIFF_OUTPUT" | grep -q "may be replaced.*UserData\|UserData.*may cause replacement"; then
    echo ""
    echo -e "\033[1;31m⚠️  重要な注意事項 ⚠️\033[0m"
    echo -e "\033[1;31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
    echo -e "\033[1;33m🔄 EC2インスタンスが再作成されます\033[0m"
    echo ""
    echo -e "\033[1;37m📋 再作成の理由:\033[0m"
    echo -e "   \033[37m• User Data（起動スクリプト）が変更されました\033[0m"
    echo -e "   \033[37m• 既存インスタンスでは新しい設定が適用されません\033[0m"
    echo -e "   \033[37m• AWS CDKが自動的に古いインスタンスを削除して新規作成します\033[0m"
    echo ""
    echo -e "\033[1;37m💾 影響:\033[0m"
    echo -e "   \033[33m• 現在のIPアドレスが変更される可能性があります\033[0m"
    echo -e "   \033[33m• SSH接続は新しいIPアドレスで行ってください\033[0m"
    echo -e "   \033[33m• インスタンス内のログ・一時ファイルは失われます\033[0m"
    echo ""
    echo -e "\033[1;37m🎯 デプロイ後の手順:\033[0m"
    echo -e "   \033[32m1. 新しいIPアドレスを確認\033[0m"
    echo -e "   \033[32m2. DNS設定を更新（ドメイン使用時）\033[0m"
    echo -e "   \033[32m3. SSH接続テスト\033[0m"
    echo -e "\033[1;31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
    echo ""
fi

echo ""
echo "✅ 差分確認が完了しました！"
echo ""
echo "💡 次のステップ:"
echo "  差分を確認してデプロイ: npm run deploy:$ENV"