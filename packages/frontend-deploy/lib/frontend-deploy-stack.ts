import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { S3StaticWebsiteOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export class FrontendDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const DOMAIN_NAME = 'shouldntve.com';
    const WWW_DOMAIN_NAME = `www.${DOMAIN_NAME}`;

    const hostedZone = new HostedZone(this, 'DomainHostedZone', {
      zoneName: DOMAIN_NAME,
    });

    const httpsCertificate = new Certificate(this, 'HttpsCertificate', {
      domainName: DOMAIN_NAME,
      subjectAlternativeNames: [WWW_DOMAIN_NAME],
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const staticSiteBucket = new cdk.aws_s3.Bucket(this, 'StaticSiteS3Bucket', {
      websiteIndexDocument: 'index.html',
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      publicReadAccess: true,
    });

    new cdk.aws_s3_deployment.BucketDeployment(this, 'DeployStaticSite', {
      sources: [
        cdk.aws_s3_deployment.Source.asset(
          path.join(__dirname, '../..', 'frontend', 'dist')
        ),
      ],
      destinationBucket: staticSiteBucket,
      cacheControl: [cdk.aws_s3_deployment.CacheControl.noCache()],
    });

    const cloudFrontDistribution = new cdk.aws_cloudfront.Distribution(
      this,
      'CloudFrontDistribution',
      {
        defaultBehavior: {
          origin: new S3StaticWebsiteOrigin(staticSiteBucket),
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: {
            responseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
          },
        },
        domainNames: [DOMAIN_NAME, WWW_DOMAIN_NAME],
        certificate: httpsCertificate,
      }
    );

    new ARecord(this, 'CloudFrontRedirect', {
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(cloudFrontDistribution)
      ),
      recordName: DOMAIN_NAME,
    });

    new ARecord(this, 'CloudFrontWWWRedirect', {
      zone: hostedZone,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(cloudFrontDistribution)
      ),
      recordName: WWW_DOMAIN_NAME,
    });

    // Outputs

    new cdk.CfnOutput(this, 'StaticSite Url', {
      value: staticSiteBucket.bucketWebsiteUrl,
      description: 'URL of the static site',
      exportName: `${id}-StaticSiteUrl`,
    });

    new cdk.CfnOutput(this, 'FeUrl', {
      value: cloudFrontDistribution.distributionDomainName,
      description: 'FE URL',
      exportName: `${id}-FE-Url`,
    });

    new cdk.CfnOutput(this, 'HostedZoneName', {
      value: hostedZone.zoneName,
      description: 'Hosted Zone Name',
      exportName: `${id}-HostedZoneId`,
    });
  }
}
