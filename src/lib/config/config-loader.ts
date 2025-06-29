import * as path from 'path';
import * as fs from 'fs';
import { EnvironmentConfig, Environment, ProjectConfig, TagsConfig } from './types';

/**
 * 設定読み込みエラー
 */
export class ConfigLoadError extends Error {
  constructor(message: string, public readonly environment?: string) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * 設定読み込みユーティリティ
 * デフォルト設定と環境別設定をマージして、型安全な設定を提供
 */
export class ConfigLoader {
  private static configCache = new Map<string, EnvironmentConfig>();
  
  /**
   * 環境設定を読み込む
   * @param environment 環境名 (dev, stg, prod)
   * @returns 環境設定
   */
  static load(environment: string): EnvironmentConfig {
    // 環境名の検証
    this.validateEnvironment(environment);
    
    // キャッシュから取得
    if (this.configCache.has(environment)) {
      return this.configCache.get(environment)!;
    }
    
    try {
      // デフォルト設定の読み込み
      const defaultConfig = this.loadDefaultConfig();
      
      // 環境別設定の読み込み
      const envConfig = this.loadEnvironmentConfig(environment);
      
      // 設定のマージ
      const mergedConfig = this.mergeConfigs(defaultConfig, envConfig, environment);
      
      // 設定の検証
      this.validateConfig(mergedConfig);
      
      // キャッシュに保存
      this.configCache.set(environment, mergedConfig);
      
      return mergedConfig;
    } catch (error) {
      throw new ConfigLoadError(
        `Failed to load configuration for environment '${environment}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        environment
      );
    }
  }
  
  /**
   * デフォルト設定を読み込む
   */
  private static loadDefaultConfig(): Partial<EnvironmentConfig> {
    const defaultsPath = path.join(process.cwd(), 'config', 'defaults.json');
    
    if (!fs.existsSync(defaultsPath)) {
      throw new Error(`Default config file not found: ${defaultsPath}`);
    }
    
    try {
      const content = fs.readFileSync(defaultsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse default config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 環境別設定を読み込む
   */
  private static loadEnvironmentConfig(environment: string): Partial<EnvironmentConfig> {
    const envConfigPath = path.join(process.cwd(), 'config', 'environments', `${environment}.json`);
    
    if (!fs.existsSync(envConfigPath)) {
      console.warn(`Environment config file not found: ${envConfigPath}. Using default config only.`);
      return {};
    }
    
    try {
      const content = fs.readFileSync(envConfigPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse environment config for '${environment}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 設定をマージする
   */
  private static mergeConfigs(
    defaultConfig: Partial<EnvironmentConfig>, 
    envConfig: Partial<EnvironmentConfig>,
    environment: string
  ): EnvironmentConfig {
    // ディープマージを実行
    const merged = this.deepMerge(defaultConfig, envConfig) as EnvironmentConfig;
    
    // 環境名を設定
    merged.environment = environment;
    
    // タグに環境名を追加
    if (merged.tags) {
      merged.tags.Environment = environment;
    }
    
    return merged;
  }
  
  /**
   * ディープマージユーティリティ
   */
  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * 環境名の検証
   */
  private static validateEnvironment(environment: string): void {
    const validEnvironments: Environment[] = ['dev', 'stg', 'prod'];
    
    if (!validEnvironments.includes(environment as Environment)) {
      throw new ConfigLoadError(
        `Invalid environment '${environment}'. Valid environments: ${validEnvironments.join(', ')}`,
        environment
      );
    }
  }
  
  /**
   * 設定の検証
   */
  private static validateConfig(config: EnvironmentConfig): void {
    const errors: string[] = [];
    
    // 必須フィールドの検証
    if (!config.project?.name) {
      errors.push('project.name is required');
    }
    
    if (!config.tags?.Project) {
      errors.push('tags.Project is required');
    }
    
    if (!config.tags?.ManagedBy) {
      errors.push('tags.ManagedBy is required');
    }
    
    // S3設定の検証
    if (config.s3) {
      if (!['S3_MANAGED', 'KMS', 'KMS_MANAGED'].includes(config.s3.encryption)) {
        errors.push('s3.encryption must be one of: S3_MANAGED, KMS, KMS_MANAGED');
      }
      
      if (!['BLOCK_ALL', 'BLOCK_ACLS', 'BLOCK_POLICY', 'IGNORE_PUBLIC_ACLS'].includes(config.s3.publicAccess)) {
        errors.push('s3.publicAccess must be one of: BLOCK_ALL, BLOCK_ACLS, BLOCK_POLICY, IGNORE_PUBLIC_ACLS');
      }
    }
    
    // VPC設定の検証
    if (config.vpc) {
      if (config.vpc.maxAzs < 1 || config.vpc.maxAzs > 6) {
        errors.push('vpc.maxAzs must be between 1 and 6');
      }
      
      if (config.vpc.natGateways < 0) {
        errors.push('vpc.natGateways must be 0 or greater');
      }
    }
    
    // Lambda設定の検証
    if (config.lambda) {
      if (config.lambda.timeout < 1 || config.lambda.timeout > 900) {
        errors.push('lambda.timeout must be between 1 and 900 seconds');
      }
      
      if (config.lambda.memorySize < 128 || config.lambda.memorySize > 10240) {
        errors.push('lambda.memorySize must be between 128 and 10240 MB');
      }
    }
    
    if (errors.length > 0) {
      throw new ConfigLoadError(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * 設定をリロードする（キャッシュをクリア）
   */
  static reload(environment?: string): void {
    if (environment) {
      this.configCache.delete(environment);
    } else {
      this.configCache.clear();
    }
  }
  
  /**
   * 利用可能な環境一覧を取得
   */
  static getAvailableEnvironments(): string[] {
    const envDir = path.join(process.cwd(), 'config', 'environments');
    
    if (!fs.existsSync(envDir)) {
      return [];
    }
    
    return fs.readdirSync(envDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }
  
  /**
   * 設定の概要を表示（デバッグ用）
   */
  static printConfigSummary(environment: string): void {
    try {
      const config = this.load(environment);
      
      console.log(`\n🔧 Configuration Summary for '${environment}' environment:`);
      console.log(`├── Project: ${config.project.name}`);
      console.log(`├── Description: ${config.project.description}`);
      console.log(`├── Tags: ${Object.entries(config.tags).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      console.log(`├── S3 Encryption: ${config.s3.encryption}`);
      console.log(`├── Monitoring: ${config.monitoring.dashboardEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`└── Security: CloudTrail ${config.security.cloudTrailEnabled ? 'Enabled' : 'Disabled'}\n`);
    } catch (error) {
      console.error(`Failed to load config summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}