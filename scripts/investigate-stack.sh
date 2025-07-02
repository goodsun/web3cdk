#!/bin/bash

# 孤立スタック調査ツール - CDKブートストラップ削除後のスタック調査用

echo ""
echo -e "\033[90m╔════════════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[90m║                        🔍 スタック詳細調査                                ║\033[0m"
echo -e "\033[90m║                    孤立スタックの状況を詳細に分析                           ║\033[0m"
echo -e "\033[90m╚════════════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

set -e

# 使い方の表示
if [ $# -eq 0 ]; then
    echo ""
    echo "使い方:"
    echo "  $0 <stack-name>"
    echo ""
    echo "例:"
    echo "  $0 myprod      # .env.myprodを使用"
    echo "  $0 oldstack    # .env.oldstackを使用"
    echo ""
    echo "💡 このツールは以下の場合に使用します:"
    echo "  - CDKブートストラップを削除した後"
    echo "  - 孤立したスタックの調査・削除"
    echo "  - CDK操作不能なスタックの管理"
    exit 1
fi

STACK_ENV=$1
ENV_FILE=".env.${STACK_ENV}"

echo "🕵️ 孤立スタック調査ツール"
echo "========================"

# 指定された環境ファイル読み込み
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | sed 's/#.*//' | grep '=' | xargs)
    echo "✅ $ENV_FILE を読み込みました"
else
    echo "❌ $ENV_FILE が見つかりません"
    echo ""
    echo "💡 環境ファイルの作成例:"
    echo "cat > $ENV_FILE << EOF"
    echo "CDK_ACCOUNT=your-account-id"
    echo "CDK_REGION=ap-northeast-1"
    echo "STACK_NAME=YourStackName"
    echo "EOF"
    echo ""
    echo "📋 利用可能な環境ファイル:"
    ls -1 .env.* 2>/dev/null | sed 's/\.env\./  /' || echo "  (環境ファイルが見つかりません)"
    exit 1
fi

echo ""
echo "📋 対象スタック情報:"
echo "  アカウント: $CDK_ACCOUNT"
echo "  リージョン: $CDK_REGION"
echo "  スタック名: $STACK_NAME"
echo ""

# スタック存在確認
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$CDK_REGION" &>/dev/null; then
    echo "❌ スタック '$STACK_NAME' が見つかりません"
    echo "💡 スタック名を確認してください:"
    echo ""
    aws cloudformation list-stacks \
        --region "$CDK_REGION" \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
        --query 'StackSummaries[].StackName' \
        --output table
    exit 1
fi

# 操作選択
echo "🔍 調査・操作を選択してください:"
echo "1. スタック詳細表示"
echo "2. リソース一覧表示"
echo "3. スタック出力値表示"
echo "4. スタック削除"
echo "5. 終了"
echo ""
read -p "選択 (1-5): " choice

