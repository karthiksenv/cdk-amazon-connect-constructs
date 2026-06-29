import { App, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  Channel,
  ConnectInstance,
  ContactFlow,
  ContactFlowState,
  ContactFlowType,
  DayOfWeek,
  HoursOfOperation,
  IdentityManagementType,
  LambdaIntegration,
  Queue,
  QueueStatus,
  RoutingProfile,
} from '../src';

function createInstance(stack: Stack): ConnectInstance {
  return new ConnectInstance(stack, 'Instance', {
    instanceAlias: 'support',
  });
}

function createBusinessHours(stack: Stack, instance: ConnectInstance): HoursOfOperation {
  return new HoursOfOperation(stack, 'Hours', {
    instance,
    name: 'Business hours',
    timeZone: 'America/New_York',
    config: [
      {
        day: DayOfWeek.MONDAY,
        startTime: { hours: 9 },
        endTime: { hours: 17, minutes: 30 },
      },
    ],
  });
}

function createQueue(stack: Stack, instance: ConnectInstance, hours: HoursOfOperation): Queue {
  return new Queue(stack, 'Queue', {
    instance,
    hoursOfOperation: hours,
    name: 'Support',
  });
}

describe('ConnectInstance', () => {
  test('creates CfnInstance with default telephony attributes', () => {
    const stack = new Stack();

    new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::Instance', {
      Attributes: {
        InboundCalls: true,
        OutboundCalls: true,
        ContactflowLogs: false,
        ContactLens: false,
        EarlyMedia: false,
        UseCustomTTSVoices: false,
      },
      IdentityManagementType: 'CONNECT_MANAGED',
      InstanceAlias: 'support',
    });
  });

  test('passes directory id for an existing-directory instance', () => {
    const stack = new Stack();

    new ConnectInstance(stack, 'Instance', {
      directoryId: 'd-1234567890',
      identityManagementType: IdentityManagementType.EXISTING_DIRECTORY,
      instanceAlias: 'support-directory',
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::Instance', {
      DirectoryId: 'd-1234567890',
      IdentityManagementType: 'EXISTING_DIRECTORY',
      InstanceAlias: 'support-directory',
    });
  });

  test('rejects an empty instance alias', () => {
    const stack = new Stack();

    expect(() => new ConnectInstance(stack, 'Instance', {
      instanceAlias: ' ',
    })).toThrow(/instanceAlias/);
  });

  test('requires directoryId for existing-directory identity management', () => {
    const stack = new Stack();

    expect(() => new ConnectInstance(stack, 'Instance', {
      identityManagementType: IdentityManagementType.EXISTING_DIRECTORY,
      instanceAlias: 'support',
    })).toThrow(/directoryId/);
  });

  test('imports an existing instance by ARN', () => {
    const stack = new Stack();

    const instance = ConnectInstance.fromInstanceArn(
      stack,
      'ImportedInstance',
      'arn:aws:connect:us-east-1:123456789012:instance/abc123',
    );

    expect(instance.instanceArn).toBe('arn:aws:connect:us-east-1:123456789012:instance/abc123');
    expect(instance.instanceId).toBe('abc123');
  });
});

describe('HoursOfOperation', () => {
  test('creates CfnHoursOfOperation with weekly ranges and instance reference', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    createBusinessHours(stack, instance);

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::HoursOfOperation', {
      Config: [
        {
          Day: 'MONDAY',
          StartTime: {
            Hours: 9,
            Minutes: 0,
          },
          EndTime: {
            Hours: 17,
            Minutes: 30,
          },
        },
      ],
      InstanceArn: Match.anyValue(),
      Name: 'Business hours',
      TimeZone: 'America/New_York',
    });
  });

  test('rejects an empty config', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new HoursOfOperation(stack, 'Hours', {
      instance,
      name: 'Business hours',
      timeZone: 'America/New_York',
      config: [],
    })).toThrow(/at least one weekly time range/);
  });

  test('rejects an empty name', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new HoursOfOperation(stack, 'Hours', {
      instance,
      name: ' ',
      timeZone: 'America/New_York',
      config: [
        {
          day: DayOfWeek.MONDAY,
          startTime: { hours: 9 },
          endTime: { hours: 17 },
        },
      ],
    })).toThrow(/name/);
  });

  test('rejects an empty time zone', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new HoursOfOperation(stack, 'Hours', {
      instance,
      name: 'Business hours',
      timeZone: ' ',
      config: [
        {
          day: DayOfWeek.MONDAY,
          startTime: { hours: 9 },
          endTime: { hours: 17 },
        },
      ],
    })).toThrow(/timeZone/);
  });

  test('rejects invalid time values', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new HoursOfOperation(stack, 'Hours', {
      instance,
      name: 'Bad hours',
      timeZone: 'America/New_York',
      config: [
        {
          day: DayOfWeek.MONDAY,
          startTime: { hours: 24 },
          endTime: { hours: 17 },
        },
      ],
    })).toThrow(/startTime\.hours/);
  });

  test('rejects invalid minute values', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new HoursOfOperation(stack, 'Hours', {
      instance,
      name: 'Bad hours',
      timeZone: 'America/New_York',
      config: [
        {
          day: DayOfWeek.MONDAY,
          startTime: { hours: 9, minutes: 60 },
          endTime: { hours: 17 },
        },
      ],
    })).toThrow(/startTime\.minutes/);
  });

  test('imports existing hours of operation by ARN', () => {
    const stack = new Stack();

    const hours = HoursOfOperation.fromHoursOfOperationArn(
      stack,
      'ImportedHours',
      'arn:aws:connect:us-east-1:123456789012:instance/abc123/operating-hours/hours123',
    );

    expect(hours.hoursOfOperationArn).toBe(
      'arn:aws:connect:us-east-1:123456789012:instance/abc123/operating-hours/hours123',
    );
  });
});

