import { useCallback, useRef, useState, useEffect } from 'react';

interface ViewEvent {
  itemId: string;
  timestamp: Date;
  duration: number;
  scrollPosition: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  networkSpeed: string;
}

interface InteractionEvent {
  type: 'click' | 'hover' | 'scroll' | 'zoom' | 'share';
  itemId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface BehaviorPattern {
  averageViewDuration: number;
  preferredViewTimes: number[];
  scrollBehavior: {
    averageSpeed: number;
    preferredDirection: 'up' | 'down';
    pauseFrequency: number;
  };
  interactionPreferences: Record<string, number>;
  contentPreferences: {
    preferredTypes: Array<'image' | 'video' | 'audio'>;
    qualityPreference: 'low' | 'medium' | 'high';
    avgFileSize: number;
  };
  sessionPatterns: {
    averageSessionLength: number;
    itemsPerSession: number;
    returnFrequency: number;
  };
}

interface PredictionScore {
  itemId: string;
  score: number;
  reasons: string[];
}

export const useUserBehaviorTracker = () => {
  const [behaviorPattern, setBehaviorPattern] = useState<BehaviorPattern>({
    averageViewDuration: 3000,
    preferredViewTimes: [],
    scrollBehavior: {
      averageSpeed: 1,
      preferredDirection: 'down',
      pauseFrequency: 0.3
    },
    interactionPreferences: {},
    contentPreferences: {
      preferredTypes: ['image'],
      qualityPreference: 'medium',
      avgFileSize: 1024000
    },
    sessionPatterns: {
      averageSessionLength: 300000, // 5 minutes
      itemsPerSession: 10,
      returnFrequency: 0.7
    }
  });

  const viewEventsRef = useRef<ViewEvent[]>([]);
  const interactionEventsRef = useRef<InteractionEvent[]>([]);
  const sessionStartRef = useRef<Date>(new Date());
  const currentSessionItemsRef = useRef<Set<string>>(new Set());
  const scrollDataRef = useRef<Array<{ position: number; timestamp: Date }>>([]);
  
  // Track view event
  const trackView = useCallback((
    itemId: string, 
    duration: number, 
    scrollPosition: number = 0,
    metadata: Record<string, any> = {}
  ) => {
    const viewEvent: ViewEvent = {
      itemId,
      timestamp: new Date(),
      duration,
      scrollPosition,
      deviceType: window.innerWidth <= 768 ? 'mobile' : 
                  window.innerWidth <= 1024 ? 'tablet' : 'desktop',
      networkSpeed: (navigator as any).connection?.effectiveType || 'unknown'
    };

    viewEventsRef.current.push(viewEvent);
    currentSessionItemsRef.current.add(itemId);

    // Keep only last 500 events
    if (viewEventsRef.current.length > 500) {
      viewEventsRef.current = viewEventsRef.current.slice(-500);
    }

    // Update patterns every 10 views
    if (viewEventsRef.current.length % 10 === 0) {
      updateBehaviorPatterns();
    }
  }, []);

  // Track interaction event
  const trackInteraction = useCallback((
    type: InteractionEvent['type'],
    itemId: string,
    metadata: Record<string, any> = {}
  ) => {
    const interactionEvent: InteractionEvent = {
      type,
      itemId,
      timestamp: new Date(),
      metadata
    };

    interactionEventsRef.current.push(interactionEvent);

    // Keep only last 1000 interactions
    if (interactionEventsRef.current.length > 1000) {
      interactionEventsRef.current = interactionEventsRef.current.slice(-1000);
    }
  }, []);

  // Track scroll behavior
  const trackScroll = useCallback((position: number) => {
    scrollDataRef.current.push({
      position,
      timestamp: new Date()
    });

    // Keep only last 100 scroll positions
    if (scrollDataRef.current.length > 100) {
      scrollDataRef.current = scrollDataRef.current.slice(-100);
    }
  }, []);

  // Analyze and update behavior patterns
  const updateBehaviorPatterns = useCallback(() => {
    const views = viewEventsRef.current;
    const interactions = interactionEventsRef.current;
    const scrollData = scrollDataRef.current;

    if (views.length < 5) return;

    // Calculate average view duration
    const avgViewDuration = views.reduce((sum, view) => sum + view.duration, 0) / views.length;

    // Analyze preferred view times (hours of day)
    const hourCounts = views.reduce((acc, view) => {
      const hour = view.timestamp.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const preferredViewTimes = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([hour]) => parseInt(hour));

    // Analyze scroll behavior
    let scrollSpeed = 1;
    let scrollDirection: 'up' | 'down' = 'down';
    let pauseCount = 0;

    if (scrollData.length >= 2) {
      const speeds: number[] = [];
      let upCount = 0;
      let downCount = 0;

      for (let i = 1; i < scrollData.length; i++) {
        const prev = scrollData[i - 1];
        const curr = scrollData[i];
        const timeDiff = curr.timestamp.getTime() - prev.timestamp.getTime();
        const positionDiff = curr.position - prev.position;

        if (timeDiff > 0) {
          speeds.push(Math.abs(positionDiff) / timeDiff);
          
          if (positionDiff > 0) downCount++;
          else if (positionDiff < 0) upCount++;
          else pauseCount++;
        }
      }

      scrollSpeed = speeds.length > 0 ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 1;
      scrollDirection = downCount > upCount ? 'down' : 'up';
    }

    const pauseFrequency = scrollData.length > 0 ? pauseCount / scrollData.length : 0.3;

    // Analyze interaction preferences
    const interactionPreferences = interactions.reduce((acc, interaction) => {
      acc[interaction.type] = (acc[interaction.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Analyze content preferences (would need file type info)
    const contentPreferences = {
      preferredTypes: ['image' as const], // Default, would analyze actual content
      qualityPreference: 'medium' as const,
      avgFileSize: 1024000 // Default 1MB
    };

    // Session analysis
    const sessionLength = Date.now() - sessionStartRef.current.getTime();
    const itemsPerSession = currentSessionItemsRef.current.size;

    setBehaviorPattern({
      averageViewDuration: avgViewDuration,
      preferredViewTimes,
      scrollBehavior: {
        averageSpeed: scrollSpeed,
        preferredDirection: scrollDirection,
        pauseFrequency
      },
      interactionPreferences,
      contentPreferences,
      sessionPatterns: {
        averageSessionLength: sessionLength,
        itemsPerSession,
        returnFrequency: 0.7 // Would track across sessions
      }
    });
  }, []);

  // Predict user interest in items
  const predictInterest = useCallback((items: Array<{ id: string; type: string; size?: number; tags?: string[] }>): PredictionScore[] => {
    const pattern = behaviorPattern;
    
    return items.map(item => {
      let score = 50; // Base score
      const reasons: string[] = [];

      // Time-based prediction
      const currentHour = new Date().getHours();
      if (pattern.preferredViewTimes.includes(currentHour)) {
        score += 20;
        reasons.push('preferred_time');
      }

      // Content type preference
      if (pattern.contentPreferences.preferredTypes.includes(item.type as any)) {
        score += 15;
        reasons.push('content_type_preference');
      }

      // File size preference
      if (item.size) {
        const sizeDiff = Math.abs(item.size - pattern.contentPreferences.avgFileSize);
        const sizeScore = Math.max(0, 10 - (sizeDiff / pattern.contentPreferences.avgFileSize) * 10);
        score += sizeScore;
        if (sizeScore > 5) {
          reasons.push('size_preference');
        }
      }

      // Interaction history
      const hasInteracted = interactionEventsRef.current.some(event => event.itemId === item.id);
      if (hasInteracted) {
        score += 25;
        reasons.push('previous_interaction');
      }

      // Recent viewing pattern
      const recentViews = viewEventsRef.current.slice(-10);
      if (recentViews.some(view => view.itemId === item.id)) {
        score += 10;
        reasons.push('recently_viewed');
      }

      return {
        itemId: item.id,
        score: Math.min(100, Math.max(0, score)),
        reasons
      };
    }).sort((a, b) => b.score - a.score);
  }, [behaviorPattern]);

  // Get behavior insights for optimization
  const getBehaviorInsights = useCallback(() => {
    const views = viewEventsRef.current;
    const interactions = interactionEventsRef.current;

    return {
      totalViews: views.length,
      totalInteractions: interactions.length,
      currentSessionDuration: Date.now() - sessionStartRef.current.getTime(),
      currentSessionItems: currentSessionItemsRef.current.size,
      mostActiveHour: behaviorPattern.preferredViewTimes[0] || new Date().getHours(),
      dominantInteractionType: Object.entries(behaviorPattern.interactionPreferences)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'click',
      avgViewDuration: behaviorPattern.averageViewDuration,
      scrollSpeed: behaviorPattern.scrollBehavior.averageSpeed
    };
  }, [behaviorPattern]);

  // Reset session (call when user navigates away or starts new session)
  const resetSession = useCallback(() => {
    sessionStartRef.current = new Date();
    currentSessionItemsRef.current.clear();
    scrollDataRef.current = [];
  }, []);

  // Initialize session tracking
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Could save behavior data to localStorage here
      localStorage.setItem('userBehaviorPattern', JSON.stringify(behaviorPattern));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sessionStartRef.current = new Date();
      }
    };

    // Load saved behavior pattern
    const saved = localStorage.getItem('userBehaviorPattern');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBehaviorPattern(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to load saved behavior pattern:', error);
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [behaviorPattern]);

  return {
    trackView,
    trackInteraction,
    trackScroll,
    predictInterest,
    getBehaviorInsights,
    resetSession,
    behaviorPattern,
    updateBehaviorPatterns
  };
};
