import { aws_connect as connect } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IConnectInstance } from './connect-instance';
import { resourceNameFromSlashArn } from './private/arn';

/**
 * Days supported by Amazon Connect hours of operation.
 */
export enum DayOfWeek {
  SUNDAY = 'SUNDAY',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

/**
 * A time of day in 24-hour format.
 */
export interface TimeOfDay {
  /**
   * Hour in local time, from 0 through 23.
   */
  readonly hours: number;

  /**
   * Minute in local time, from 0 through 59.
   *
   * @default 0
   */
  readonly minutes?: number;
}

/**
 * A weekly open interval for an Amazon Connect queue.
 */
export interface WeeklyTimeRange {
  /**
   * Day of week for this interval.
   */
  readonly day: DayOfWeek;

  /**
   * Interval start time.
   */
  readonly startTime: TimeOfDay;

  /**
   * Interval end time.
   */
  readonly endTime: TimeOfDay;
}

/**
 * An Amazon Connect hours-of-operation reference.
 */
export interface IHoursOfOperation {
  /**
   * The hours of operation ARN.
   */
  readonly hoursOfOperationArn: string;
}

/**
 * Properties for HoursOfOperation.
 */
export interface HoursOfOperationProps {
  /**
   * The Amazon Connect instance that owns these hours.
   */
  readonly instance: IConnectInstance;

  /**
   * Display name.
   */
  readonly name: string;

  /**
   * IANA time zone, for example America/New_York.
   */
  readonly timeZone: string;

  /**
   * Weekly open intervals.
   */
  readonly config: WeeklyTimeRange[];

  /**
   * Optional description.
   *
   * @default - no description
   */
  readonly description?: string;
}

/**
 * L2-style wrapper for AWS::Connect::HoursOfOperation.
 */
export class HoursOfOperation extends Construct implements IHoursOfOperation {
  /**
   * Import existing hours of operation by ARN.
   */
  public static fromHoursOfOperationArn(
    scope: Construct,
    id: string,
    hoursOfOperationArn: string,
  ): IHoursOfOperation {
    return new ImportedHoursOfOperation(scope, id, hoursOfOperationArn);
  }

  /**
   * The underlying CloudFormation resource.
   */
  public readonly resource: connect.CfnHoursOfOperation;

  /**
   * The hours of operation ARN.
   */
  public readonly hoursOfOperationArn: string;

  public constructor(scope: Construct, id: string, props: HoursOfOperationProps) {
    super(scope, id);

    if (!props.name.trim()) {
      throw new Error('name must not be empty.');
    }
    if (!props.timeZone.trim()) {
      throw new Error('timeZone must not be empty.');
    }
    if (props.config.length === 0) {
      throw new Error('config must include at least one weekly time range.');
    }

    this.resource = new connect.CfnHoursOfOperation(this, 'Resource', {
      config: props.config.map(toCfnRange),
      description: props.description,
      instanceArn: props.instance.instanceArn,
      name: props.name,
      timeZone: props.timeZone,
    });

    this.hoursOfOperationArn = this.resource.getAtt('HoursOfOperationArn').toString();
  }
}

class ImportedHoursOfOperation extends Construct implements IHoursOfOperation {
  public readonly hoursOfOperationArn: string;

  public constructor(scope: Construct, id: string, hoursOfOperationArn: string) {
    super(scope, id);
    this.hoursOfOperationArn = hoursOfOperationArn;
    resourceNameFromSlashArn(this, hoursOfOperationArn);
  }
}

function toCfnRange(range: WeeklyTimeRange): connect.CfnHoursOfOperation.HoursOfOperationConfigProperty {
  validateTime(range.startTime, 'startTime');
  validateTime(range.endTime, 'endTime');

  return {
    day: range.day,
    startTime: toCfnTime(range.startTime),
    endTime: toCfnTime(range.endTime),
  };
}

function toCfnTime(time: TimeOfDay): connect.CfnHoursOfOperation.HoursOfOperationTimeSliceProperty {
  return {
    hours: time.hours,
    minutes: time.minutes ?? 0,
  };
}

function validateTime(time: TimeOfDay, name: string): void {
  if (time.hours < 0 || time.hours > 23 || !Number.isInteger(time.hours)) {
    throw new Error(`${name}.hours must be an integer from 0 through 23.`);
  }
  const minutes = time.minutes ?? 0;
  if (minutes < 0 || minutes > 59 || !Number.isInteger(minutes)) {
    throw new Error(`${name}.minutes must be an integer from 0 through 59.`);
  }
}
