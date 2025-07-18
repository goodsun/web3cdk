# コンソール色分けガイド

## 基本方針
初学者が直感的に理解できるよう、メッセージの重要度と種類を色で視覚的に表現します。

## 色分けルール

### 🔴 エラー・警告系
```bash
# エラーメッセージ
echo -e "\033[31m❌ エラーメッセージ\033[0m"

# 警告メッセージ  
echo -e "\033[33m⚠️  警告メッセージ\033[0m"
```

### 🟢 成功・完了系
```bash
# 成功メッセージ
echo -e "\033[32m✅ 成功メッセージ\033[0m"

# 処理中メッセージ
echo -e "\033[36m🔧 処理中メッセージ\033[0m"
```

### 🔵 情報・Tips系
```bash
# 上級者向けTips（学習情報）
echo -e "\033[34m💡 上級者向けTips\033[0m"

# 補足情報（オプション情報）
echo -e "\033[35m📝 補足情報\033[0m"

# 一般情報
echo -e "\033[37m📋 一般情報\033[0m"
```

### 🟡 強調系
```bash
# 重要なアクション
echo -e "\033[1;33m🚀 重要なアクション\033[0m"

# 設定・構成情報
echo -e "\033[1;36m📊 設定情報\033[0m"
```

## 実装例

### setup.sh での使用例
```bash
echo -e "\033[32m✅ セットアップが完了しました！\033[0m"
echo -e "\033[34m💡 上級者向けTips: AWS_PROFILE を変更する場合は...\033[0m"
echo -e "\033[33m⚠️  重要: ADMIN_CIDR を実際のIPアドレスに変更してください\033[0m"
```

### deploy.sh での使用例
```bash
echo -e "\033[1;33m🚀 スタックをデプロイしています（全スタック一括）...\033[0m"
echo -e "\033[34m💡 上級者向けTips: 個別デプロイも可能です\033[0m"
echo -e "\033[35m   npx cdk deploy web3cdk-$ENV-network    # ネットワークのみ\033[0m"
```

## カラーコード参考

| 色 | コード | 用途 |
|---|---|---|
| 赤 | `\033[31m` | エラー |
| 黄 | `\033[33m` | 警告 |
| 緑 | `\033[32m` | 成功 |
| シアン | `\033[36m` | 処理中 |
| 青 | `\033[34m` | Tips・学習情報 |
| マゼンタ | `\033[35m` | 補足・オプション |
| 白 | `\033[37m` | 一般情報 |
| 太字黄 | `\033[1;33m` | 重要アクション |
| 太字シアン | `\033[1;36m` | 設定情報 |
| リセット | `\033[0m` | 色をリセット |

## 適用スクリプト
- `scripts/setup.sh`
- `scripts/deploy.sh`
- `scripts/diff.sh`
- `scripts/destroy.sh`

## 設計思想
- **初学者ファースト**: 直感的に理解できる色使い
- **情報階層**: 重要度を色で表現
- **学習促進**: Tips系は青で学習意欲を刺激
- **安全性**: 警告・エラーは赤・黄で注意喚起