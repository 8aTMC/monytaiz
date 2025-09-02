interface WaveformIconProps {
  className?: string;
}

export const WaveformIcon = ({ className }: WaveformIconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="2" y="8" width="1.5" height="8" rx="0.75" fill="currentColor" />
      <rect x="5" y="6" width="1.5" height="12" rx="0.75" fill="currentColor" />
      <rect x="8" y="3" width="1.5" height="18" rx="0.75" fill="currentColor" />
      <rect x="11" y="5" width="1.5" height="14" rx="0.75" fill="currentColor" />
      <rect x="14" y="4" width="1.5" height="16" rx="0.75" fill="currentColor" />
      <rect x="17" y="7" width="1.5" height="10" rx="0.75" fill="currentColor" />
      <rect x="20" y="9" width="1.5" height="6" rx="0.75" fill="currentColor" />
    </svg>
  );
};