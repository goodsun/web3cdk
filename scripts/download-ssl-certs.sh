#!/bin/bash

# SSL証明書ダウンロードスクリプト
# Usage: ./scripts/download-ssl-certs.sh [environment] [domain]

set -e

# 引数の処理
ENVIRONMENT=${1:-dev}
DOMAIN=${2:-}

# 環境設定の読み込み
ENV_FILE=".env.${ENVIRONMENT}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ 環境設定ファイルが見つかりません: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# ドメイン名の決定
if [[ -z "$DOMAIN" ]]; then
    if [[ -n "$DOMAIN_NAME" ]]; then
        DOMAIN="$DOMAIN_NAME"
    else
        echo "❌ ドメイン名が指定されていません"
        echo "Usage: $0 [environment] [domain]"
        echo "または .env.${ENVIRONMENT} に DOMAIN_NAME を設定してください"
        exit 1
    fi
fi

echo "🔒 SSL証明書ダウンロード開始"
echo "環境: $ENVIRONMENT"
echo "ドメイン: $DOMAIN"

# EC2インスタンスの情報取得（複数スタック名を試行）
POSSIBLE_STACKS=("web3cdk-${ENVIRONMENT}-ec2" "web3cdk${ENVIRONMENT}ec2Ec2F1BA2A31")

INSTANCE_ID=""
INSTANCE_IP=""
STACK_NAME=""

for stack in "${POSSIBLE_STACKS[@]}"; do
    echo "📋 スタック確認: $stack"
    
    INSTANCE_ID=$(aws cloudformation describe-stacks \
        --stack-name "$stack" \
        --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
        --output text \
        --region "$CDK_REGION" 2>/dev/null)
    
    if [[ -n "$INSTANCE_ID" && "$INSTANCE_ID" != "None" ]]; then
        INSTANCE_IP=$(aws cloudformation describe-stacks \
            --stack-name "$stack" \
            --query 'Stacks[0].Outputs[?OutputKey==`InstancePublicIp`].OutputValue' \
            --output text \
            --region "$CDK_REGION")
        STACK_NAME="$stack"
        echo "✅ スタック発見: $stack"
        break
    fi
done

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
    echo "❌ EC2インスタンスが見つかりません"
    echo "利用可能なスタック一覧:"
    aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
        --query 'StackSummaries[?contains(StackName, `web3cdk`) && contains(StackName, `'${ENVIRONMENT}'`)].StackName' \
        --output table \
        --region "$CDK_REGION"
    exit 1
fi

echo "インスタンスID: $INSTANCE_ID"
echo "インスタンスIP: $INSTANCE_IP"

# ローカルの保存ディレクトリ作成
LOCAL_SSL_DIR="ssl-backup/${ENVIRONMENT}/${DOMAIN}/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOCAL_SSL_DIR"

echo "📁 保存先: $LOCAL_SSL_DIR"

# SSH鍵の確認
SSH_KEY="${EC2_KEY_NAME:-web3cdk-${ENVIRONMENT}}"
SSH_KEY_PATH="$HOME/.ssh/${SSH_KEY}.pem"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
    echo "❌ SSH鍵が見つかりません: $SSH_KEY_PATH"
    exit 1
fi

# SSH接続テスト
echo "🔗 SSH接続テスト..."
if ! ssh -i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "echo 'SSH接続成功'" >/dev/null 2>&1; then
    echo "❌ SSH接続に失敗しました"
    echo "以下を確認してください："
    echo "- セキュリティグループでSSH(22番ポート)が開いているか"
    echo "- SSH鍵が正しいか: $SSH_KEY_PATH"
    echo "- インスタンスが起動中か"
    exit 1
fi

echo "✅ SSH接続成功"

# Let's Encryptディレクトリの確認
echo "📂 証明書ディレクトリの確認..."
REMOTE_SSL_DIR="/etc/letsencrypt/archive/${DOMAIN}"

if ! ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "sudo test -d '$REMOTE_SSL_DIR'"; then
    echo "❌ 証明書ディレクトリが見つかりません: $REMOTE_SSL_DIR"
    echo "Let's Encrypt証明書が作成されていない可能性があります"
    
    # 利用可能なドメインを表示
    echo "📋 利用可能なドメイン:"
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
        ec2-user@"$INSTANCE_IP" "sudo ls -la /etc/letsencrypt/archive/ 2>/dev/null || echo '証明書が作成されていません'"
    exit 1
fi

# 証明書ファイルの一覧取得
echo "📋 証明書ファイル一覧:"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "sudo ls -la '$REMOTE_SSL_DIR'"

# 証明書ファイルのダウンロード
echo "💾 証明書ファイルをダウンロード中..."

# 一時的にファイルをec2-userがアクセス可能な場所にコピー
TEMP_DIR="/tmp/ssl-backup-$(date +%s)"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "
    sudo mkdir -p '$TEMP_DIR'
    sudo cp '$REMOTE_SSL_DIR'/*.pem '$TEMP_DIR'/ 2>/dev/null || true
    sudo chown -R ec2-user:ec2-user '$TEMP_DIR'
    "

# scpでダウンロード（ファイルが存在する場合のみ）
if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "test -n \"\$(ls '$TEMP_DIR'/*.pem 2>/dev/null)\""; then
    scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
        ec2-user@"$INSTANCE_IP":"$TEMP_DIR"/*.pem "$LOCAL_SSL_DIR/"
    echo "✅ archive証明書ファイルのダウンロード完了"
else
    echo "⚠️  archive証明書ファイルのコピーに失敗しました"
fi

# サーバー上の一時ファイル削除
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "rm -rf '$TEMP_DIR'"

# live ディレクトリからの現在のシンボリックリンクもダウンロード
LIVE_DIR="/etc/letsencrypt/live/${DOMAIN}"
if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
    ec2-user@"$INSTANCE_IP" "sudo test -d '$LIVE_DIR'"; then
    
    echo "📂 現在の証明書（live）もダウンロード中..."
    TEMP_LIVE_DIR="/tmp/ssl-live-$(date +%s)"
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
        ec2-user@"$INSTANCE_IP" "
        sudo mkdir -p '$TEMP_LIVE_DIR'
        sudo cp -L '$LIVE_DIR'/*.pem '$TEMP_LIVE_DIR'/ 2>/dev/null || true
        sudo chown -R ec2-user:ec2-user '$TEMP_LIVE_DIR'
        "
    
    mkdir -p "$LOCAL_SSL_DIR/live"
    if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
        ec2-user@"$INSTANCE_IP" "test -n \"\$(ls '$TEMP_LIVE_DIR'/*.pem 2>/dev/null)\""; then
        scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
            ec2-user@"$INSTANCE_IP":"$TEMP_LIVE_DIR"/*.pem "$LOCAL_SSL_DIR/live/"
        echo "✅ live証明書ファイルのダウンロード完了"
    else
        echo "⚠️  live証明書ファイルのコピーに失敗しました"
    fi
    
    ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
        ec2-user@"$INSTANCE_IP" "rm -rf '$TEMP_LIVE_DIR'"
fi

# ダウンロード結果の確認
echo "✅ SSL証明書のダウンロード完了"
echo "📁 保存場所: $LOCAL_SSL_DIR"
echo ""
echo "📋 ダウンロードしたファイル:"
find "$LOCAL_SSL_DIR" -type f -exec ls -la {} \;

echo ""
echo "🔒 証明書の有効期限確認:"
if [[ -f "$LOCAL_SSL_DIR/live/cert.pem" ]]; then
    openssl x509 -in "$LOCAL_SSL_DIR/live/cert.pem" -text -noout | grep -A2 "Validity"
elif [[ -f "$LOCAL_SSL_DIR/cert1.pem" ]]; then
    openssl x509 -in "$LOCAL_SSL_DIR/cert1.pem" -text -noout | grep -A2 "Validity"
fi

echo ""
echo "💡 復元時は以下のファイルを使用:"
echo "- 証明書: cert.pem (または cert1.pem)"
echo "- 秘密鍵: privkey.pem (または privkey1.pem)"
echo "- 中間証明書: chain.pem (または chain1.pem)"
echo "- フル証明書: fullchain.pem (または fullchain1.pem)"