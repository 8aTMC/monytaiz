import React from 'react';

interface SpendingChartProps {
  userId: string;
}

const SpendingChart: React.FC<SpendingChartProps> = ({ userId }) => {
  // Spending chart component for user analytics
  // Mock data for the last 30 days - in a real app, this would come from the database
  const generateMockData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      // Generate random spending data (0-50)
      const spending = Math.random() * 50;
      
      data.push({
        date: date.toISOString().split('T')[0],
        spending: Math.round(spending * 100) / 100,
        day: date.getDate()
      });
    }
    
    return data;
  };

  const data = generateMockData();
  const totalSpending = data.reduce((sum, item) => sum + item.spending, 0);
  const maxSpending = Math.max(...data.map(d => d.spending));

  // Simple SVG line chart
  const createPath = () => {
    const width = 280;
    const height = 40;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (d.spending / maxSpending) * height;
      return `${x},${y}`;
    });
    return `M${points.join('L')}`;
  };

  return (
    <div className="w-full bg-gradient-card rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-foreground">30-Day Spending</h4>
        <span className="text-sm font-semibold text-primary">
          ${totalSpending.toFixed(2)}
        </span>
      </div>
      <div className="h-12 w-full relative">
        <svg width="100%" height="100%" viewBox="0 0 280 40" className="overflow-visible">
          <path
            d={createPath()}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="drop-shadow-sm"
          />
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * 280;
            const y = 40 - (d.spending / maxSpending) * 40;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2"
                fill="hsl(var(--primary))"
                className="opacity-60"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default SpendingChart;