import React, { useState, useEffect } from 'react';
import { TrendingUp, Wifi, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QualityTransition {
  from: string;
  to: string;
  timestamp: number;
}

interface QualityTransitionNotificationProps {
  transition: QualityTransition | null;
  className?: string;
}

export const QualityTransitionNotification: React.FC<QualityTransitionNotificationProps> = ({
  transition,
  className
}) => {
  const [visible, setVisible] = useState(false);
  const [currentTransition, setCurrentTransition] = useState<QualityTransition | null>(null);

  useEffect(() => {
    if (transition && transition !== currentTransition) {
      setCurrentTransition(transition);
      setVisible(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [transition, currentTransition]);

  if (!currentTransition || !visible) return null;

  const isUpgrade = currentTransition.from !== 'initial' && 
    parseInt(currentTransition.to.replace('p', '')) > parseInt(currentTransition.from.replace('p', ''));

  const getIcon = () => {
    if (currentTransition.from === 'initial') return <Wifi className="w-4 h-4" />;
    if (isUpgrade) return <TrendingUp className="w-4 h-4" />;
    return <Gauge className="w-4 h-4" />;
  };

  const getMessage = () => {
    if (currentTransition.from === 'initial') {
      return `Started in ${currentTransition.to.toUpperCase()}`;
    }
    if (isUpgrade) {
      return `Upgraded to ${currentTransition.to.toUpperCase()}`;
    }
    return `Switched to ${currentTransition.to.toUpperCase()}`;
  };

  const getColor = () => {
    if (currentTransition.from === 'initial') return 'bg-blue-500/90 text-white';
    if (isUpgrade) return 'bg-green-500/90 text-white';
    return 'bg-orange-500/90 text-white';
  };

  return (
    <div className={cn(
      "absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 backdrop-blur-sm",
      getColor(),
      visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
      className
    )}>
      {getIcon()}
      <span>{getMessage()}</span>
    </div>
  );
};