describe('Queue', () => {
  test('creates CfnQueue with correct hours of operation reference', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);

    new Queue(stack, 'Queue', {
      instance,
      hoursOfOperation: hours,
      name: 'test-queue',
      maxContacts: 50,
      status: QueueStatus.DISABLED,
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::Queue', {
      HoursOfOperationArn: Match.anyValue(),
      InstanceArn: Match.anyValue(),
      MaxContacts: 50,
      Name: 'test-queue',
      Status: 'DISABLED',
    });
  });

  test('passes outbound caller config through to CfnQueue', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);

    new Queue(stack, 'Queue', {
      instance,
      hoursOfOperation: hours,
      name: 'Support',
      outboundCallerConfig: {
        outboundCallerIdName: 'Support',
        outboundCallerIdNumberArn: 'arn:aws:connect:us-east-1:123456789012:phone-number/abc123',
      },
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::Queue', {
      OutboundCallerConfig: {
        OutboundCallerIdName: 'Support',
        OutboundCallerIdNumberArn: 'arn:aws:connect:us-east-1:123456789012:phone-number/abc123',
      },
    });
  });

  test('rejects an empty queue name', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);

    expect(() => new Queue(stack, 'Queue', {
      instance,
      hoursOfOperation: hours,
      name: ' ',
    })).toThrow(/name/);
  });

  test('rejects negative maxContacts', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);

    expect(() => new Queue(stack, 'Queue', {
      instance,
      hoursOfOperation: hours,
      name: 'Support',
      maxContacts: -1,
    })).toThrow(/maxContacts/);
  });

  test('imports existing queue by ARN', () => {
    const stack = new Stack();

    const queue = Queue.fromQueueArn(
      stack,
      'ImportedQueue',
      'arn:aws:connect:us-east-1:123456789012:instance/abc123/queue/queue123',
    );

    expect(queue.queueArn).toBe(
      'arn:aws:connect:us-east-1:123456789012:instance/abc123/queue/queue123',
    );
  });
});

