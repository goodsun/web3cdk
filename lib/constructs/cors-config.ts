import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cdk from 'aws-cdk-lib';

/**
 * CORS設定を一元管理するクラス
 * CDKベストプラクティスに基づき、API GatewayレベルでCORSを設定
 */
export class CorsConfig {
  /**
   * API Gateway用のCORS設定を環境別に返す
   * @param environment - デプロイ環境 (development, staging, production)
   * @returns API GatewayのCorsOptions
   */
  static getApiGatewayCorsOptions(environment: string): apigateway.CorsOptions {
    return {
      allowOrigins: this.getAllowedOrigins(environment),
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: [
        'Content-Type',
        'X-Amz-Date',
        'Authorization',
        'X-Api-Key',
        'X-Amz-Security-Token',
        'X-Amz-User-Agent',
        'X-Signature-Ed25519',
        'X-Signature-Timestamp'
      ],
      allowCredentials: true,
      maxAge: cdk.Duration.hours(24),
      statusCode: 200,
    };
  }

  /**
   * 環境別に許可するオリジンのリストを返す
   * @param environment - デプロイ環境
   * @returns 許可するオリジンの配列
   */
  private static getAllowedOrigins(environment: string): string[] {
    switch (environment) {
      case 'prod':
      case 'production':
        // 本番環境では具体的なドメインのみ許可
        return [
          'https://nft.bizen.sbs',
          'https://dev2.bon-soleil.com',
          'https://bon-soleil.com',
          'https://www.bon-soleil.com'
        ];
      
      case 'stg':
      case 'staging':
        // ステージング環境
        return [
          'https://staging.bon-soleil.com',
          'https://nft-staging.bizen.sbs',
          'http://localhost:3000',
          'http://localhost:8080'
        ];
      
      case 'dev':
      case 'development':
      default:
        // 開発環境では全オリジンを許可（開発の利便性のため）
        return apigateway.Cors.ALL_ORIGINS;
    }
  }

  /**
   * Bot API用のCORS設定
   * Discord Botからのアクセスを考慮した設定
   */
  static getBotApiCorsOptions(environment: string): apigateway.CorsOptions {
    const baseOptions = this.getApiGatewayCorsOptions(environment);
    
    // Bot APIは内部利用のため、追加のヘッダーを許可
    if (baseOptions.allowHeaders && Array.isArray(baseOptions.allowHeaders)) {
      baseOptions.allowHeaders.push(
        'X-Discord-User-Id',
        'X-Discord-Guild-Id',
        'X-Bot-Token'
      );
    }
    
    return baseOptions;
  }

  /**
   * Cache API用のCORS設定
   * フロントエンドからの直接アクセスを考慮した設定
   */
  static getCacheApiCorsOptions(environment: string): apigateway.CorsOptions {
    return this.getApiGatewayCorsOptions(environment);
  }
}