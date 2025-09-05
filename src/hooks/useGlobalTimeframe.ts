import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { TimeframeState, Granularity } from '@/types/timeframe';

interface TimeframeContextType extends TimeframeState {
  setRange: (start: Date, end: Date) => void;
  setGranularity: (granularity: Granularity) => void;
  getAllowedGranularities: () => Granularity[];
  getDaysDifference: () => number;
}

const TimeframeContext = createContext<TimeframeContextType | null>(null);

export const useGlobalTimeframe = () => {
  const context = useContext(TimeframeContext);
  if (!context) {
    // Return a local instance if not in context
    return useLocalTimeframe();
  }
  return context;
};

export const useLocalTimeframe = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get user timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Initialize from URL params or defaults
  const getInitialState = (): TimeframeState => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const granularityParam = searchParams.get('g') as Granularity;
    
    let start: Date, end: Date;
    
    if (startParam && endParam) {
      start = parseISO(startParam);
      end = parseISO(endParam);
    } else {
      // Default: Last 7 days
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 6); // 7 days including today
    }
    
    return {
      start,
      end,
      granularity: granularityParam || getDefaultGranularity(start, end),
      timezone
    };
  };

  const [state, setState] = useState<TimeframeState>(getInitialState);

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('start', format(state.start, 'yyyy-MM-dd'));
    params.set('end', format(state.end, 'yyyy-MM-dd'));
    params.set('g', state.granularity);
    setSearchParams(params, { replace: true });
  }, [state, searchParams, setSearchParams]);

  const getDaysDifference = useCallback(() => {
    const diffTime = Math.abs(state.end.getTime() - state.start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
  }, [state.start, state.end]);

  const getAllowedGranularities = useCallback((): Granularity[] => {
    const days = getDaysDifference();
    
    if (days === 1) return ['hour', 'day'];
    if (days === 2) return ['hour', 'day'];
    if (days >= 3 && days <= 13) return ['day'];
    if (days >= 14 && days <= 31) return ['day', 'week'];
    if (days >= 32 && days <= 62) return ['week'];
    if (days >= 63 && days <= 365) return ['week', 'month'];
    return ['month']; // 366+ days
  }, [getDaysDifference]);

  const setRange = useCallback((start: Date, end: Date) => {
    const newGranularity = getDefaultGranularity(start, end);
    setState(prev => ({
      ...prev,
      start,
      end,
      granularity: newGranularity
    }));
  }, []);

  const setGranularity = useCallback((granularity: Granularity) => {
    setState(prev => ({
      ...prev,
      granularity
    }));
  }, []);

  return {
    ...state,
    setRange,
    setGranularity,
    getAllowedGranularities,
    getDaysDifference
  };
};

const getDefaultGranularity = (start: Date, end: Date): Granularity => {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  if (days <= 2) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 365) return 'week';
  return 'month';
};

export { TimeframeContext };