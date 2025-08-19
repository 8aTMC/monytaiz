// Custom content icon combining photo and film strip
import React from 'react';

interface ContentIconProps {
  className?: string;
}

export const ContentIcon: React.FC<ContentIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Film strip outline */}
      <rect x="3" y="4" width="18" height="16" rx="2" />
      
      {/* Film strip perforations - left side */}
      <rect x="3" y="6" width="2" height="2" />
      <rect x="3" y="9" width="2" height="2" />
      <rect x="3" y="12" width="2" height="2" />
      <rect x="3" y="15" width="2" height="2" />
      
      {/* Film strip perforations - right side */}
      <rect x="19" y="6" width="2" height="2" />
      <rect x="19" y="9" width="2" height="2" />
      <rect x="19" y="12" width="2" height="2" />
      <rect x="19" y="15" width="2" height="2" />
      
      {/* Play button in center */}
      <polygon points="10,9 10,15 16,12" fill="currentColor" />
    </svg>
  );
};