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
        {/* Film strip background */}
        <rect x="3" y="2" width="18" height="20" rx="2" className="opacity-30" />
        <rect x="3" y="4" width="2" height="2" className="fill-current opacity-25" />
        <rect x="3" y="7" width="2" height="2" className="fill-current opacity-25" />
        <rect x="3" y="10" width="2" height="2" className="fill-current opacity-25" />
        <rect x="3" y="13" width="2" height="2" className="fill-current opacity-25" />
        <rect x="3" y="16" width="2" height="2" className="fill-current opacity-25" />
        <rect x="19" y="4" width="2" height="2" className="fill-current opacity-25" />
        <rect x="19" y="7" width="2" height="2" className="fill-current opacity-25" />
        <rect x="19" y="10" width="2" height="2" className="fill-current opacity-25" />
        <rect x="19" y="13" width="2" height="2" className="fill-current opacity-25" />
        <rect x="19" y="16" width="2" height="2" className="fill-current opacity-25" />
        
        {/* Photo icon in front */}
        <rect x="7" y="8" width="10" height="8" rx="1.5" strokeWidth="2" />
        <circle cx="9.5" cy="11" r="1" strokeWidth="1.5" />
        <path d="m15 14-2.5-2.5a1.5 1.5 0 0 0-2 0L8 14" strokeWidth="1.5" />
      </svg>
    </div>
  );
};