describe('RoutingProfile', () => {
  test('creates CfnRoutingProfile with queue associations and media concurrency', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
      mediaConcurrencies: [
        { channel: Channel.VOICE, concurrency: 1 },
        { channel: Channel.CHAT, concurrency: 2 },
      ],
      queueConfigs: [
        { queue, channel: Channel.VOICE, priority: 1, delay: 0 },
      ],
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::RoutingProfile', {
      DefaultOutboundQueueArn: Match.anyValue(),
      Description: 'Tier 1 support agents',
      MediaConcurrencies: [
        {
          Channel: 'VOICE',
          Concurrency: 1,
        },
        {
          Channel: 'CHAT',
          Concurrency: 2,
        },
      ],
      Name: 'Tier 1',
      QueueConfigs: [
        {
          Delay: 0,
          Priority: 1,
          QueueReference: {
            Channel: 'VOICE',
            QueueArn: Match.anyValue(),
          },
        },
      ],
    });
  });

  test('rejects an empty queueConfigs array', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
      queueConfigs: [],
    })).toThrow(/queueConfigs/);
  });

  test('uses default media concurrency and queue config', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::RoutingProfile', {
      MediaConcurrencies: [
        {
          Channel: 'VOICE',
          Concurrency: 1,
        },
      ],
      QueueConfigs: [
        {
          Delay: 0,
          Priority: 1,
          QueueReference: {
            Channel: 'VOICE',
            QueueArn: Match.anyValue(),
          },
        },
      ],
    });
  });

  test('rejects an empty mediaConcurrencies array', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
      mediaConcurrencies: [],
    })).toThrow(/mediaConcurrencies/);
  });

  test('rejects invalid media concurrency', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
      mediaConcurrencies: [
        { channel: Channel.VOICE, concurrency: 0 },
      ],
    })).toThrow(/media concurrency/);
  });

  test('rejects an empty routing profile name', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: ' ',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
    })).toThrow(/name/);
  });

  test('rejects an empty routing profile description', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: ' ',
      defaultOutboundQueue: queue,
    })).toThrow(/description/);
  });

  test('rejects invalid queue priority and delay', () => {
    const stack = new Stack();
    const instance = createInstance(stack);
    const hours = createBusinessHours(stack, instance);
    const queue = createQueue(stack, instance, hours);

    expect(() => new RoutingProfile(stack, 'RoutingProfile', {
      instance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: queue,
      queueConfigs: [
        { queue, priority: 0 },
      ],
    })).toThrow(/queue priority/);

    const delayStack = new Stack();
    const delayInstance = createInstance(delayStack);
    const delayHours = createBusinessHours(delayStack, delayInstance);
    const delayQueue = createQueue(delayStack, delayInstance, delayHours);

    expect(() => new RoutingProfile(delayStack, 'RoutingProfile', {
      instance: delayInstance,
      name: 'Tier 1',
      description: 'Tier 1 support agents',
      defaultOutboundQueue: delayQueue,
      queueConfigs: [
        { queue: delayQueue, delay: -1 },
      ],
    })).toThrow(/queue delay/);
  });
});

describe('ContactFlow', () => {
  test('creates CfnContactFlow with serialized JSON content', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Inbound support',
      contactFlowType: ContactFlowType.CUSTOMER_QUEUE,
      state: ContactFlowState.ARCHIVED,
      content: ContactFlow.stringify({
        Version: '2019-10-30',
        StartAction: 'disconnect',
        Actions: [
          {
            Identifier: 'disconnect',
            Type: 'DisconnectParticipant',
            Parameters: {},
            Transitions: {},
          },
        ],
      }),
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::ContactFlow', {
      Content: Match.stringLikeRegexp('DisconnectParticipant'),
      InstanceArn: Match.anyValue(),
      Name: 'Inbound support',
      State: 'ARCHIVED',
      Type: 'CUSTOMER_QUEUE',
    });
  });

  test('uses default flow type and active state', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Inbound support',
      content: '{}',
    });

    Template.fromStack(stack).hasResourceProperties('AWS::Connect::ContactFlow', {
      Name: 'Inbound support',
      State: 'ACTIVE',
      Type: 'CONTACT_FLOW',
    });
  });

  test('rejects an empty contact flow name', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new ContactFlow(stack, 'Flow', {
      instance,
      name: ' ',
      content: '{}',
    })).toThrow(/name/);
  });

  test('rejects invalid contact flow JSON', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Broken',
      content: '{',
    })).toThrow(/valid JSON/);
  });

  test('rejects empty contact flow content', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Broken',
      content: ' ',
    })).toThrow(/content/);
  });
});

describe('LambdaIntegration', () => {
  test('creates Connect integration association and Lambda invoke permission', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    const instance = createInstance(stack);
    const handler = new lambda.Function(stack, 'Handler', {
      code: lambda.Code.fromInline('exports.handler = async () => ({ ok: true });'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
    });

    new LambdaIntegration(stack, 'Integration', {
      instance,
      function: handler,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Connect::IntegrationAssociation', {
      InstanceId: Match.anyValue(),
      IntegrationArn: Match.anyValue(),
      IntegrationType: 'LAMBDA_FUNCTION',
    });
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'connect.amazonaws.com',
      SourceArn: Match.anyValue(),
    });
  });

  test('rejects a missing Lambda function', () => {
    const stack = new Stack();
    const instance = createInstance(stack);

    expect(() => new LambdaIntegration(stack, 'Integration', {
      instance,
      function: undefined as unknown as lambda.IFunction,
    })).toThrow(/function is required/);
  });

  test('rejects a missing Connect instance', () => {
    const stack = new Stack();
    const handler = new lambda.Function(stack, 'Handler', {
      code: lambda.Code.fromInline('exports.handler = async () => ({ ok: true });'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
    });

    expect(() => new LambdaIntegration(stack, 'Integration', {
      instance: undefined as unknown as ConnectInstance,
      function: handler,
    })).toThrow(/instance is required/);
  });
});
