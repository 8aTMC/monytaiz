import { 
  format, 
  startOfHour, 
  endOfHour, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  isAfter,
  isBefore,
  max,
  min
} from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { DataBucket, Granularity } from '@/types/timeframe';

interface BucketizeOptions {
  start: Date;
  end: Date;
  granularity: Granularity;
  timezone: string;
}

interface RawDataPoint {
  timestamp: Date | string;
  value: number;
  count?: number;
}

export const bucketize = (
  data: RawDataPoint[], 
  options: BucketizeOptions
): DataBucket[] => {
  const { start, end, granularity, timezone } = options;
  
  // Convert to timezone
  const zonedStart = toZonedTime(start, timezone);
  const zonedEnd = toZonedTime(end, timezone);
  
  const buckets: DataBucket[] = [];
  let current = zonedStart;
  
  while (isBefore(current, zonedEnd) || current.getTime() === zonedEnd.getTime()) {
    const bucketStart = getBucketStart(current, granularity);
    const bucketEnd = getBucketEnd(bucketStart, granularity);
    
    // Ensure we don't exceed the requested range
    const clampedStart = max([bucketStart, zonedStart]);
    const clampedEnd = min([bucketEnd, zonedEnd]);
    
    // Filter and aggregate data for this bucket
    const bucketData = data.filter(point => {
      const pointTime = typeof point.timestamp === 'string' 
        ? toZonedTime(new Date(point.timestamp), timezone)
        : toZonedTime(point.timestamp, timezone);
      
      return pointTime >= clampedStart && pointTime <= clampedEnd;
    });
    
    const totalValue = bucketData.reduce((sum, point) => sum + point.value, 0);
    const totalCount = bucketData.reduce((sum, point) => sum + (point.count || 1), 0);
    
    buckets.push({
      start: fromZonedTime(clampedStart, timezone).toISOString(),
      end: fromZonedTime(clampedEnd, timezone).toISOString(),
      label: formatBucketLabel(clampedStart, clampedEnd, granularity, timezone),
      value: totalValue,
      count: totalCount
    });
    
    // Move to next bucket
    current = getNextBucketStart(bucketStart, granularity);
    
    // Safety check to prevent infinite loops
    if (isAfter(current, zonedEnd)) break;
  }
  
  return buckets;
};

const getBucketStart = (date: Date, granularity: Granularity): Date => {
  switch (granularity) {
    case 'hour':
      return startOfHour(date);
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfWeek(date, { weekStartsOn: 1 }); // Monday start
    case 'month':
      return startOfMonth(date);
    default:
      return startOfDay(date);
  }
};

const getBucketEnd = (bucketStart: Date, granularity: Granularity): Date => {
  switch (granularity) {
    case 'hour':
      return endOfHour(bucketStart);
    case 'day':
      return endOfDay(bucketStart);
    case 'week':
      return endOfWeek(bucketStart, { weekStartsOn: 1 }); // Monday start
    case 'month':
      return endOfMonth(bucketStart);
    default:
      return endOfDay(bucketStart);
  }
};

const getNextBucketStart = (current: Date, granularity: Granularity): Date => {
  switch (granularity) {
    case 'hour':
      return addHours(current, 1);
    case 'day':
      return addDays(current, 1);
    case 'week':
      return addWeeks(current, 1);
    case 'month':
      return addMonths(current, 1);
    default:
      return addDays(current, 1);
  }
};

const formatBucketLabel = (
  start: Date, 
  end: Date, 
  granularity: Granularity, 
  timezone: string
): string => {
  switch (granularity) {
    case 'hour':
      return formatInTimeZone(start, timezone, 'HH:mm');
    case 'day':
      return formatInTimeZone(start, timezone, 'MMM dd');
    case 'week':
      const weekStart = formatInTimeZone(start, timezone, 'MMM dd');
      const weekEnd = formatInTimeZone(end, timezone, 'MMM dd');
      return `${weekStart}–${weekEnd}`;
    case 'month':
      return formatInTimeZone(start, timezone, 'MMM yyyy');
    default:
      return formatInTimeZone(start, timezone, 'MMM dd');
  }
};

// Helper to convert old analytics data format to new bucketed format
export const convertAnalyticsData = (
  oldData: Array<{
    date_period: string;
    sent_count: number;
    purchased_count: number;
    revenue_cents: number;
  }>,
  options: BucketizeOptions
): DataBucket[] => {
  const rawData: RawDataPoint[] = oldData.map(point => ({
    timestamp: new Date(point.date_period),
    value: point.revenue_cents / 100, // Convert to dollars
    count: point.sent_count
  }));
  
  return bucketize(rawData, options);
};