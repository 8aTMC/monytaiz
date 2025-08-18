import { useState, useEffect } from 'react';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // Default to dark theme
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

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={toggleTheme}
        className={`
          relative w-14 h-7 rounded-full p-0.5 transition-all duration-500 ease-in-out
          ${theme === 'light' 
            ? 'bg-gradient-to-r from-orange-300 to-yellow-400' 
            : 'bg-gradient-to-r from-indigo-800 to-purple-900'
          }
          shadow-lg hover:shadow-xl hover:scale-105
        `}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {/* Toggle Circle */}
        <div className={`
          relative w-6 h-6 rounded-full transition-all duration-500 ease-in-out transform
          ${theme === 'light' 
            ? 'translate-x-0 bg-gradient-to-br from-yellow-200 to-orange-300 shadow-md' 
            : 'translate-x-7 bg-gradient-to-br from-slate-700 to-slate-800 shadow-md'
          }
          flex items-center justify-center
        `}>
          {/* Sun Icon for light mode */}
          <div className={`
            transition-opacity duration-300
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Simple sun rays */}
            {[...Array(8)].map((_, i) => (
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
            {/* Sun center */}
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400"></div>
          </div>
          
          {/* Moon Icon for dark mode */}
          <div className={`
            transition-opacity duration-300
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Crescent moon shape */}
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 rounded-full bg-slate-300"></div>
              <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-slate-800"></div>
            </div>
          </div>
        </div>

        {/* Background stars for dark mode */}
        <div className={`
          absolute inset-1 rounded-full transition-opacity duration-500 overflow-hidden
          ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
        `}>
          <div className="absolute top-1 left-1 w-0.5 h-0.5 bg-yellow-200 rounded-full animate-pulse"></div>
          <div className="absolute top-3 right-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
          <div className="absolute bottom-1 left-2 w-0.5 h-0.5 bg-blue-200 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        </div>
      </button>
    </div>
  );
};