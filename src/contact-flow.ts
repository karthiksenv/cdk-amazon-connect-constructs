import { aws_connect as connect } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConnectInstance } from './connect-instance';

/**
 * Amazon Connect contact flow type.
 */
export enum ContactFlowType {
  CONTACT_FLOW = 'CONTACT_FLOW',
  CUSTOMER_QUEUE = 'CUSTOMER_QUEUE',
  CUSTOMER_HOLD = 'CUSTOMER_HOLD',
  CUSTOMER_WHISPER = 'CUSTOMER_WHISPER',
  AGENT_HOLD = 'AGENT_HOLD',
  AGENT_WHISPER = 'AGENT_WHISPER',
  OUTBOUND_WHISPER = 'OUTBOUND_WHISPER',
  AGENT_TRANSFER = 'AGENT_TRANSFER',
  QUEUE_TRANSFER = 'QUEUE_TRANSFER',
  CAMPAIGN = 'CAMPAIGN',
}

/**
 * Contact flow lifecycle state.
 */
export enum ContactFlowState {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Properties for a JSON-backed contact flow.
 */
export interface ContactFlowProps {
  /**
   * The Amazon Connect instance that owns this contact flow.
   */
  readonly instance: IConnectInstance;

  /**
   * Contact flow name.
   */
  readonly name: string;

  /**
   * Serialized Amazon Connect contact flow JSON.
   */
  readonly content: string;

  /**
   * Contact flow type.
   *
   * @default ContactFlowType.CONTACT_FLOW
   */
  readonly contactFlowType?: ContactFlowType;

  /**
   * Optional description.
   *
   * @default - no description
   */
  readonly description?: string;

  /**
   * Flow state.
   *
   * @default ContactFlowState.ACTIVE
   */
  readonly state?: ContactFlowState;
}

/**
 * L2-style wrapper for AWS::Connect::ContactFlow.
 */
export class ContactFlow extends Construct {
  /**
   * Create a serialized contact flow body from an object.
   */
  public static stringify(definition: { [key: string]: unknown }): string {
    return JSON.stringify(definition, undefined, 2);
  }

  /**
   * The underlying CloudFormation resource.
   */
  public readonly resource: connect.CfnContactFlow;

  /**
   * The contact flow ARN.
   */
  public readonly contactFlowArn: string;

  public constructor(scope: Construct, id: string, props: ContactFlowProps) {
    super(scope, id);

    if (!props.name.trim()) {
      throw new Error('name must not be empty.');
    }
    validateJson(props.content);

    this.resource = new connect.CfnContactFlow(this, 'Resource', {
      content: props.content,
      description: props.description,
      instanceArn: props.instance.instanceArn,
      name: props.name,
      state: props.state ?? ContactFlowState.ACTIVE,
      type: props.contactFlowType ?? ContactFlowType.CONTACT_FLOW,
    });

    this.contactFlowArn = this.resource.getAtt('ContactFlowArn').toString();
  }
}

function validateJson(content: string): void {
  if (!content.trim()) {
    throw new Error('content must not be empty.');
  }

  try {
    JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`content must be valid JSON: ${message}`);
  }
}
