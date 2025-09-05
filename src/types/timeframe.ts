export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface TimeframeState {
  start: Date;
  end: Date;
  granularity: Granularity;
  timezone: string;
}

export interface DataBucket {
  start: string; // ISO8601
  end: string; // ISO8601
  label: string;
  value: number;
  count?: number;
}

export interface TimeframePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}