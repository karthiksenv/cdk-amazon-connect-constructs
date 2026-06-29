import { aws_connect as connect, aws_iam as iam, aws_lambda as lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConnectInstance } from './connect-instance';

/**
 * Properties for LambdaIntegration.
 */
export interface LambdaIntegrationProps {
  /**
   * Amazon Connect instance to associate with the function.
   */
  readonly instance: IConnectInstance;

  /**
   * Lambda function that Amazon Connect can invoke.
   */
  readonly function: lambda.IFunction;
}

/**
 * Associates a Lambda function with an Amazon Connect instance and grants invoke access.
 */
export class LambdaIntegration extends Construct {
  /**
   * The underlying AWS::Connect::IntegrationAssociation resource.
   */
  public readonly association: connect.CfnIntegrationAssociation;

  public constructor(scope: Construct, id: string, props: LambdaIntegrationProps) {
    super(scope, id);

    if (!props.instance) {
      throw new Error('instance is required.');
    }
    if (!props.function) {
      throw new Error('function is required.');
    }

    this.association = new connect.CfnIntegrationAssociation(this, 'Resource', {
      instanceId: props.instance.instanceId,
      integrationArn: props.function.functionArn,
      integrationType: 'LAMBDA_FUNCTION',
    });

    props.function.addPermission('AllowAmazonConnectInvoke', {
      action: 'lambda:InvokeFunction',
      principal: new iam.ServicePrincipal('connect.amazonaws.com'),
      sourceArn: props.instance.instanceArn,
    });
  }
}
