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
    <div className="fixed top-4 right-4 z-[99999] !fixed">
      <button
        onClick={toggleTheme}
        className={`
          relative w-16 h-9 rounded-full p-0.5 transition-all duration-700 ease-in-out
          shadow-xl hover:shadow-2xl hover:scale-105
          ${isLight 
            ? 'bg-gradient-to-r from-sky-300 via-sky-400 to-blue-500' 
            : 'bg-gradient-to-r from-slate-800 via-slate-900 to-gray-900'
          }
          border-2 ${isLight ? 'border-sky-200' : 'border-slate-600'}
        `}
        title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      >
        {/* Sky Background with Clouds */}
        <SkyBackground isVisible={isLight} />
        
        {/* Starry Night Background */}
        <NightBackground isVisible={!isLight} />

        {/* Toggle Circle */}
        <div 
          className={`
            relative w-7 h-7 rounded-full transition-all duration-700 ease-in-out
            shadow-lg flex items-center justify-center transform z-10
            ${isLight 
              ? 'translate-x-0 bg-gradient-to-br from-orange-300 via-yellow-400 to-orange-500' 
              : 'translate-x-8 bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500'
            }
          `}
        >
          {/* Sun Icon */}
          <SunIcon isVisible={isLight} />
          
          {/* Moon Icon */}
          <MoonIcon isVisible={!isLight} />
        </div>
      </button>
    </div>
  );
};

const SkyBackground = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`absolute inset-1 rounded-full overflow-hidden transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    {/* Clouds */}
    <div className="absolute top-1 left-2 w-3 h-1.5 bg-white rounded-full opacity-90" />
    <div className="absolute top-2.5 right-3 w-2.5 h-1 bg-white rounded-full opacity-80" />
    <div className="absolute top-1.5 left-6 w-2 h-1 bg-white rounded-full opacity-75" />
    <div className="absolute top-3 right-6 w-1.5 h-0.5 bg-white rounded-full opacity-70" />
    <div className="absolute top-0.5 right-8 w-1 h-0.5 bg-white rounded-full opacity-60" />
  </div>
);

const NightBackground = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`absolute inset-1 rounded-full overflow-hidden transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    {/* Stars */}
    <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" />
    <div className="absolute top-2.5 left-4 w-0.5 h-0.5 bg-yellow-200 rounded-full animate-pulse" style={{animationDelay: '0.3s'}} />
    <div className="absolute top-1.5 right-3 w-0.5 h-0.5 bg-blue-200 rounded-full animate-pulse" style={{animationDelay: '0.6s'}} />
    <div className="absolute top-3.5 right-5 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0.9s'}} />
    <div className="absolute top-0.5 left-6 w-0.5 h-0.5 bg-purple-200 rounded-full animate-pulse" style={{animationDelay: '1.2s'}} />
    <div className="absolute top-4 left-8 w-0.5 h-0.5 bg-cyan-200 rounded-full animate-pulse" style={{animationDelay: '1.5s'}} />
    <div className="absolute top-2 right-7 w-0.5 h-0.5 bg-pink-200 rounded-full animate-pulse" style={{animationDelay: '1.8s'}} />
    
    {/* Twinkling effect */}
    <div className="absolute top-1.5 left-3 w-0.5 h-0.5 bg-white rounded-full opacity-40 animate-ping" style={{animationDelay: '0.5s'}} />
    <div className="absolute top-3 right-2 w-0.5 h-0.5 bg-yellow-100 rounded-full opacity-40 animate-ping" style={{animationDelay: '2s'}} />
  </div>
);

const SunIcon = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    {/* Sun Rays */}
    {Array.from({ length: 12 }).map((_, i) => (
      <div
        key={i}
        className="absolute w-0.5 h-1.5 bg-orange-300 rounded-full opacity-80"
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-10px)`,
        }}
      />
    ))}
  </div>
);

const MoonIcon = ({ isVisible }: { isVisible: boolean }) => (
  <div className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
    {/* Empty moon - no circles */}
  </div>
);