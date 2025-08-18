import { useState, useEffect } from 'react';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const isLight = theme === 'light';

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={toggleTheme}
        className={`
          relative w-14 h-7 rounded-full p-0.5 transition-all duration-500 ease-in-out
          shadow-lg hover:shadow-xl hover:scale-105
          ${isLight 
            ? 'bg-gradient-to-r from-orange-300 to-yellow-400' 
            : 'bg-gradient-to-r from-indigo-800 to-purple-900'
          }
        `}
        title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      >
        {/* Toggle Circle */}
        <div 
          className={`
            relative w-6 h-6 rounded-full transition-all duration-500 ease-in-out
            shadow-md flex items-center justify-center transform
            ${isLight 
              ? 'translate-x-0 bg-gradient-to-br from-yellow-200 to-orange-300' 
              : 'translate-x-7 bg-gradient-to-br from-slate-700 to-slate-800'
            }
          `}
        >
          {/* Sun Icon */}
          <SunIcon isVisible={isLight} />
          
          {/* Moon Icon */}
          <MoonIcon isVisible={!isLight} />
        </div>

        {/* Background Stars */}
        <BackgroundStars isVisible={!isLight} />
      </button>
    </div>
  );
};

const SunIcon = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    {/* Sun Rays */}
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="absolute w-0.5 h-1 bg-orange-400 rounded-full"
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-8px)`,
        }}
      />
    ))}
    
    {/* Sun Center */}
    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400" />
  </div>
);

const MoonIcon = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    <div className="relative w-4 h-4">
      <div className="absolute inset-0 rounded-full bg-slate-300" />
      <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-slate-800" />
    </div>
  </div>
);

const BackgroundStars = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`absolute inset-1 rounded-full transition-opacity duration-500 overflow-hidden ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    <Star className="top-1 left-1" delay="0s" />
    <Star className="top-3 right-2" delay="0.5s" />
    <Star className="bottom-1 left-2" delay="1s" color="bg-blue-200" />
  </div>
);

const Star = ({ 
  className, 
  delay = "0s", 
  color = "bg-yellow-200" 
}: { 
  className: string; 
  delay?: string; 
  color?: string; 
}) => (
  <div 
    className={`absolute w-0.5 h-0.5 ${color} rounded-full animate-pulse ${className}`}
    style={{ animationDelay: delay }}
  />
);