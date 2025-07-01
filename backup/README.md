# Backup Directory

このディレクトリは **Git管理外** のバックアップ専用保管庫です。

## 📁 ディレクトリ構成

```
backup/
├── README.md           # このファイル（説明用）
├── ssl/               # SSL証明書バックアップ
│   └── [環境]/
│       └── [ドメイン]/
│           └── [タイムスタンプ]/
│               ├── cert1.pem      # サーバー証明書
│               ├── chain1.pem     # 中間証明書
│               ├── fullchain1.pem # フル証明書チェーン
│               └── privkey1.pem   # 秘密鍵
├── database/          # データベースバックアップ（将来用）
└── config/            # 設定ファイルバックアップ（将来用）
```

## 🔒 セキュリティについて

- **Git管理外**: このディレクトリの内容はGitにコミットされません
- **機密情報**: SSL秘密鍵などの機密データが含まれます
- **アクセス制限**: 適切なファイル権限を設定してください

## 📋 利用方法

### SSL証明書のバックアップ

```bash
# 環境の.envファイルから自動取得
./scripts/download-ssl-certs.sh dev

# ドメインを直接指定
./scripts/download-ssl-certs.sh dev your-domain.com
```

### バックアップファイルの確認

```bash
# 最新のバックアップ確認
ls -la backup/ssl/dev/your-domain.com/

# 証明書の有効期限確認
openssl x509 -in backup/ssl/dev/your-domain.com/latest/cert1.pem -text -noout | grep -A2 "Validity"
```

## ⚠️ 注意事項

1. **定期的なクリーンアップ**: 古いバックアップファイルは定期的に削除してください
2. **権限管理**: 秘密鍵ファイル（privkey*.pem）は適切な権限（600）を設定
3. **外部保存**: 重要なバックアップは外部ストレージにも保存することを推奨
4. **有効期限**: SSL証明書の有効期限（通常3ヶ月）にご注意ください

## 🗑️ クリーンアップコマンド例

```bash
# 30日以上古いSSLバックアップを削除
find backup/ssl -type d -name "20*" -mtime +30 -exec rm -rf {} \;

# 特定環境の古いバックアップを削除
find backup/ssl/dev -type d -name "20*" -mtime +7 -exec rm -rf {} \;
```

---

**重要**: このディレクトリの内容は機密情報を含む可能性があります。取り扱いには十分注意してください。