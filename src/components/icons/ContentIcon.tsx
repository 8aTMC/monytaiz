// Custom content icon combining photo and film strip
import React from 'react';

interface ContentIconProps {
  className?: string;
}

export const ContentIcon: React.FC<ContentIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-full h-full"
      >
        {/* Film strip background - more pronounced */}
        <rect x="1" y="3" width="22" height="18" rx="2" fill="currentColor" className="opacity-15" />
        <rect x="1" y="5" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="1" y="8" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="1" y="11" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="1" y="14" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="1" y="17" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="20" y="5" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="20" y="8" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="20" y="11" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="20" y="14" width="3" height="2" fill="currentColor" className="opacity-10" />
        <rect x="20" y="17" width="3" height="2" fill="currentColor" className="opacity-10" />
        
        {/* Photo icon - clean and prominent */}
        <rect x="6" y="8" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="9" cy="11" r="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m17 14-3-3a2 2 0 0 0-2.8 0L8 14" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
};