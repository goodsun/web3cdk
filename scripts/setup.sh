#!/bin/bash

# CDK セットアップスクリプト - シンプルで確実なセットアップ

echo ""
echo -e "\033[32m╔════════════════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[32m║                          🚀 Web3 CDK セットアップ                          ║\033[0m"
echo -e "\033[32m║                      AWS認証・環境設定・プロジェクト初期化                 ║\033[0m"
echo -e "\033[32m╚════════════════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

set -e  # エラーが発生したら即座に停止

# 引数から環境名を取得
ENV_ARG=${1:-"dev"}  # デフォルトはdev

echo "🚀 Web3 CDK セットアップスクリプト (${ENV_ARG}環境)"
echo "================================="

# 0. 既存の.envファイルチェック
ENV_FILE=".env.${ENV_ARG}"
if [ -f "$ENV_FILE" ]; then
    echo ""
    echo "✅ 既存の設定ファイルが見つかりました: $ENV_FILE"
    echo ""
    echo "📋 現在の設定内容:"
    echo "----------------------------------------"
    grep -E "^(CDK_ACCOUNT|CDK_REGION|CDK_ENV|PROJECT_NAME|ORG_NAME)" "$ENV_FILE" 2>/dev/null || echo "設定が見つかりません"
    echo "----------------------------------------"
    echo ""
    echo "💡 設定変更が必要な場合は、手動で編集してください:"
    echo "   vi $ENV_FILE"
    echo "   または"
    echo "   code $ENV_FILE"
    echo ""
    echo "🔍 設定確認後、必要に応じて以下を実行:"
    echo "   npm run bootstrap   # CDKブートストラップ"
    echo "   npm run deploy:$ENV_ARG  # デプロイ"
    echo ""
    exit 0
fi

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
read -p "⚠️  このAWSアカウントで続行しますか？ (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo ""
    echo "❌ ユーザーによってセットアップがキャンセルされました"
    echo ""
    echo "💡 AWSアカウントを変更するには:"
    echo "   export AWS_PROFILE=プロファイル名"
    echo "   npm run setup"
    echo ""
    echo "💡 利用可能なプロファイル:"
    if [ -f ~/.aws/credentials ]; then
        grep '^\[' ~/.aws/credentials | sed 's/\[//g' | sed 's/\]//g' | sed 's/^/   - /'
    else
        echo "   プロファイルが見つかりません。aws configure を実行してください。"
    fi
    exit 0
fi

echo "✅ 選択されたAWSアカウントで続行します"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "ap-northeast-1")
echo "✅ AWSアカウント: $ACCOUNT_ID"
echo "✅ リージョン: $REGION"

# 3. プロジェクト設定
echo ""
echo "3️⃣ プロジェクト設定"
echo "=================="

# デフォルト値（ディレクトリ名から）
DEFAULT_PROJECT=$(basename "$PWD")
DEFAULT_ORG="bonsoleil"
DEFAULT_ENV="$ENV_ARG"  # 引数から設定

# ユーザー入力
echo "プロジェクトの設定を行います:"
echo ""
read -p "プロジェクト名 [$DEFAULT_PROJECT]: " PROJECT_NAME
read -p "組織名 [$DEFAULT_ORG]: " ORG_NAME  
read -p "環境 [$DEFAULT_ENV]: " CDK_ENV

# デフォルト値適用
PROJECT_NAME=${PROJECT_NAME:-$DEFAULT_PROJECT}
ORG_NAME=${ORG_NAME:-$DEFAULT_ORG}
CDK_ENV=${CDK_ENV:-$DEFAULT_ENV}

# 生成値
CDK_QUALIFIER="${ORG_NAME}-${PROJECT_NAME}"
STACK_NAME="${ORG_NAME}-${PROJECT_NAME}-${CDK_ENV}-stack"
APP_NAME="${ORG_NAME}-${PROJECT_NAME}-${CDK_ENV}"

# 設定確認表示
echo ""
echo "📋 生成された設定:"
echo "├── プロジェクト名: $PROJECT_NAME"
echo "├── 組織名: $ORG_NAME"
echo "├── 環境: $CDK_ENV"
echo "├── CDK修飾子: $CDK_QUALIFIER"
echo "├── スタック名: $STACK_NAME"
echo "└── アプリ名: $APP_NAME"
echo ""
read -p "この設定で続行しますか？ (y/n): " config_confirm

if [ "$config_confirm" != "y" ] && [ "$config_confirm" != "Y" ]; then
    echo "❌ ユーザーによってセットアップがキャンセルされました"
    echo "💡 再設定するには npm run setup を実行してください"
    exit 0
