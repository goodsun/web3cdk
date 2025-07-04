# Web3 CDK ドキュメント

Web3 CDKプロジェクトの全ドキュメント一覧です。目的に応じて適切なドキュメントをご参照ください。

## 🚀 はじめに

Web3 CDKは、AWS CDKをシンプルかつ効率的に立ち上げるためのツール群です。初学者から上級者まで、段階的に学習できる設計になっています。

## 📋 ガイド・マニュアル

実際の作業手順やセットアップ方法を説明したドキュメント群です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [CDK Bootstrap ガイド](guides/cdk-bootstrap-guide.md) | CDKブートストラップの完全手順 | 初心者〜中級者 |
| [移行手順書](guides/migration-step-by-step.md) | プロジェクト移行の具体的手順 | 中級者〜上級者 |

## 🏗️ 設計書

プロジェクトのアーキテクチャや設計思想を説明したドキュメント群です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [プロジェクト設計書](design/project-design.md) | 全体的な設計思想とアーキテクチャ | 全ユーザー |
| [アプリケーション構築方針](design/application-architecture.md) | 🏗️ アプリケーション設計の原則と方針 | 開発者 |
| [仕様書](design/specification.md) | 技術仕様と実装詳細 | 開発者 |
| [最適化ロードマップ](design/project-optimization-roadmap.md) | 今後の改善計画と方向性 | プロジェクト管理者 |

## 🏛️ アーキテクチャ

システム構成とスタック設計に関するドキュメント群です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [**スタック構成と役割**](architecture/stack-overview.md) | 🆕 各CDKスタックの役割と依存関係 | 全ユーザー |

## 📝 開発リソース

開発時に役立つ情報や学習履歴をまとめたドキュメント群です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [開発時の学び](development/development-learnings.md) | 開発過程で得られた知見と教訓 | 開発者 |
| [User Data変更履歴](development/user-data-changes.md) | EC2インスタンス設定の変更履歴 | インフラ担当者 |
| [コンソール色設定ガイド](development/console-color-guide.md) | 開発ツールの設定方法 | 開発者 |
| [**リバースプロキシ調査報告書**](development/httpd_reverse_proxy_investigation_report.md) | 🔧 AWS API Gateway向けプロキシ設定の問題調査・解決報告 | インフラ担当者・開発者 |

## ✅ チェックリスト

作業品質を保つためのチェックリスト集です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [CDKベストプラクティス](checklists/cdk-best-practices-checklist.md) | CDK開発時のベストプラクティス確認項目 | 開発者 |
| [ドキュメント整合性監査](checklists/documentation-audit-checklist.md) | ドキュメントと実装の整合性確認項目 | 全ユーザー |

## 🧪 テスト・品質保証

品質保証のためのテスト仕様書とガイド集です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [**リグレッションテスト実行ガイド**](testing/regression-test-guide.md) | 🆕 自動リグレッションテストの実行方法 | 開発者・QA担当者 |
| [**test環境ガイド**](testing/test-environment-guide.md) | 🆕 リグレッションテスト専用環境の使用方法 | 開発者・運用担当者 |
| [リグレッションテスト仕様書](testing/regression-test-plan.md) | テスト項目と実行計画の詳細 | QA担当者・開発者 |
| [スタックテスト仕様](testing/stack-test-specifications.md) | 各スタックのデプロイ後テスト手順 | 開発者・運用担当者 |

## 📋 計画書

プロジェクトの計画や戦略に関するドキュメント群です。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [プロジェクトマイルストーン](planning/milestones.md) | 🎯 進捗状況と今後の計画 | 全ユーザー |
| [移行計画書](planning/migration-plan.md) | システム移行の計画と戦略 | プロジェクト管理者 |

## 📚 既存マニュアル

従来のマニュアルディレクトリです。

| ドキュメント | 説明 | 対象 |
|-------------|------|------|
| [マニュアル索引](manual/index.md) | 既存マニュアルの索引 | 全ユーザー |

## 🎯 目的別ガイド

### 🔰 初めてWeb3 CDKを使う方
1. [プロジェクト設計書](design/project-design.md) でプロジェクト全体を理解
2. [CDK Bootstrap ガイド](guides/cdk-bootstrap-guide.md) でセットアップ
3. [CDKベストプラクティス](checklists/cdk-best-practices-checklist.md) で品質確保

### 🚀 既存システムから移行したい方
1. [移行計画書](planning/migration-plan.md) で全体計画を確認
2. [移行手順書](guides/migration-step-by-step.md) で具体的手順を実行
3. [仕様書](design/specification.md) で技術詳細を確認

### 💻 開発・カスタマイズしたい方
1. [仕様書](design/specification.md) で技術仕様を理解
2. [開発時の学び](development/development-learnings.md) で過去の知見を参考
3. [最適化ロードマップ](design/project-optimization-roadmap.md) で将来計画を確認

### 🔧 運用・保守担当の方
1. [User Data変更履歴](development/user-data-changes.md) で設定変更を確認
2. [リバースプロキシ調査報告書](development/httpd_reverse_proxy_investigation_report.md) でプロキシ設定のトラブルシューティング方法を確認
3. [CDKベストプラクティス](checklists/cdk-best-practices-checklist.md) で運用品質を確保
4. [コンソール色設定ガイド](development/console-color-guide.md) で開発環境を整備

### 🧪 テスト・品質保証担当の方
1. [**リグレッションテスト実行ガイド**](testing/regression-test-guide.md) で自動テストの実行方法を確認
2. [**test環境ガイド**](testing/test-environment-guide.md) でテスト専用環境の使用方法を理解
3. [リグレッションテスト仕様書](testing/regression-test-plan.md) でテスト項目と計画を確認
4. [スタックテスト仕様](testing/stack-test-specifications.md) で各コンポーネントのテスト手順を実行

## 💡 ドキュメントの更新について

このドキュメント索引は、新しいドキュメントが追加された際に更新してください。各カテゴリの説明と対象ユーザーを明確にすることで、適切なドキュメントを見つけやすくしています。

---

**📖 メインドキュメント**: プロジェクトの概要は [README.md](../README.md) をご確認ください。