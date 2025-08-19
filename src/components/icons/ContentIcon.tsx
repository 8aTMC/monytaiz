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
        {/* Film strip frame - solid background */}
        <rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" className="opacity-70" />
        
        {/* Film strip perforations - left side */}
        <rect x="2" y="6" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="2" y="8.5" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="2" y="11" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="2" y="13.5" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="2" y="16" width="2" height="1.5" fill="white" className="opacity-90" />
        
        {/* Film strip perforations - right side */}
        <rect x="20" y="6" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="20" y="8.5" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="20" y="11" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="20" y="13.5" width="2" height="1.5" fill="white" className="opacity-90" />
        <rect x="20" y="16" width="2" height="1.5" fill="white" className="opacity-90" />
        
        {/* Photo/image icon on top - white to stand out */}
        <rect x="6" y="8" width="12" height="8" rx="1.5" fill="white" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="11" r="1" fill="currentColor" />
        <path d="m16 14-2.5-2.5a1.5 1.5 0 0 0-2 0L8 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
};