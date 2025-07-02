import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly publicSubnet: ec2.PublicSubnet;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // VPC作成 (10.0.0.0/16)
    this.vpc = new ec2.Vpc(this, 'Web3CdkVpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 1, // シンプルな構成のため1つのAZのみ
      natGateways: 0, // NAT Gatewayは不要（パブリックサブネットのみ）
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // パブリックサブネットの取得
    this.publicSubnet = this.vpc.publicSubnets[0] as ec2.PublicSubnet;

    // セキュリティグループ作成
    this.securityGroup = new ec2.SecurityGroup(this, 'Web3CdkSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Web3 CDK infrastructure',
      allowAllOutbound: true,
    });

    // HTTP接続許可 (80番ポート) - 全世界からアクセス可能
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    );

    // HTTPS接続許可 (443番ポート) - 全世界からアクセス可能
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS access'
    );

    // SSH接続許可 (22番ポート) - 管理者IP限定
    // TODO: 実際の管理者IPアドレスに変更してください
    const adminCidr = process.env.ADMIN_CIDR || '0.0.0.0/0'; // 環境変数で設定
    if (adminCidr === '0.0.0.0/0') {
      console.warn('⚠️ WARNING: SSH access is open to all IPs. Set ADMIN_CIDR environment variable for security.');
    }
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(adminCidr),
      ec2.Port.tcp(22),
      'Allow SSH access from admin'
    );

    // Geth RPC/WebSocket用ポート - 仕様書通り（要セキュリティ制限）
    const gethCidr = process.env.GETH_CIDR || '0.0.0.0/0';
    if (gethCidr === '0.0.0.0/0') {
      console.warn('⚠️ WARNING: Geth RPC/WS access is open to all IPs. Set GETH_CIDR environment variable for security.');
    }
    
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(gethCidr),
      ec2.Port.tcp(8545),
      'Allow Geth RPC access'
    );

    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(gethCidr),
      ec2.Port.tcp(8546),
      'Allow Geth WebSocket access'
    );

    // Application Load Balancer経由でのGethアクセス用
    // ALB作成時に別途セキュリティグループを作成予定
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4('10.0.0.0/16'),
      ec2.Port.tcp(3000),
      'Allow application access from VPC'
    );

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);

    // 出力
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'PublicSubnetId', {
      value: this.publicSubnet.subnetId,
      description: 'Public Subnet ID',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Security Group ID',
    });
  }
}