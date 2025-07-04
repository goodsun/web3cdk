#!/bin/bash

# ===========================================
# リグレッションテスト自動実行スクリプト
# ===========================================
# 目的: 定期的なリグレッションテストを自動化
# 方針: 開始時に必要情報を収集し、その後は全自動実行
# ===========================================

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# テスト結果を保存するディレクトリ
TEST_RESULTS_DIR="docs/testing/test-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$TEST_RESULTS_DIR"

# ログファイル
LOG_FILE="$TEST_RESULTS_DIR/regression-test.log"
SUMMARY_FILE="$TEST_RESULTS_DIR/summary.md"

# =====================================
# ユーティリティ関数
# =====================================
log() {
    echo -e "${1}" | tee -a "$LOG_FILE"
}

log_success() {
    log "${GREEN}✅ ${1}${NC}"
}

log_error() {
    log "${RED}❌ ${1}${NC}"
}

log_warning() {
    log "${YELLOW}⚠️  ${1}${NC}"
}

log_info() {
    log "${BLUE}ℹ️  ${1}${NC}"
}

# テスト結果を記録
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    echo "| $test_name | $result | $details |" >> "$SUMMARY_FILE"
}

# =====================================
# 事前確認
# =====================================
pre_flight_check() {
    log_info "=== リグレッションテスト事前確認 ==="
    
    # 必須コマンドの確認
    local required_commands=("aws" "cdk" "node" "npm" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd コマンドが見つかりません"
            exit 1
        fi
    done
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証が設定されていません"
        exit 1
    fi
    
    # 環境選択
    log_info "テスト環境を選択してください:"
    echo "1) test (推奨 - リグレッションテスト専用)"
    echo "2) dev"
    echo "3) staging"
    echo "4) prod"
    read -p "選択 [1-4] (デフォルト: 1): " env_choice
    
    case "$env_choice" in
        2) TEST_ENV="dev" ;;
        3) TEST_ENV="staging" ;;
        4) TEST_ENV="prod" ;;
        *) TEST_ENV="test" ;;
    esac
    
    log_info "選択された環境: $TEST_ENV"
    
    # テスト範囲の確認
    log_info "テスト範囲を選択してください:"
    echo "1) フルテスト (推奨)"
    echo "2) 基本機能のみ"
    echo "3) Lambda関数のみ"
    echo "4) カスタム選択"
    read -p "選択 [1-4] (デフォルト: 1): " test_scope
    
    case "$test_scope" in
        2) TEST_SCOPE="basic" ;;
        3) TEST_SCOPE="lambda" ;;
        4) TEST_SCOPE="custom" ;;
        *) TEST_SCOPE="full" ;;
    esac
    
    # Discord認証情報の確認（必要な場合）
    if [[ "$TEST_SCOPE" == "full" || "$TEST_SCOPE" == "lambda" ]]; then
        if [[ ! -f ".env.$TEST_ENV" ]]; then
            log_warning ".env.$TEST_ENV が見つかりません。Discord APIテストはスキップされます。"
            SKIP_DISCORD_TEST=true
        else
            SKIP_DISCORD_TEST=false
        fi
    fi
    
    # 確認画面
    log_info "=== テスト設定確認 ==="
    echo "環境: $TEST_ENV"
    echo "テスト範囲: $TEST_SCOPE"
    echo "Discord APIテスト: $([ "$SKIP_DISCORD_TEST" = true ] && echo "スキップ" || echo "実行")"
    echo "結果保存先: $TEST_RESULTS_DIR"
    echo ""
    read -p "この設定でテストを開始しますか？ (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_warning "テストがキャンセルされました"
        exit 0
    fi
}

# =====================================
# テスト実行関数
# =====================================

