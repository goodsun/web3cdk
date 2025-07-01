import * as cdk from 'aws-cdk-lib';

/**
 * シンプルなスタックプロパティ
 * 環境変数ベースの設定用
 */
export interface SimpleStackProps extends cdk.StackProps {
  environment: string;
  projectName: string;
}