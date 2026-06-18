import { aws_connect as connect } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConnectInstance } from './connect-instance';
import { IQueue } from './queue';

/**
 * Amazon Connect contact channels.
 */
export enum Channel {
  VOICE = 'VOICE',
  CHAT = 'CHAT',
  TASK = 'TASK',
  EMAIL = 'EMAIL',
}

/**
 * Channel concurrency for a routing profile.
 */
export interface MediaConcurrency {
  /**
   * Contact channel.
   */
  readonly channel: Channel;

  /**
   * Number of simultaneous contacts allowed for the channel.
   */
  readonly concurrency: number;
}

/**
 * Queue association settings for a routing profile.
 */
export interface RoutingProfileQueueConfig {
  /**
   * Queue to associate.
   */
  readonly queue: IQueue;

  /**
   * Contact channel for this queue association.
   *
   * @default Channel.VOICE
   */
  readonly channel?: Channel;

  /**
   * Queue priority. Lower values are higher priority.
   *
   * @default 1
   */
  readonly priority?: number;

  /**
   * Delay before contacts are routed to agents, in seconds.
   *
   * @default 0
   */
  readonly delay?: number;
}

/**
 * An Amazon Connect routing profile reference.
 */
export interface IRoutingProfile {
  /**
   * The routing profile ARN.
   */
  readonly routingProfileArn: string;
}

/**
 * Properties for RoutingProfile.
 */
export interface RoutingProfileProps {
  /**
   * The Amazon Connect instance that owns this routing profile.
   */
  readonly instance: IConnectInstance;

  /**
   * Routing profile name.
   */
  readonly name: string;

  /**
   * Routing profile description.
   */
  readonly description: string;

  /**
   * Default outbound queue.
   */
  readonly defaultOutboundQueue: IQueue;

  /**
   * Media concurrency settings.
   *
   * @default - one concurrent voice contact
   */
  readonly mediaConcurrencies?: MediaConcurrency[];

  /**
   * Queue associations.
   *
   * @default - associate only the default outbound queue for voice
   */
  readonly queueConfigs?: RoutingProfileQueueConfig[];
}

/**
 * L2-style wrapper for AWS::Connect::RoutingProfile.
 */
export class RoutingProfile extends Construct implements IRoutingProfile {
  /**
   * The underlying CloudFormation resource.
   */
  public readonly resource: connect.CfnRoutingProfile;

  /**
   * The routing profile ARN.
   */
  public readonly routingProfileArn: string;

  public constructor(scope: Construct, id: string, props: RoutingProfileProps) {
    super(scope, id);

    if (!props.name.trim()) {
      throw new Error('name must not be empty.');
    }
    if (!props.description.trim()) {
      throw new Error('description must not be empty.');
    }

    const mediaConcurrencies = props.mediaConcurrencies ?? [
      { channel: Channel.VOICE, concurrency: 1 },
    ];
    const queueConfigs = props.queueConfigs ?? [
      { queue: props.defaultOutboundQueue, channel: Channel.VOICE, priority: 1, delay: 0 },
    ];

    this.resource = new connect.CfnRoutingProfile(this, 'Resource', {
      defaultOutboundQueueArn: props.defaultOutboundQueue.queueArn,
      description: props.description,
      instanceArn: props.instance.instanceArn,
      mediaConcurrencies: mediaConcurrencies.map(toCfnMediaConcurrency),
      name: props.name,
      queueConfigs: queueConfigs.map(toCfnQueueConfig),
    });

    this.routingProfileArn = this.resource.getAtt('RoutingProfileArn').toString();
  }
}

function toCfnMediaConcurrency(
  media: MediaConcurrency,
): connect.CfnRoutingProfile.MediaConcurrencyProperty {
  if (media.concurrency < 1 || !Number.isInteger(media.concurrency)) {
    throw new Error('media concurrency must be a positive integer.');
  }

  return {
    channel: media.channel,
    concurrency: media.concurrency,
  };
}

function toCfnQueueConfig(
  config: RoutingProfileQueueConfig,
): connect.CfnRoutingProfile.RoutingProfileQueueConfigProperty {
  const priority = config.priority ?? 1;
  const delay = config.delay ?? 0;

  if (priority < 1 || !Number.isInteger(priority)) {
    throw new Error('queue priority must be a positive integer.');
  }
  if (delay < 0 || !Number.isInteger(delay)) {
    throw new Error('queue delay must be a non-negative integer.');
  }

  return {
    delay,
    priority,
    queueReference: {
      channel: config.channel ?? Channel.VOICE,
      queueArn: config.queue.queueArn,
    },
  };
}
