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
      {/* Back frame */}
      <rect x="6" y="4" width="16" height="12" rx="2" className="opacity-40" />
      
      {/* Middle frame */}
      <rect x="4" y="6" width="16" height="12" rx="2" className="opacity-70" />
      
      {/* Front frame with content */}
      <rect x="2" y="8" width="16" height="12" rx="2" />
      
      {/* Image content inside front frame */}
      <circle cx="6" cy="12" r="1.5" />
      <path d="m18 16-3-3-2 2-3-3-6 6" />
    </svg>
  );
};