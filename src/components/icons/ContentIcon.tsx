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
        {/* Film strip background (behind) */}
        <rect x="2" y="3" width="20" height="18" rx="2" className="opacity-40" />
        <rect x="2" y="5" width="2" height="2" className="fill-current opacity-20" />
        <rect x="2" y="8" width="2" height="2" className="fill-current opacity-20" />
        <rect x="2" y="11" width="2" height="2" className="fill-current opacity-20" />
        <rect x="2" y="14" width="2" height="2" className="fill-current opacity-20" />
        <rect x="2" y="17" width="2" height="2" className="fill-current opacity-20" />
        <rect x="20" y="5" width="2" height="2" className="fill-current opacity-20" />
        <rect x="20" y="8" width="2" height="2" className="fill-current opacity-20" />
        <rect x="20" y="11" width="2" height="2" className="fill-current opacity-20" />
        <rect x="20" y="14" width="2" height="2" className="fill-current opacity-20" />
        <rect x="20" y="17" width="2" height="2" className="fill-current opacity-20" />
        
        {/* Image/photograph icon (in front) */}
        <rect x="6" y="7" width="12" height="10" rx="2" strokeWidth="2" />
        <circle cx="9" cy="10" r="1.5" strokeWidth="2" />
        <path d="m18 15-3.5-3.5a2 2 0 0 0-2.8 0L8 15" strokeWidth="2" />
      </svg>
    </div>
  );
};