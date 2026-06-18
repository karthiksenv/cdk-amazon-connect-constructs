import { aws_connect as connect } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConnectInstance } from './connect-instance';
import { IHoursOfOperation } from './hours-of-operation';
import { resourceNameFromSlashArn } from './private/arn';

/**
 * Queue availability.
 */
export enum QueueStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

/**
 * A phone-number-like outbound caller identity.
 */
export interface OutboundCallerConfig {
  /**
   * Outbound caller ID name.
   *
   * @default - Amazon Connect default
   */
  readonly outboundCallerIdName?: string;

  /**
   * Outbound caller ID phone number ARN.
   *
   * @default - Amazon Connect default
   */
  readonly outboundCallerIdNumberArn?: string;

  /**
   * Outbound flow ARN.
   *
   * @default - Amazon Connect default
   */
  readonly outboundFlowArn?: string;
}

/**
 * An Amazon Connect queue reference.
 */
export interface IQueue {
  /**
   * The queue ARN.
   */
  readonly queueArn: string;
}

/**
 * Properties for Queue.
 */
export interface QueueProps {
  /**
   * The Amazon Connect instance that owns this queue.
   */
  readonly instance: IConnectInstance;

  /**
   * Queue name.
   */
  readonly name: string;

  /**
   * Hours of operation for this queue.
   */
  readonly hoursOfOperation: IHoursOfOperation;

  /**
   * Optional description.
   *
   * @default - no description
   */
  readonly description?: string;

  /**
   * Maximum contacts allowed in the queue.
   *
   * @default - Amazon Connect default
   */
  readonly maxContacts?: number;

  /**
   * Outbound caller configuration.
   *
   * @default - Amazon Connect default
   */
  readonly outboundCallerConfig?: OutboundCallerConfig;

  /**
   * Queue status.
   *
   * @default QueueStatus.ENABLED
   */
  readonly status?: QueueStatus;
}

/**
 * L2-style wrapper for AWS::Connect::Queue.
 */
export class Queue extends Construct implements IQueue {
  /**
   * Import an existing Amazon Connect queue by ARN.
   */
  public static fromQueueArn(scope: Construct, id: string, queueArn: string): IQueue {
    return new ImportedQueue(scope, id, queueArn);
  }

  /**
   * The underlying CloudFormation resource.
   */
  public readonly resource: connect.CfnQueue;

  /**
   * The queue ARN.
   */
  public readonly queueArn: string;

  public constructor(scope: Construct, id: string, props: QueueProps) {
    super(scope, id);

    if (!props.name.trim()) {
      throw new Error('name must not be empty.');
    }
    if (props.maxContacts !== undefined && props.maxContacts < 0) {
      throw new Error('maxContacts must be greater than or equal to 0.');
    }

    this.resource = new connect.CfnQueue(this, 'Resource', {
      description: props.description,
      hoursOfOperationArn: props.hoursOfOperation.hoursOfOperationArn,
      instanceArn: props.instance.instanceArn,
      maxContacts: props.maxContacts,
      name: props.name,
      outboundCallerConfig: props.outboundCallerConfig,
      status: props.status ?? QueueStatus.ENABLED,
    });

    this.queueArn = this.resource.getAtt('QueueArn').toString();
  }
}

class ImportedQueue extends Construct implements IQueue {
  public readonly queueArn: string;

  public constructor(scope: Construct, id: string, queueArn: string) {
    super(scope, id);
    this.queueArn = queueArn;
    resourceNameFromSlashArn(this, queueArn);
  }
}