# 1. Bootstrap テスト
test_bootstrap() {
    log_info "=== Bootstrap テスト開始 ==="
    
    # 既存のBootstrap確認
    if aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        log_info "既存のCDKToolkitスタックを確認しました"
        
        # Bootstrap状態確認
        local stack_status=$(aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus' --output text)
        if [[ "$stack_status" == "CREATE_COMPLETE" || "$stack_status" == "UPDATE_COMPLETE" ]]; then
            log_success "Bootstrap 確認完了（既存のCDKToolkitを使用）"
            record_test_result "Bootstrap" "✅ 成功" "既存のCDKToolkitスタックを確認・使用"
            return 0
        else
            log_warning "CDKToolkitスタックが異常な状態です: $stack_status"
        fi
    else
        log_info "CDKToolkitスタックが見つかりません。新規作成します"
        
        # Bootstrap実行（自動モード）
        export REGRESSION_TEST=true
        if ./scripts/bootstrap.sh; then
            log_success "Bootstrap 成功"
            record_test_result "Bootstrap" "✅ 成功" "CDKToolkitスタック作成完了"
        else
            log_error "Bootstrap 失敗"
            record_test_result "Bootstrap" "❌ 失敗" "詳細はログを確認"
            return 1
        fi
    fi
}

# 2. Setup テスト
test_setup() {
    log_info "=== Setup テスト開始 ==="
    
    # テスト用の環境変数ファイル名
    TEST_ENV_FILE=".env.$TEST_ENV.test_$(date +%Y%m%d)"
    
    # 既存の.env.devがある場合はそれをコピーしてテスト用ファイルを作成
    if [[ -f ".env.$TEST_ENV" ]]; then
        log_info "既存の .env.$TEST_ENV をベースにテスト用設定を作成します"
        cp ".env.$TEST_ENV" "$TEST_ENV_FILE"
        
        # テスト用にいくつかの値を上書き（必要に応じて）
        log_info "テスト用環境変数ファイル: $TEST_ENV_FILE"
        
        log_success "Setup 成功（テスト用設定を作成）"
        record_test_result "Setup" "✅ 成功" "$TEST_ENV_FILE を作成"
        return 0
    fi
    
    # 自動入力用の設定
    cat > "$TEST_RESULTS_DIR/setup_input.txt" << EOF
$TEST_ENV
498997347996
ap-northeast-1
test-bot-token
test-guild-id
EOF
    
    # Setup実行
    if ./scripts/setup.sh < "$TEST_RESULTS_DIR/setup_input.txt"; then
        log_success "Setup 成功"
        record_test_result "Setup" "✅ 成功" ".env ファイル生成完了"
    else
        log_error "Setup 失敗"
        record_test_result "Setup" "❌ 失敗" "詳細はログを確認"
        return 1
    fi
}

# 3. Deploy テスト
test_deploy() {
    log_info "=== Deploy テスト開始 ==="
    
    # テスト用の環境変数ファイルが存在することを確認
    TEST_ENV_FILE=".env.$TEST_ENV.test_$(date +%Y%m%d)"
    if [[ ! -f "$TEST_ENV_FILE" ]]; then
        log_error "テスト用環境変数ファイルが見つかりません: $TEST_ENV_FILE"
        return 1
    fi
    
    # デプロイスクリプトがテスト用ファイルを使用するように環境変数ファイルをシンボリックリンク
    if [[ -f ".env.$TEST_ENV" && ! -L ".env.$TEST_ENV" ]]; then
        mv ".env.$TEST_ENV" ".env.$TEST_ENV.original"
    fi
    ln -sf "$TEST_ENV_FILE" ".env.$TEST_ENV"
    
    if ./scripts/deploy.sh "$TEST_ENV"; then
        log_success "Deploy 成功"
        record_test_result "Deploy" "✅ 成功" "全スタックデプロイ完了"
        
        # デプロイされたリソースの情報を収集
        ./scripts/list-stacks.sh > "$TEST_RESULTS_DIR/deployed_stacks.txt"
    else
        log_error "Deploy 失敗"
        record_test_result "Deploy" "❌ 失敗" "詳細はログを確認"
        return 1
    fi
}

# 4. Lambda関数テスト
test_lambda_functions() {
    log_info "=== Lambda関数テスト開始 ==="
    
    # API Gateway URLを取得
    local api_url=$(aws cloudformation describe-stacks \
        --stack-name "web3cdk-$TEST_ENV-bot-api" \
        --query 'Stacks[0].Outputs[?OutputKey==`BotApiUrl`].OutputValue' \
        --output text)
    
    if [[ -z "$api_url" ]]; then
        log_error "API Gateway URL が見つかりません"
        record_test_result "Lambda関数" "❌ 失敗" "API URL取得失敗"
        return 1
    fi
    
    # Hello エンドポイントテスト
    log_info "Hello エンドポイントテスト中..."
    if curl -s "${api_url}hello" | grep -q "Hello from Lambda"; then
        log_success "Hello エンドポイント: 正常"
        record_test_result "Hello API" "✅ 成功" "レスポンス正常"
    else
        log_error "Hello エンドポイント: 異常"
        record_test_result "Hello API" "❌ 失敗" "レスポンス異常"
    fi
    
    # Discord エンドポイントテスト（スキップ可能）
    if [[ "$SKIP_DISCORD_TEST" != true ]]; then
        log_info "Discord エンドポイントテスト中..."
        local response=$(curl -s -w "\n%{http_code}" "${api_url}discord/member/123456")
        local http_code=$(echo "$response" | tail -1)
        
        if [[ "$http_code" == "200" || "$http_code" == "404" ]]; then
            log_success "Discord エンドポイント: 正常 (HTTP $http_code)"
            record_test_result "Discord API" "✅ 成功" "HTTP $http_code"
        else
            log_error "Discord エンドポイント: 異常 (HTTP $http_code)"
            record_test_result "Discord API" "❌ 失敗" "HTTP $http_code"
        fi
    else
        log_warning "Discord エンドポイントテストをスキップ"
        record_test_result "Discord API" "⏭️ スキップ" "認証情報なし"
    fi
}

# 5. DynamoDBテスト
test_dynamodb() {
    log_info "=== DynamoDB テスト開始 ==="
    
    # テーブルの存在確認
    local tables=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `web3cdk`)]' --output json)
    
    if [[ $(echo "$tables" | jq '. | length') -gt 0 ]]; then
        log_success "DynamoDB テーブル作成確認"
        record_test_result "DynamoDB" "✅ 成功" "テーブル作成確認"
    else
        log_error "DynamoDB テーブルが見つかりません"
        record_test_result "DynamoDB" "❌ 失敗" "テーブルなし"
    fi
}

