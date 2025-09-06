import React from 'react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Check } from 'lucide-react';

interface SpeedSelectorProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
  speeds?: number[];
  className?: string;
  variant?: 'video' | 'audio';
}

const DEFAULT_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 5];

export const SpeedSelector: React.FC<SpeedSelectorProps> = ({
  currentSpeed,
  onSpeedChange,
  speeds = DEFAULT_SPEEDS,
  className = '',
  variant = 'video'
}) => {
  const buttonStyles = variant === 'video' 
    ? "text-white hover:bg-white/20 border-white/20 bg-black/50 h-7 px-2 text-xs"
    : "h-7 px-2 text-xs";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`${buttonStyles} ${className}`}
        >
          {currentSpeed}x
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="center" 
        side="top" 
        className="w-20 p-1"
        sideOffset={8}
      >
        <div className="flex flex-col gap-1">
          {speeds.map((speed) => (
            <Button
              key={speed}
              variant="ghost"
              size="sm"
              onClick={() => onSpeedChange(speed)}
              className={`h-7 px-2 text-xs justify-between hover:bg-accent ${
                currentSpeed === speed ? 'bg-accent' : ''
              }`}
            >
              <span>{speed}x</span>
              {currentSpeed === speed && (
                <Check className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};