fi

echo "✅ 設定が確認されました"

# 現在のIPアドレスを取得してセキュリティ設定を推奨
echo ""
echo "🔒 セキュリティ設定の推奨事項"
echo "==============================="
echo ""
echo "現在のIPアドレスを確認しています..."

# 現在のグローバルIPアドレスを取得
CURRENT_IP=""
if command -v curl &> /dev/null; then
    CURRENT_IP=$(curl -s https://httpbin.org/ip | grep -o '"origin": "[^"]*' | cut -d'"' -f4 2>/dev/null)
    if [ -z "$CURRENT_IP" ]; then
        CURRENT_IP=$(curl -s https://api.ipify.org 2>/dev/null)
    fi
fi

if [ -n "$CURRENT_IP" ]; then
    echo "📍 現在のグローバルIP: $CURRENT_IP"
    echo ""
    echo "🔧 推奨ADMIN_CIDR設定:"
    echo "  1. 単一IP許可: ${CURRENT_IP}/32 （最も安全）"
    echo "  2. 同一ネットワーク許可: ${CURRENT_IP%.*}.0/24 （オフィス・自宅）"
    echo "  3. 全世界許可: 0.0.0.0/0 （開発環境・テスト用）"
    echo ""
    echo "💡 設定例:"
    echo "  # 現在のIPのみ許可（推奨・最も安全）"
    echo "  ADMIN_CIDR=${CURRENT_IP}/32"
    echo ""
    echo "  # 同一ネットワーク許可（オフィス・自宅ネットワーク）"
    echo "  ADMIN_CIDR=${CURRENT_IP%.*}.0/24"
    echo ""
    echo "  # 全世界から許可（開発環境・動的IP環境）"
    echo "  ADMIN_CIDR=0.0.0.0/0"
    echo ""
    echo "⚠️  セキュリティレベル: 1 > 2 > 3 の順で安全です"
else
    echo "❌ 現在のIPアドレスを取得できませんでした"
    echo ""
    echo "💡 手動で設定してください:"
    echo "  1. https://whatismyipaddress.com/ でIPを確認"
    echo "  2. 以下から選択して .env.dev を編集："
    echo ""
    echo "     # 特定IPのみ許可（最も安全）"
    echo "     ADMIN_CIDR=[あなたのIP]/32"
    echo ""
    echo "     # 全世界から許可（開発環境・テスト用）"
    echo "     ADMIN_CIDR=0.0.0.0/0"
fi
echo ""

# 4. Node.jsとnpmの確認
echo ""
echo "4️⃣ Node.jsとnpmを確認しています..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません。"
    exit 1
fi
echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"

# 5. CDK依存関係のインストール
echo ""
echo "5️⃣ CDK依存関係をインストールしています..."
if [ ! -d "node_modules" ]; then
    npm install
fi
echo "✅ 依存関係がインストールされました"

# 6. 環境変数の設定ファイル作成
echo ""
echo "6️⃣ 環境設定ファイルを作成しています..."
ENV_FILE=".env.${CDK_ENV}"

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << EOF
# CDK環境設定
# setup.shによって生成 $(date)

# 必須環境変数
CDK_ACCOUNT=$ACCOUNT_ID
CDK_REGION=$REGION
CDK_ENV=$CDK_ENV  # 選択肢: dev, stg, prod

# CDKブートストラップ設定（ユーザー設定ベース）
PROJECT_NAME=$PROJECT_NAME
ORG_NAME=$ORG_NAME
CDK_QUALIFIER=$CDK_QUALIFIER
STACK_NAME=$STACK_NAME
APP_NAME=$APP_NAME

# AWSプロファイル（現在のプロファイルを自動設定）
AWS_PROFILE=${AWS_PROFILE:-default}

# セキュリティ設定
# 管理者のIPアドレス範囲（SSH接続用）
ADMIN_CIDR=$(if [ -n "$CURRENT_IP" ]; then echo "${CURRENT_IP}/32"; else echo "0.0.0.0/0"; fi)

# EC2設定（自動生成）
EC2_KEY_NAME=${PROJECT_NAME}-${CDK_ENV}
USE_ELASTIC_IP=true
# ELASTIC_IP_ALLOCATION_ID=eipalloc-xxxxx

# ドメイン設定（Phase 4で使用）
# DOMAIN_NAME=your-domain.com
# EMAIL=admin@your-domain.com

# Cache API設定
CACHE_CONTRACT_ADDRESSES=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D
CACHE_CHAIN_ID=1
CACHE_RPC_ENDPOINT=https://ethereum-rpc.publicnode.com
CACHE_ALLOWED_ORIGINS=*

# Bot API設定
DISCORD_PUBLIC_KEY=your-discord-public-key
DISCORD_APPLICATION_ID=your-discord-application-id
BOT_CORS_ORIGIN=*
EOF
    echo "✅ $ENV_FILE を作成しました"
else
    echo "ℹ️  $ENV_FILE は既に存在します"
    echo ""
    echo -e "\033[31m⚠️  重要: ローカルの秘密鍵ファイルを削除した場合\033[0m"
    echo -e "\033[31mAWS側のキーペアも手動で削除してください:\033[0m"
    echo -e "\033[31maws ec2 delete-key-pair --key-name ${PROJECT_NAME}-${CDK_ENV} --region $REGION\033[0m"
    echo ""
fi

# 7. EC2キーペアの作成
echo ""
echo "7️⃣ EC2キーペアを確認・作成しています..."

# キーペア名を取得
KEY_NAME="${PROJECT_NAME}-${CDK_ENV}"

# キーペアの存在確認
if aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
    echo "✅ キーペア '$KEY_NAME' は既に存在します"
else
    echo "🔧 キーペア '$KEY_NAME' を作成しています..."
    
    # ~/.sshディレクトリの作成
    mkdir -p ~/.ssh
    
    # 既存の秘密鍵ファイルがある場合の警告
    if [ -f ~/.ssh/"${KEY_NAME}.pem" ]; then
        echo ""
        echo -e "\033[31m⚠️  既存の秘密鍵ファイルが見つかりました: ~/.ssh/${KEY_NAME}.pem\033[0m"
        echo -e "\033[31m新しいキーペアを作成する前に、AWS側のキーペアを手動で削除してください:\033[0m"
        echo -e "\033[31maws ec2 delete-key-pair --key-name $KEY_NAME --region $REGION\033[0m"
        echo ""
        echo -e "\033[33m💡 削除後、このスクリプトを再実行してください\033[0m"
        exit 1
    fi
    
    # キーペアの作成
    echo "🔧 実行コマンド: aws ec2 create-key-pair --key-name $KEY_NAME --region $REGION"
    if aws ec2 create-key-pair --key-name "$KEY_NAME" --region "$REGION" --query 'KeyMaterial' --output text > ~/.ssh/"${KEY_NAME}.pem" 2>/tmp/keypair_error.log; then
        # 権限設定
        chmod 400 ~/.ssh/"${KEY_NAME}.pem"
        echo "✅ キーペア '$KEY_NAME' を作成しました"
        echo "📁 秘密鍵の保存場所: ~/.ssh/${KEY_NAME}.pem"
    else
        echo "❌ キーペアの作成に失敗しました"
        echo "🔍 エラー詳細:"
        cat /tmp/keypair_error.log
        echo ""
        echo "💡 手動で作成してください: aws ec2 create-key-pair --key-name $KEY_NAME --region $REGION"
        exit 1
    fi
fi

# 8. セットアップ完了
echo ""
echo "✅ セットアップが完了しました！"
echo ""
echo "📋 次のステップ:"
echo "1. 必要に応じて $ENV_FILE を確認・編集してください"
if [ -n "$CURRENT_IP" ]; then
    echo "   ✅ ADMIN_CIDR は自動的に現在のIP (${CURRENT_IP}/32) に設定されました"
else
    echo "   ⚠️  重要: ADMIN_CIDR を実際の管理者IPアドレスに変更してください"
fi
echo "   ✅ EC2_KEY_NAME: 自動設定されました (${PROJECT_NAME}-${CDK_ENV})"
echo "   ✅ EC2キーペア: 自動作成されました"
echo "   📝 DOMAIN_NAME: （Phase 4）ドメイン名を設定してください"
echo "2. 環境変数を読み込む: source $ENV_FILE"
echo "3. CDKをブートストラップ: npm run bootstrap"
echo "4. 最初のスタックをデプロイ: npm run deploy:$CDK_ENV"
echo ""
echo "🔒 セキュリティノート:"
if [ -n "$CURRENT_IP" ]; then
    echo "   SSH接続は現在のIP (${CURRENT_IP}) からのみ許可されます"
    echo "   IP変更時は .env.dev の ADMIN_CIDR を更新してください"
else
    echo "   SSH接続のセキュリティのため、ADMIN_CIDRの設定を忘れずに行ってください"
fi
echo ""
echo "コーディングを楽しんでください！ 🎉"
