import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface Ec2StackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  keyName?: string;
  useElasticIp?: boolean;
  elasticIpAllocationId?: string;
  forceRecreate?: boolean;
}

export class Ec2Stack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly elasticIp?: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);

    // IAMロール作成（EC2用）
    const ec2Role = new iam.Role(this, 'Ec2InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for Web3 CDK EC2 instance',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // DynamoDB、S3への権限を追加
    ec2Role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
      ],
      resources: ['*'], // 後でリソース固有に制限
    }));

    // インスタンスプロファイル作成
    const instanceProfile = new iam.CfnInstanceProfile(this, 'Ec2InstanceProfile', {
      roles: [ec2Role.roleName],
    });

    // 環境変数の取得
    const domainName = process.env.DOMAIN_NAME;
    const email = process.env.EMAIL;

    // User Data スクリプト（初期設定）
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // システム更新
      'dnf update -y',
      
      // 必要なパッケージインストール（Amazon Linux 2023用）
      // curlの競合を解決してからhttpdをインストール
      'dnf install -y httpd mod_ssl git wget unzip python3-pip || true',
      'dnf install -y curl --allowerasing || true',
      
      // 開発・運用ツール
      'dnf install -y tmux htop tree vim jq net-tools nmap-ncat bind-utils rsync zip mlocate',
      
      // mlocate初期化（バックグラウンドで実行）
      'updatedb &',
      
      // Node.js インストール (v22.x) - Amazon Linux 2023対応
      'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -',
      'dnf install -y nodejs',
      
      // Apache モジュール有効化確認と設定
      'systemctl start httpd',
      'systemctl enable httpd',
      
      // 必要なApacheモジュールの有効化確認
      'grep -q "LoadModule rewrite_module" /etc/httpd/conf/httpd.conf || echo "LoadModule rewrite_module modules/mod_rewrite.so" >> /etc/httpd/conf/httpd.conf',
      'grep -q "LoadModule headers_module" /etc/httpd/conf/httpd.conf || echo "LoadModule headers_module modules/mod_headers.so" >> /etc/httpd/conf/httpd.conf',
      'grep -q "LoadModule proxy_module" /etc/httpd/conf/httpd.conf || echo "LoadModule proxy_module modules/mod_proxy.so" >> /etc/httpd/conf/httpd.conf',
      'grep -q "LoadModule proxy_http_module" /etc/httpd/conf/httpd.conf || echo "LoadModule proxy_http_module modules/mod_proxy_http.so" >> /etc/httpd/conf/httpd.conf',
      'grep -q "LoadModule ssl_module" /etc/httpd/conf.d/ssl.conf || echo "LoadModule ssl_module modules/mod_ssl.so" >> /etc/httpd/conf/httpd.conf',
      
      // Certbot (Let\'s Encrypt) インストール（Amazon Linux 2023用）
      'dnf install -y python3-certbot-apache cronie',
      
      // Apache設定ディレクトリの準備
      'mkdir -p /var/www/html',
      
      // ファイアウォール設定（Amazon Linux 2023では不要だが念のため）
      'systemctl stop firewalld || true',
      'systemctl disable firewalld || true',
      
      // Git グローバル設定（一時的）
      'git config --global user.name "EC2 User"',
      'git config --global user.email "ec2-user@example.com"',
      
      // ログディレクトリ作成
      'mkdir -p /var/log/web3cdk',
      'chown ec2-user:ec2-user /var/log/web3cdk',
    );

    // ドメイン設定がある場合のSSL証明書設定
    if (domainName && email) {
      userData.addCommands(
        // ドメイン用ディレクトリ作成
        `mkdir -p /var/www/html/${domainName}`,
        `echo '<h1>Web3 CDK Server</h1><p>Domain: ${domainName}</p><p>Setup completed at: '$(date)'</p>' > /var/www/html/${domainName}/index.html`,
        
        // 基本的なvhost設定作成（HTTP用、SSL証明書取得前）
        `cat > /etc/httpd/conf.d/${domainName}.conf << 'VHOST_EOF'
<VirtualHost *:80>
    ServerName ${domainName}
    DocumentRoot /var/www/html/${domainName}
    
    # SSL証明書取得のためのWebroot認証
    Alias /.well-known/acme-challenge /var/www/html/.well-known/acme-challenge
    <Directory "/var/www/html/.well-known/acme-challenge">
        Options None
        AllowOverride None
        Require all granted
    </Directory>
    
    # SSL証明書取得後はHTTPSへリダイレクト（後で設定）
    # RewriteEngine On
    # RewriteCond %{HTTPS} off
    # RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
    
    ErrorLog logs/${domainName}_error.log
    CustomLog logs/${domainName}_access.log combined
</VirtualHost>
VHOST_EOF`,
        
        // Apache再起動
        'systemctl reload httpd',
        
        // DNS設定確認とSSL証明書取得
        `echo "Checking DNS configuration for ${domainName}..." >> /var/log/web3cdk/setup.log`,
        'SERVER_IP=$(curl -s https://api.ipify.org)',
        `DNS_IP=$(dig +short ${domainName} | tail -n1)`,
        'echo "Server IP: $SERVER_IP, DNS IP: $DNS_IP" >> /var/log/web3cdk/setup.log',
        `if [ "$SERVER_IP" = "$DNS_IP" ]; then
          echo "DNS configuration matches. Proceeding with SSL certificate..." >> /var/log/web3cdk/setup.log
          /usr/bin/certbot-3 --apache -d ${domainName} --email ${email} --agree-tos --non-interactive --redirect
          echo "SSL certificate setup completed" >> /var/log/web3cdk/setup.log
        else
          echo "DNS configuration mismatch. Skipping SSL certificate setup." >> /var/log/web3cdk/setup.log
          echo "Please update DNS: ${domainName} -> $SERVER_IP" >> /var/log/web3cdk/setup.log
          cat > /home/ec2-user/dns-update-required.txt << 'DNS_EOF'
🔧 DNS設定が必要です
====================

現在の状況:
  サーバーIP: $SERVER_IP
  DNS設定IP: $DNS_IP

SSL証明書を取得するには:

1. DNSを更新してください
   ${domainName} → $SERVER_IP

2. DNS更新後、SSLを手動設定
   sudo /usr/bin/certbot-3 --apache -d ${domainName} --email ${email}

または .env.dev を確認して再デプロイしてください。
DNS_EOF
          chown ec2-user:ec2-user /home/ec2-user/dns-update-required.txt
        fi`,
        
        // SSL証明書の自動更新設定
        'echo "0 12 * * * /usr/bin/certbot-3 renew --quiet" | crontab -',
        
        // SSL設定完了ログ
        `echo "SSL setup completed for ${domainName} at $(date)" >> /var/log/web3cdk/setup.log`
      );
    } else {
      userData.addCommands(
        // ドメイン設定がない場合のデフォルトページ
        'echo "<h1>Web3 CDK Server</h1><p>Basic Apache setup completed.</p><p>For SSL setup, configure DOMAIN_NAME and EMAIL in .env file and redeploy.</p>" > /var/www/html/index.html',
        
        // SSL手動設定の案内ファイル作成
        `cat > /home/ec2-user/ssl-setup-guide.txt << 'SSL_GUIDE_EOF'
🔒 SSL証明書の手動設定ガイド
================================

Phase 1でSSL証明書を設定するには：

1. .env.devファイルでドメイン設定
   DOMAIN_NAME=your-domain.com
   EMAIL=admin@your-domain.com

2. DNS設定の完了
   ドメインがこのサーバーのIPアドレスを指すよう設定

3. スタックの再デプロイ
   npm run deploy:dev

または手動でSSL証明書を取得：

1. SSH接続
   ssh -i ~/.ssh/web3cdk-dev.pem ec2-user@[サーバーIP]

2. certbotでSSL証明書取得
   sudo certbot --apache -d your-domain.com --email your-email@example.com

詳細は README.md をご確認ください。
SSL_GUIDE_EOF`,
        
        'chown ec2-user:ec2-user /home/ec2-user/ssl-setup-guide.txt',
        'echo "Basic setup completed (no domain configured). SSL guide created at /home/ec2-user/ssl-setup-guide.txt at $(date)" >> /var/log/web3cdk/setup.log'
      );
    }

    userData.addCommands(
      // セットアップ完了マーカー
      'echo "Web3 CDK EC2 setup completed at $(date)" >> /var/log/web3cdk/setup.log'
    );

    // 強制再作成対応：Logical IDに動的サフィックスを追加
    const forceRecreate = props.forceRecreate;
    const recreateSuffix = forceRecreate ? `-recreate-${Date.now()}` : '';

    // EC2インスタンス作成
    this.instance = new ec2.Instance(this, `Web3CdkInstance${recreateSuffix}`, {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.securityGroup,
      keyName: props.keyName,
      role: ec2Role,
      userData: userData,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      // インスタンス終了時にEBSボリュームも削除
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, {
          deleteOnTermination: true,
          encrypted: true,
        }),
      }],
    });

    // 再作成時のみ削除ポリシーを適用
    if (forceRecreate) {
      this.instance.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    }

    // Elastic IP の作成（オプション）
    if (props.useElasticIp) {
      if (props.elasticIpAllocationId) {
        // 既存のElastic IPを使用
        new ec2.CfnEIPAssociation(this, 'ElasticIpAssociation', {
          instanceId: this.instance.instanceId,
          allocationId: props.elasticIpAllocationId,
        });
      } else {
        // 新しいElastic IPを作成
        this.elasticIp = new ec2.CfnEIP(this, 'ElasticIP', {
          domain: 'vpc',
          instanceId: this.instance.instanceId,
        });
      }
    }

    // 再作成フラグのタグ設定（デバッグ用）
    if (forceRecreate) {
      cdk.Tags.of(this.instance).add('ForceRecreate', 'true');
      cdk.Tags.of(this.instance).add('RecreateTimestamp', Date.now().toString());
    }

    // タグ設定
    cdk.Tags.of(this).add('Project', props.projectName);
    cdk.Tags.of(this).add('Environment', props.environment);

    // 出力
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      description: 'EC2 Instance ID',
    });

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: this.instance.instancePublicIp,
      description: 'EC2 Instance Public IP',
    });

    if (this.elasticIp) {
      new cdk.CfnOutput(this, 'ElasticIp', {
        value: this.elasticIp.ref,
        description: 'Elastic IP Address',
      });
    }

    new cdk.CfnOutput(this, 'InstancePublicDnsName', {
      value: this.instance.instancePublicDnsName,
      description: 'EC2 Instance Public DNS Name',
    });

    // SSH接続コマンドの出力
    if (props.keyName) {
      new cdk.CfnOutput(this, 'SshCommand', {
        value: `ssh -i ~/.ssh/${props.keyName}.pem ec2-user@${this.instance.instancePublicIp}`,
        description: 'SSH Connection Command',
      });
    }
  }
}