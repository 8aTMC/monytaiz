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
          relative w-20 h-10 rounded-full p-1 transition-all duration-700 ease-in-out
          ${theme === 'light' 
            ? 'bg-gradient-to-r from-sky-300 via-blue-400 to-blue-500' 
            : 'bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900'
          }
          shadow-xl hover:shadow-2xl hover:scale-105 border-2
          ${theme === 'light' ? 'border-blue-200' : 'border-slate-600'}
        `}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {/* Background Elements */}
        <div className="absolute inset-1 rounded-full overflow-hidden">
          {/* Light mode background */}
          <div className={`
            absolute inset-0 transition-opacity duration-700
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Clouds */}
            <div className="absolute top-1 left-3 w-3 h-1.5 bg-white rounded-full opacity-70"></div>
            <div className="absolute top-2.5 right-4 w-2 h-1 bg-white rounded-full opacity-50"></div>
            <div className="absolute top-1.5 left-8 w-1.5 h-0.5 bg-white rounded-full opacity-60"></div>
          </div>
          
          {/* Dark mode background */}
          <div className={`
            absolute inset-0 transition-opacity duration-700
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Enhanced Stars */}
            <div className="absolute top-1 left-2 w-0.5 h-0.5 bg-yellow-200 rounded-full animate-pulse shadow-sm"></div>
            <div className="absolute top-3 left-4 w-0.5 h-0.5 bg-blue-200 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
            <div className="absolute top-2 right-3 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
            <div className="absolute top-1.5 right-6 w-0.5 h-0.5 bg-purple-200 rounded-full animate-pulse" style={{animationDelay: '0.9s'}}></div>
            <div className="absolute top-4 left-6 w-0.5 h-0.5 bg-pink-200 rounded-full animate-pulse" style={{animationDelay: '1.2s'}}></div>
            <div className="absolute top-2.5 left-8 w-0.5 h-0.5 bg-cyan-200 rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
            <div className="absolute top-1 right-8 w-0.5 h-0.5 bg-yellow-100 rounded-full animate-pulse" style={{animationDelay: '1.8s'}}></div>
            <div className="absolute top-3.5 right-5 w-0.5 h-0.5 bg-indigo-200 rounded-full animate-pulse" style={{animationDelay: '2.1s'}}></div>
            
            {/* Twinkling stars */}
            <div className="absolute top-0.5 left-5 w-0.5 h-0.5 bg-white rounded-full opacity-40 animate-ping" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute top-4.5 right-2 w-0.5 h-0.5 bg-yellow-100 rounded-full opacity-40 animate-ping" style={{animationDelay: '1.5s'}}></div>
          </div>
        </div>
        
        {/* Toggle Circle */}
        <div className={`
          relative w-8 h-8 rounded-full transition-all duration-700 ease-in-out transform
          ${theme === 'light' 
            ? 'translate-x-0 bg-gradient-to-br from-yellow-200 via-yellow-300 to-orange-400 shadow-xl' 
            : 'translate-x-10 bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 shadow-xl'
          }
          flex items-center justify-center border-2
          ${theme === 'light' ? 'border-yellow-100' : 'border-slate-100'}
        `}>
          {/* Enhanced Sun for light mode */}
          <div className={`
            absolute inset-0 transition-opacity duration-500
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Sun rays */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-1.5 bg-yellow-100 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-18px)`,
                }}
              />
            ))}
            {/* Inner sun glow */}
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300"></div>
          </div>
          
          {/* Enhanced Moon for dark mode */}
          <div className={`
            absolute inset-0 transition-opacity duration-500
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `}>
            {/* Moon craters and details */}
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 absolute top-1.5 right-1.5 opacity-80"></div>
            <div className="w-1 h-1 rounded-full bg-slate-400 absolute top-2.5 left-1.5 opacity-60"></div>
            <div className="w-0.5 h-0.5 rounded-full bg-slate-400 absolute bottom-1.5 right-2 opacity-70"></div>
            <div className="w-0.5 h-0.5 rounded-full bg-slate-300 absolute bottom-2 left-2.5 opacity-50"></div>
            <div className="w-1 h-0.5 rounded-full bg-slate-300 absolute top-3 right-2.5 opacity-40"></div>
            
            {/* Moon shadow/dark side */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-transparent to-slate-400 opacity-20"></div>
            
            {/* Moon glow */}
            <div className="absolute -inset-1 rounded-full bg-slate-200 opacity-10 blur-sm"></div>
          </div>
        </div>
      </button>
    </div>
  );
};