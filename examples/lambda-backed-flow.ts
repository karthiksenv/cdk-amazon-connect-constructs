import { App, Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import {
  ConnectInstance,
  ContactFlow,
  DayOfWeek,
  HoursOfOperation,
  LambdaIntegration,
  Queue,
  RoutingProfile,
} from '../src';

const app = new App();
const stack = new Stack(app, 'AmazonConnectExample');

const instance = new ConnectInstance(stack, 'ConnectInstance', {
  instanceAlias: 'support-demo',
  attributes: {
    contactflowLogs: true,
  },
});

const businessHours = new HoursOfOperation(stack, 'BusinessHours', {
  instance,
  name: 'Business hours',
  timeZone: 'America/New_York',
  config: [
    {
      day: DayOfWeek.MONDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
    {
      day: DayOfWeek.TUESDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
    {
      day: DayOfWeek.WEDNESDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
    {
      day: DayOfWeek.THURSDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
    {
      day: DayOfWeek.FRIDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
  ],
});

const supportQueue = new Queue(stack, 'SupportQueue', {
  instance,
  hoursOfOperation: businessHours,
  name: 'Support',
});

new RoutingProfile(stack, 'SupportRoutingProfile', {
  instance,
  name: 'Support agents',
  description: 'Routing profile for support agents',
  defaultOutboundQueue: supportQueue,
});

const lookupHandler = new lambda.Function(stack, 'LookupHandler', {
  code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_20_X,
});

new LambdaIntegration(stack, 'LookupIntegration', {
  instance,
  function: lookupHandler,
});

new ContactFlow(stack, 'InboundFlow', {
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

app.synth();
