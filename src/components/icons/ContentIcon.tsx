// Custom content icon combining photo and film strip
import React from 'react';

interface ContentIconProps {
  className?: string;
}

export const ContentIcon: React.FC<ContentIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        {/* Film strip background (vertical) */}
        <rect x="3" y="2" width="4" height="20" rx="1" className="opacity-60" />
        <rect x="3.5" y="4" width="3" height="2" className="fill-current opacity-30" />
        <rect x="3.5" y="8" width="3" height="2" className="fill-current opacity-30" />
        <rect x="3.5" y="12" width="3" height="2" className="fill-current opacity-30" />
        <rect x="3.5" y="16" width="3" height="2" className="fill-current opacity-30" />
        <rect x="3.5" y="20" width="3" height="1.5" className="fill-current opacity-30" />
        
        {/* Photograph icon (horizontal, in front) */}
        <rect x="8" y="7" width="12" height="10" rx="2" />
        <circle cx="11" cy="10" r="1" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L8 19" />
      </svg>
    </div>
  );
};