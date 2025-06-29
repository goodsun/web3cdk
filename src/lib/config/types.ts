/**
 * 設定の型定義
 * プロジェクト全体で使用する設定の型を定義
 */

import * as cdk from 'aws-cdk-lib';

export interface ProjectConfig {
  name: string;
  description: string;
  version?: string;
}

export interface TagsConfig {
  Project: string;
  Environment: string;
  ManagedBy: string;
  CostCenter?: string;
  Owner?: string;
}

export interface S3Config {
  versioning: boolean;
  encryption: 'S3_MANAGED' | 'KMS' | 'KMS_MANAGED';
  publicAccess: 'BLOCK_ALL' | 'BLOCK_ACLS' | 'BLOCK_POLICY' | 'IGNORE_PUBLIC_ACLS';
  lifecycleDays?: number;
  backupEnabled?: boolean;
}

export interface VPCConfig {
  maxAzs: number;
  natGateways: number;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  flowLogsEnabled?: boolean;
}

export interface LambdaConfig {
  timeout: number;
  memorySize: number;
  runtime: string;
  logRetentionDays: number;
  tracingEnabled: boolean;
}

export interface MonitoringConfig {
  dashboardEnabled: boolean;
  alarmsEnabled: boolean;
  logInsightsEnabled: boolean;
  xrayTracingEnabled: boolean;
}

export interface SecurityConfig {
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
  iamRolesMinimalPermissions: boolean;
  cloudTrailEnabled: boolean;
  configEnabled: boolean;
  guardDutyEnabled?: boolean;
}

export interface CostConfig {
  budgetLimit?: number;
  budgetThreshold?: number;
  anomalyDetectionEnabled: boolean;
  costAllocationTagsEnabled: boolean;
}

export interface ApplicationConfig {
  appName: string;
  domainName?: string;
  stackName: string;
}

/**
 * 環境設定のメインインターフェース
 */
export interface EnvironmentConfig {
  environment: string;
  project: ProjectConfig;
  tags: TagsConfig;
  s3: S3Config;
  vpc?: VPCConfig;
  lambda?: LambdaConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  cost: CostConfig;
  application?: ApplicationConfig;
}

/**
 * CDKスタックに渡すプロパティ
 */
export interface BaseStackProps extends cdk.StackProps {
  environment: string;
  config?: EnvironmentConfig;
}

/**
 * 環境タイプの定義
 */
export type Environment = 'dev' | 'stg' | 'prod';

/**
 * リソース命名のパターン
 */
export interface NamingConfig {
  project: string;
  environment: string;
  component: string;
  resourceType: string;
}

/**
 * デプロイメント設定
 */
export interface DeploymentConfig {
  requireApproval: boolean;
  rollbackEnabled: boolean;
  healthCheckEnabled: boolean;
  canaryDeployment?: boolean;
}