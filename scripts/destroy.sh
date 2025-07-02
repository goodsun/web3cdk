#!/bin/bash

# CDK削除スクリプト - 安全なリソース削除

echo ""
echo -e "\033[31m╔══════════════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[31m║                          🗑️  CDK スタック削除                            ║\033[0m"
echo -e "\033[31m║                    依存関係を考慮して安全にリソース削除                  ║\033[0m"
echo -e "\033[31m╚══════════════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

set -e  # エラーが発生したら即座に停止

# 使い方の表示
if [ $# -eq 0 ]; then
    echo "使い方: $0 <環境> [--stacks <スタック名>]"
    echo "  環境: dev, stg, または prod"
    echo ""
    echo "例:"
    echo "  $0 dev                              # 開発環境の全スタックを削除"
    echo "  $0 dev --stacks web3cdk-dev-ec2     # EC2スタックのみ削除"
    echo "  $0 prod                             # 本番環境の全スタックを削除"
    exit 1
fi

ENV=$1
shift

# --stacksオプションの処理
STACKS_OPTION=""
if [ "$1" = "--stacks" ]; then
    if [ -z "$2" ]; then
        echo "❌ --stacksオプションにはスタック名を指定してください"
        exit 1
    fi
    STACKS_OPTION="$2"
    shift 2
fi
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

if [ -n "$STACKS_OPTION" ]; then
    echo "📋 削除する対象:"
    echo "  アカウント: $CDK_ACCOUNT"
    echo "  リージョン: ${CDK_REGION:-ap-northeast-1}"
    echo "  環境: $CDK_ENV"
    echo "  対象スタック: $STACKS_OPTION"
else
    echo "📋 削除するスタック:"
    echo "  アカウント: $CDK_ACCOUNT"
    echo "  リージョン: ${CDK_REGION:-ap-northeast-1}"
    echo "  環境: $CDK_ENV"
    echo "  スタック群:"
    echo "    - web3cdk-$ENV-ec2 (EC2インスタンス)"
    echo "    - web3cdk-$ENV-bot-api (Discord Bot API)"
    echo "    - web3cdk-$ENV-cache-api (キャッシュAPI)"
    echo "    - web3cdk-$ENV-storage (S3ストレージ)"
    echo "    - web3cdk-$ENV-network (VPC/セキュリティグループ)"
fi

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

# 削除の実行
echo ""
if [ -n "$STACKS_OPTION" ]; then
    echo "🗑️  指定されたスタックを削除しています: $STACKS_OPTION"
    
    # スタックの存在確認
    if npx cdk list 2>/dev/null | grep -q "${STACKS_OPTION}"; then
        echo "✓ ${STACKS_OPTION} が見つかりました"
        if npx cdk destroy ${STACKS_OPTION} --force; then
            echo "✅ ${STACKS_OPTION} の削除完了"
        else
            echo "❌ ${STACKS_OPTION} の削除に失敗しました"
            exit 1
        fi
    else
        echo "❌ ${STACKS_OPTION} が見つかりません"
        exit 1
    fi
else
    echo "🗑️  スタックを削除しています..."
    echo "依存関係を考慮して順番に削除します"

    # スタック名のプレフィックス
    STACK_PREFIX="web3cdk-${ENV}"

    # 削除関数
    delete_stack() {
        local stack_name=$1
        local description=$2

        echo ""
        echo "${description}を削除中..."

        # スタックの存在確認
        if npx cdk list 2>/dev/null | grep -q "${stack_name}"; then
            echo "✓ ${stack_name} が見つかりました"
            if npx cdk destroy ${stack_name} --force; then
                echo "✅ ${stack_name} の削除完了"
            else
                echo "⚠️  ${stack_name} の削除に失敗しました - 継続します"
            fi
        else
            echo "ℹ️  ${stack_name} が見つかりません - スキップ"
        fi
    }

    # 1. EC2スタックを最初に削除（他のスタックのExportを参照しているため）
    delete_stack "${STACK_PREFIX}-ec2" "1/5 EC2スタック"

    # 2. Bot APIスタックを削除
    delete_stack "${STACK_PREFIX}-bot-api" "2/5 Bot APIスタック"

    # 3. Cache APIスタックを削除
    delete_stack "${STACK_PREFIX}-cache-api" "3/5 Cache APIスタック"

    # 4. Storageスタックを削除
    delete_stack "${STACK_PREFIX}-storage" "4/5 Storageスタック"

    # 5. Networkスタックを最後に削除（他のスタックが依存しているため）
    delete_stack "${STACK_PREFIX}-network" "5/5 Networkスタック"
fi

echo ""
echo "✅ 全てのスタックの削除処理が完了しました！"
echo "💡 エラーが発生した場合は、AWSコンソールで手動確認してください"
