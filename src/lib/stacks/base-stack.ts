import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ConfigLoader, ConfigLoadError } from '../config/config-loader';
import { EnvironmentConfig, BaseStackProps } from '../config/types';

/**
 * ベーススタック
 * 全てのスタックが継承する基底クラス
 * 共通の設定読み込み、タグ付け、ネーミングロジックを提供
 */
export abstract class BaseStack extends cdk.Stack {
  protected readonly config: EnvironmentConfig;
  protected readonly projectName: string;
  public readonly envName: string;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, {
      ...props,
      description: props.description || `${id} for ${props.environment} environment`,
    });

    this.envName = props.environment;
    
    try {
      // 設定の読み込み
      this.config = props.config || ConfigLoader.load(this.envName);
      this.projectName = this.config.project.name;
      
      // 共通設定の適用
      this.applyTags();
      this.addStackOutputs();
      
      // 設定概要の表示（開発時のみ）
      if (this.envName === 'dev') {
        this.printConfigSummary();
      }
    } catch (error) {
      if (error instanceof ConfigLoadError) {
        throw new Error(`Failed to initialize BaseStack: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 共通タグの適用
   */
  private applyTags(): void {
    const tags = this.config.tags;
    
    Object.entries(tags).forEach(([key, value]) => {
      if (value) {
        cdk.Tags.of(this).add(key, value);
      }
    });

    // 追加の自動タグ
    cdk.Tags.of(this).add('StackName', this.stackName);
    cdk.Tags.of(this).add('Region', this.region);
    cdk.Tags.of(this).add('Account', this.account);
    cdk.Tags.of(this).add('CreatedBy', 'CDK');
    cdk.Tags.of(this).add('CreatedAt', new Date().toISOString().split('T')[0]);
  }

  /**
   * スタック共通の出力を追加
   */
  private addStackOutputs(): void {
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'Name of this CloudFormation stack',
    });

    new cdk.CfnOutput(this, 'Environment', {
      value: this.envName,
      description: 'Environment name',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
    });
  }

  /**
   * リソース名を生成するヘルパーメソッド
   * パターン: {project}-{environment}-{component}-{resourceType}
   */
  protected createResourceName(component: string, resourceType: string): string {
    return `${this.projectName}-${this.envName}-${component}-${resourceType}`;
  }

  /**
   * 一意なリソース名を生成するヘルパーメソッド（アカウントID付き）
   */
  protected createUniqueResourceName(component: string, resourceType: string): string {
    return `${this.projectName}-${this.envName}-${component}-${resourceType}-${this.account}`;
  }

  /**
   * 設定概要の表示（デバッグ用）
   */
  private printConfigSummary(): void {
    console.log(`\n📋 Stack Configuration Summary:`);
    console.log(`├── Stack: ${this.stackName}`);
    console.log(`├── Environment: ${this.envName}`);
    console.log(`├── Project: ${this.config.project.name}`);
    console.log(`├── Region: ${this.region}`);
    console.log(`├── Account: ${this.account}`);
    console.log(`└── Tags: ${Object.keys(this.config.tags).length} applied\n`);
  }

  /**
   * 条件付きリソース作成のヘルパー
   */
  protected createConditionalResource<T>(
    condition: boolean,
    createFn: () => T
  ): T | undefined {
    return condition ? createFn() : undefined;
  }

  /**
   * 環境別の値を取得するヘルパー
   */
  protected getEnvironmentValue<T>(values: { dev?: T; stg?: T; prod?: T }, defaultValue: T): T {
    const envValue = values[this.envName as keyof typeof values];
    return envValue !== undefined ? envValue : defaultValue;
  }

  /**
   * 本番環境かどうかを判定
   */
  protected isProduction(): boolean {
    return this.envName === 'prod';
  }

  /**
   * 開発環境かどうかを判定
   */
  protected isDevelopment(): boolean {
    return this.envName === 'dev';
  }

  /**
   * ステージング環境かどうかを判定
   */
  protected isStaging(): boolean {
    return this.envName === 'stg';
  }

  /**
   * デプロイ時刻をタグとして追加
   */
  protected addDeploymentTimestamp(): void {
    cdk.Tags.of(this).add('LastDeployment', new Date().toISOString());
  }

  /**
   * カスタムタグを追加
   */
  protected addCustomTags(customTags: Record<string, string>): void {
    Object.entries(customTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * リソースの削除ポリシーを環境に応じて設定
   */
  protected getRemovalPolicy(): cdk.RemovalPolicy {
    return this.isProduction() ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
  }

  /**
   * 自動削除オブジェクトの設定を環境に応じて取得
   */
  protected getAutoDeleteObjects(): boolean {
    return !this.isProduction();
  }
}