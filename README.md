# cdk-amazon-connect-constructs

L2-style AWS CDK constructs for Amazon Connect.

The AWS CDK currently exposes Amazon Connect primarily through low-level
CloudFormation resources. This library wraps the foundational pieces with
validated, reusable constructs that are intended to publish through JSII for
TypeScript, Python, Java, and .NET.

## Implemented constructs

- `ConnectInstance`
- `HoursOfOperation`
- `Queue`
- `RoutingProfile`
- `ContactFlow` with JSON import mode
- `LambdaIntegration`

## Install

```bash
npm install cdk-amazon-connect-constructs aws-cdk-lib constructs
```

## Example

```ts
import { Stack, aws_lambda as lambda } from 'aws-cdk-lib';
import {
  ConnectInstance,
  ContactFlow,
  DayOfWeek,
  HoursOfOperation,
  LambdaIntegration,
  Queue,
  RoutingProfile,
} from 'cdk-amazon-connect-constructs';

const stack = new Stack();

const instance = new ConnectInstance(stack, 'Instance', {
  instanceAlias: 'support',
  attributes: {
    contactflowLogs: true,
  },
});

const hours = new HoursOfOperation(stack, 'Hours', {
  instance,
  name: 'Business hours',
  timeZone: 'America/New_York',
  config: [
    {
      day: DayOfWeek.MONDAY,
      startTime: { hours: 9 },
      endTime: { hours: 17 },
    },
  ],
});

const queue = new Queue(stack, 'Queue', {
  instance,
  hoursOfOperation: hours,
  name: 'Support',
});

new RoutingProfile(stack, 'RoutingProfile', {
  instance,
  name: 'Tier 1',
  description: 'Tier 1 support agents',
  defaultOutboundQueue: queue,
});

const handler = new lambda.Function(stack, 'Handler', {
  code: lambda.Code.fromInline('exports.handler = async () => ({ ok: true });'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_20_X,
});

new LambdaIntegration(stack, 'LambdaIntegration', {
  instance,
  function: handler,
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
```

## Roadmap

- Add typed builders for common Amazon Connect contact flow actions.
- Add Lex bot integration.
- Add phone number claim support.
- Add security profile, user, and quick connect constructs.

## Development

```bash
npm install
npm run build
npm test
npm run cdk:synth:example
```

The project includes a `.projenrc.ts` configured for a JSII AWS CDK construct
library so generated project metadata can be maintained through projen.
