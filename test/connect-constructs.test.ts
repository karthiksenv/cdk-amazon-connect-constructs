import { App, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {
  Channel,
  ConnectInstance,
  ContactFlow,
  DayOfWeek,
  HoursOfOperation,
  LambdaIntegration,
  Queue,
  RoutingProfile,
} from '../src';

describe('Amazon Connect constructs', () => {
  test('creates a connect instance with defaults', () => {
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

  test('creates hours, queue, and routing profile', () => {
    const stack = new Stack();
    const instance = new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });
    const hours = new HoursOfOperation(stack, 'Hours', {
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
    const queue = new Queue(stack, 'Queue', {
      instance,
      hoursOfOperation: hours,
      name: 'Support',
      maxContacts: 50,
    });

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

    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Connect::HoursOfOperation', 1);
    template.hasResourceProperties('AWS::Connect::HoursOfOperation', {
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
      Name: 'Business hours',
      TimeZone: 'America/New_York',
    });
    template.hasResourceProperties('AWS::Connect::Queue', {
      MaxContacts: 50,
      Name: 'Support',
      Status: 'ENABLED',
    });
    template.hasResourceProperties('AWS::Connect::RoutingProfile', {
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
    });
  });

  test('creates a JSON-backed contact flow', () => {
    const stack = new Stack();
    const instance = new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });

    new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Inbound support',
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
      Name: 'Inbound support',
      State: 'ACTIVE',
      Type: 'CONTACT_FLOW',
    });
  });

  test('associates lambda with connect and grants invoke permission', () => {
    const app = new App();
    const stack = new Stack(app, 'Stack', {
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    const instance = new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });
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
      IntegrationType: 'LAMBDA_FUNCTION',
    });
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'connect.amazonaws.com',
    });
  });
});

describe('validation', () => {
  test('rejects invalid hours', () => {
    const stack = new Stack();
    const instance = new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });

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

  test('rejects invalid contact flow JSON', () => {
    const stack = new Stack();
    const instance = new ConnectInstance(stack, 'Instance', {
      instanceAlias: 'support',
    });

    expect(() => new ContactFlow(stack, 'Flow', {
      instance,
      name: 'Broken',
      content: '{',
    })).toThrow(/valid JSON/);
  });
});