case $choice in
    1)
        echo "📊 スタック詳細:"
        aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$CDK_REGION" \
            --output table
        ;;
    2)
        echo "🔍 リソース一覧: (表示が多い場合は [q]キーで次へ)"
        aws cloudformation describe-stack-resources \
            --stack-name "$STACK_NAME" \
            --region "$CDK_REGION" \
            --query 'StackResources[].{Type:ResourceType,LogicalId:LogicalResourceId,Status:ResourceStatus,PhysicalId:PhysicalResourceId}' \
            --output table
        ;;
    3)
        echo "📤 スタック出力値:"
        aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$CDK_REGION" \
            --query 'Stacks[0].Outputs' \
            --output table 2>/dev/null || echo "出力値はありません"
        ;;
    4)
        echo "⚠️  WARNING: スタック '$STACK_NAME' を削除しようとしています！"
        echo "この操作は元に戻せません！"
        echo ""
        echo "💡 削除されるリソース: (表示が多い場合は [q]キーで次へ)"
        aws cloudformation describe-stack-resources \
            --stack-name "$STACK_NAME" \
            --region "$CDK_REGION" \
            --query 'StackResources[].{Type:ResourceType,PhysicalId:PhysicalResourceId}' \
            --output table
        echo ""
        read -p "削除を実行するには 'delete $STACK_NAME' と入力してください: " confirm
        if [ "$confirm" = "delete $STACK_NAME" ]; then
            echo "🗑️  $STACK_NAME を削除しています..."

            # 管理者権限で削除を試行
            if aws cloudformation delete-stack \
                --stack-name "$STACK_NAME" \
                --region "$CDK_REGION" 2>/dev/null; then
                echo "✅ 削除コマンドを実行しました（完了まで数分かかります）"
                echo ""
                echo "📋 削除状況確認:"
                echo "aws cloudformation wait stack-delete-complete --stack-name '$STACK_NAME' --region '$CDK_REGION'"
            else
                echo ""
                echo "⚠️  通常削除に失敗しました"
                echo ""
                echo "📋 エラーの原因:"
                echo "- CDKブートストラップ削除により、実行ロール (cdk-hnb659fds-cfn-exec-role) が存在しない"
                echo "- CloudFormationはこのロールを使ってリソースを削除しようとするが、ロールがないため失敗"
                echo "- AWSCloudFormationFullAccess を持っていても、存在しないロールは使えない"
                echo ""
                echo "🔧 解決策: ロールを指定せずに削除を実行します:"
                echo ""

                # CLI実行方法の提示
                echo "【削除方法】以下のコマンドを直接実行してください:"
                echo ""
                echo "aws cloudformation delete-stack \\"
                echo "  --stack-name \"$STACK_NAME\" \\"
                echo "  --region \"$CDK_REGION\""
                echo ""
                echo "⚠️  重要: このコマンドには以下の権限が必要です:"
                echo "- cloudformation:DeleteStack"
                echo "- スタック内のリソースを削除する権限 (S3, Lambda, IAM等)"
                echo ""

                # それでも失敗する場合の対処法
                echo "【それでも削除できない場合】"
                echo ""
                echo "1. スタック内のリソースに対する削除権限を確認"
                echo "   必要な権限例:"
                echo "   - s3:DeleteBucket, s3:DeleteObject"
                echo "   - lambda:DeleteFunction"
                echo "   - iam:DeleteRole, iam:DeleteRolePolicy"
                echo "   - その他スタック内のリソースに応じた削除権限"
                echo ""
                echo "2. 実行ロールを再作成してから削除"
                echo "   CDK実行ロール (cdk-hnb659fds-cfn-exec-role) を手動で再作成:"
                echo "   "
                echo "   aws iam create-role --role-name cdk-hnb659fds-cfn-exec-role-$CDK_ACCOUNT-$CDK_REGION \\"
                echo "     --assume-role-policy-document '{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cloudformation.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}'"
                echo "   "
                echo "   aws iam attach-role-policy --role-name cdk-hnb659fds-cfn-exec-role-$CDK_ACCOUNT-$CDK_REGION \\"
                echo "     --policy-arn arn:aws:iam::aws:policy/AdministratorAccess"
                echo "   "
                echo "   # ロール作成後、再度削除を実行"
                echo "   aws cloudformation delete-stack --stack-name \"$STACK_NAME\" --region \"$CDK_REGION\""
                echo ""
                echo "3. リソースを個別に削除（最終手段）"
                echo "   - S3バケット、Lambda関数、IAMロールなどを個別に削除"
                echo "   - 全リソース削除後、スタックは自動的に削除される"
                echo ""
                echo "4. 管理者権限を持つユーザーで実行"
                echo "   export AWS_PROFILE=admin-profile"
                echo "   npm run research ${STACK_ENV}"
                echo ""
                echo "現在の認証情報とポリシーを確認:"
                echo "aws sts get-caller-identity"
                echo "aws iam get-user-policy --user-name YOUR_USER_NAME --policy-name YOUR_POLICY_NAME"

                echo ""
                echo "📋 削除状況確認:"
                echo "aws cloudformation wait stack-delete-complete --stack-name '$STACK_NAME' --region '$CDK_REGION'"
            fi
        else
            echo "❌ 削除をキャンセルしました"
        fi
        ;;
    5)
        echo "👋 調査を終了します"
        ;;
    *)
        echo "❌ 無効な選択です"
        ;;
esac