# 6. Destroy テスト
test_destroy() {
    log_info "=== Destroy テスト開始 ==="
    
    if ./scripts/destroy.sh "$TEST_ENV" -f; then
        log_success "Destroy 成功"
        record_test_result "Destroy" "✅ 成功" "全リソース削除完了"
    else
        log_error "Destroy 失敗"
        record_test_result "Destroy" "❌ 失敗" "詳細はログを確認"
        return 1
    fi
}

# =====================================
# サマリー生成
# =====================================
generate_summary() {
    cat > "$SUMMARY_FILE" << EOF
# リグレッションテスト結果サマリー

- 実施日時: $(date '+%Y-%m-%d %H:%M:%S')
- 環境: $TEST_ENV
- テスト範囲: $TEST_SCOPE

## テスト結果

| テスト項目 | 結果 | 備考 |
|------------|------|------|
EOF
    
    # ここでrecord_test_resultが追記される
    
    log_info "=== テスト結果サマリー ==="
    cat "$SUMMARY_FILE"
    
    log_info ""
    log_info "詳細なログは以下で確認できます:"
    log_info "  $LOG_FILE"
    log_info "  $SUMMARY_FILE"
}

# =====================================
# クリーンアップ処理
# =====================================
cleanup() {
    log_info "=== クリーンアップ処理 ==="
    
    # シンボリックリンクを元に戻す
    if [[ -L ".env.$TEST_ENV" ]]; then
        rm ".env.$TEST_ENV"
        if [[ -f ".env.$TEST_ENV.original" ]]; then
            mv ".env.$TEST_ENV.original" ".env.$TEST_ENV"
            log_info "元の .env.$TEST_ENV を復元しました"
        fi
    fi
    
    # テスト用環境変数ファイルの削除（オプション）
    TEST_ENV_FILE=".env.$TEST_ENV.test_$(date +%Y%m%d)"
    if [[ -f "$TEST_ENV_FILE" ]]; then
        log_info "テスト用環境変数ファイルを保持: $TEST_ENV_FILE"
        # 削除する場合は以下のコメントを外す
        # rm "$TEST_ENV_FILE"
    fi
}

# =====================================
# メイン処理
# =====================================
main() {
    log_info "リグレッションテスト開始: $(date)"
    
    # エラー時でもクリーンアップを実行
    trap cleanup EXIT
    
    # 事前確認
    pre_flight_check
    
    # テスト実行
    case "$TEST_SCOPE" in
        "full")
            test_bootstrap
            test_setup
            test_deploy
            test_lambda_functions
            test_dynamodb
            test_destroy
            ;;
        "basic")
            test_bootstrap
            test_setup
            test_deploy
            test_destroy
            ;;
        "lambda")
            test_deploy
            test_lambda_functions
            ;;
        "custom")
            log_info "カスタムテストは未実装です"
            ;;
    esac
    
    # サマリー生成
    generate_summary
    
    log_info "リグレッションテスト完了: $(date)"
}

# スクリプト実行
main "$@"