import { aws_connect as connect } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { resourceNameFromSlashArn } from './private/arn';

/**
 * Common identity-management modes supported by Amazon Connect.
 */
export enum IdentityManagementType {
  /**
   * Amazon Connect stores user identities.
   */
  CONNECT_MANAGED = 'CONNECT_MANAGED',

  /**
   * Users are managed by an existing SAML identity provider.
   */
  SAML = 'SAML',

  /**
   * Users are managed by AWS Directory Service.
   */
  EXISTING_DIRECTORY = 'EXISTING_DIRECTORY',
}

/**
 * Capabilities enabled for an Amazon Connect instance.
 */
export interface ConnectInstanceAttributes {
  /**
   * Allow inbound calls.
   *
   * @default true
   */
  readonly inboundCalls?: boolean;

  /**
   * Allow outbound calls.
   *
   * @default true
   */
  readonly outboundCalls?: boolean;

  /**
   * Enable contact flow logs.
   *
   * @default false
   */
  readonly contactflowLogs?: boolean;

  /**
   * Enable contact lens.
   *
   * @default false
   */
  readonly contactLens?: boolean;

  /**
   * Enable early media.
   *
   * @default false
   */
  readonly earlyMedia?: boolean;

  /**
   * Enable use of custom chatbots.
   *
   * @default false
   */
  readonly useCustomTtsVoices?: boolean;
}

/**
 * An Amazon Connect instance reference.
 */
export interface IConnectInstance {
  /**
   * The Amazon Connect instance ARN.
   */
  readonly instanceArn: string;

  /**
   * The Amazon Connect instance ID.
   */
  readonly instanceId: string;
}

/**
 * Properties for a new Amazon Connect instance.
 */
export interface ConnectInstanceProps {
  /**
   * The instance alias shown in the Amazon Connect console.
   */
  readonly instanceAlias: string;

  /**
   * How identities are managed for this instance.
   *
   * @default IdentityManagementType.CONNECT_MANAGED
   */
  readonly identityManagementType?: IdentityManagementType;

  /**
   * Existing AWS Directory Service directory ID.
   *
   * Required when identityManagementType is EXISTING_DIRECTORY.
   *
   * @default - no directory ID
   */
  readonly directoryId?: string;

  /**
   * Instance capabilities.
   *
   * @default - inbound and outbound calls enabled
   */
  readonly attributes?: ConnectInstanceAttributes;
}

/**
 * L2-style wrapper for AWS::Connect::Instance.
 */
export class ConnectInstance extends Construct implements IConnectInstance {
  /**
   * Import an existing Amazon Connect instance by ARN.
   */
  public static fromInstanceArn(scope: Construct, id: string, instanceArn: string): IConnectInstance {
    return new ImportedConnectInstance(scope, id, instanceArn);
  }

  /**
   * The underlying CloudFormation resource.
   */
  public readonly resource: connect.CfnInstance;

  /**
   * The Amazon Connect instance ARN.
   */
  public readonly instanceArn: string;

  /**
   * The Amazon Connect instance ID.
   */
  public readonly instanceId: string;

  public constructor(scope: Construct, id: string, props: ConnectInstanceProps) {
    super(scope, id);

    if (!props.instanceAlias.trim()) {
      throw new Error('instanceAlias must not be empty.');
    }

    const identityManagementType = props.identityManagementType ?? IdentityManagementType.CONNECT_MANAGED;
    if (identityManagementType === IdentityManagementType.EXISTING_DIRECTORY && !props.directoryId) {
      throw new Error('directoryId is required when identityManagementType is EXISTING_DIRECTORY.');
    }

    this.resource = new connect.CfnInstance(this, 'Resource', {
      attributes: toCfnAttributes(props.attributes),
      directoryId: props.directoryId,
      identityManagementType,
      instanceAlias: props.instanceAlias,
    });

    this.instanceArn = this.resource.getAtt('Arn').toString();
    this.instanceId = this.resource.getAtt('Id').toString();
  }
}

class ImportedConnectInstance extends Construct implements IConnectInstance {
  public readonly instanceArn: string;
  public readonly instanceId: string;

  public constructor(scope: Construct, id: string, instanceArn: string) {
    super(scope, id);
    this.instanceArn = instanceArn;
    this.instanceId = resourceNameFromSlashArn(this, instanceArn);
  }
}

function toCfnAttributes(attributes?: ConnectInstanceAttributes): connect.CfnInstance.AttributesProperty {
  return {
    inboundCalls: attributes?.inboundCalls ?? true,
    outboundCalls: attributes?.outboundCalls ?? true,
    contactflowLogs: attributes?.contactflowLogs ?? false,
    contactLens: attributes?.contactLens ?? false,
    earlyMedia: attributes?.earlyMedia ?? false,
    useCustomTtsVoices: attributes?.useCustomTtsVoices ?? false,
  };
}
