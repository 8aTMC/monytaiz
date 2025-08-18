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
    <div className="relative">
      <button
        onClick={toggleTheme}
        className={`
          relative w-16 h-8 rounded-full p-1 transition-all duration-500 ease-in-out
          ${theme === 'light' 
            ? 'bg-gradient-to-r from-blue-400 to-blue-500' 
            : 'bg-gradient-to-r from-slate-700 to-slate-900'
          }
          shadow-lg hover:shadow-xl
        `}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {/* Background Elements */}
        <div className="absolute inset-1 rounded-full overflow-hidden">
          {/* Light mode background */}
          <div className={`
            absolute inset-0 transition-opacity duration-500
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Clouds */}
            <div className="absolute top-1 left-2 w-2 h-1 bg-white rounded-full opacity-60"></div>
            <div className="absolute top-2 right-3 w-1.5 h-0.5 bg-white rounded-full opacity-40"></div>
          </div>
          
          {/* Dark mode background */}
          <div className={`
            absolute inset-0 transition-opacity duration-500
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Stars */}
            <div className="absolute top-1 left-1 w-0.5 h-0.5 bg-white rounded-full animate-pulse"></div>
            <div className="absolute top-3 left-3 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute top-2 right-2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-1 right-4 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
          </div>
        </div>
        
        {/* Toggle Circle */}
        <div className={`
          relative w-6 h-6 rounded-full transition-all duration-500 ease-in-out transform
          ${theme === 'light' 
            ? 'translate-x-0 bg-gradient-to-br from-yellow-300 to-orange-400 shadow-lg' 
            : 'translate-x-8 bg-gradient-to-br from-slate-200 to-slate-300 shadow-lg'
          }
          flex items-center justify-center
        `}>
          {/* Sun rays for light mode */}
          <div className={`
            absolute inset-0 transition-opacity duration-300
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-1 bg-yellow-200 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-14px)`,
                }}
              />
            ))}
          </div>
          
          {/* Moon crater for dark mode */}
          <div className={`
            absolute transition-opacity duration-300
            ${theme === 'dark' ? 'opacity-60' : 'opacity-0'}
          `}>
            <div className="w-1 h-1 rounded-full bg-slate-400 absolute top-1 right-1"></div>
            <div className="w-0.5 h-0.5 rounded-full bg-slate-400 absolute bottom-1 left-1"></div>
          </div>
        </div>
      </button>
    </div>
  );
};