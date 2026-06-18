import { ArnFormat, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export function resourceNameFromSlashArn(scope: Construct, arn: string): string {
  return Stack.of(scope).splitArn(arn, ArnFormat.SLASH_RESOURCE_NAME).resourceName ?? arn;
}
