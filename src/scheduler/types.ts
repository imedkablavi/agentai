export type TimeTrigger =
  | { type: 'once'; at: string }
  | { type: 'daily'; at: string }
  | { type: 'interval'; minutes: number };

export interface ScheduledTask {
  id: string;
  trigger: TimeTrigger;
  intent: any;
  context_snapshot: any;
  enabled: boolean;
  last_run?: string;
  next_run: string;
}

