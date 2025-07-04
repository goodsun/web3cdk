#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                          📋 ヘルプメッセージ表示                             ║
# ║                       Web3 CDK コマンド一覧を表示                            ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

echo ""
echo -e "\033[32m╔══════════════════════════════════════════════════════════════════════════════╗\033[0m"
echo -e "\033[32m║                      📋 Web3 CDK 利用可能コマンド一覧                        ║\033[0m"
echo -e "\033[32m║                      便利なコマンドで効率的な開発を                          ║\033[0m"
echo -e "\033[32m╚══════════════════════════════════════════════════════════════════════════════╝\033[0m"
echo ""

echo '🚀 セットアップ:
  npm run setup      : AWS認証・環境設定
  npm run bootstrap   : CDKブートストラップ

📊 確認・調査:
  npm run list        : スタック一覧表示
  npm run research    : スタック詳細調査
  npm run diff:dev    : 開発環境の差分確認
  npm run diff:stg    : ステージング環境の差分確認
  npm run diff:prod   : 本番環境の差分確認

🚀 デプロイ:
  npm run deploy:dev  : 開発環境デプロイ（全スタック）
  npm run deploy:stg  : ステージング環境デプロイ（全スタック）
  npm run deploy:prod : 本番環境デプロイ（全スタック）

🎯 個別スタックデプロイ:
  npm run deploy:dev -- --stacks web3cdk-dev-network   : ネットワークのみ
  npm run deploy:dev -- --stacks web3cdk-dev-ec2       : EC2のみ
  npm run deploy:dev -- --stacks web3cdk-dev-storage   : ストレージのみ
  npm run deploy:dev -- --stacks web3cdk-dev-cache-api : Cache APIのみ
  npm run deploy:dev -- --stacks web3cdk-dev-bot-api   : Bot APIのみ

🗑️  削除:
  npm run destroy:dev : 開発環境削除（全スタック）
  npm run destroy:stg : ステージング環境削除（全スタック）
  npm run destroy:prod: 本番環境削除（全スタック）

🎯 個別スタック削除:
  npm run destroy:dev -- --stacks web3cdk-dev-ec2       : EC2のみ削除
  npm run destroy:dev -- --stacks web3cdk-dev-storage   : ストレージのみ削除
  npm run destroy:dev -- --stacks web3cdk-dev-cache-api : Cache APIのみ削除
  npm run destroy:dev -- --stacks web3cdk-dev-bot-api   : Bot APIのみ削除


🔧 開発:
  npm run build       : TypeScriptビルド
  npm run watch       : ファイル監視ビルド
  npm run test        : テスト実行
  npm run cdk         : CDK直接実行

💡 詳細な使い方は docs/ ディレクトリを参照してください
'
