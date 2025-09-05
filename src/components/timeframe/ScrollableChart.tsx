import { useRef, useEffect, useState } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Line } from 'recharts';
import { DataBucket } from '@/types/timeframe';

interface ScrollableChartProps {
  data: DataBucket[];
  className?: string;
  onTooltipValueFormat?: (value: number) => string;
}

export const ScrollableChart = ({ data, className, onTooltipValueFormat }: ScrollableChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  
  // Calculate if we need scrolling (more than ~12 data points)
  const needsScrolling = data.length > 12;
  const chartWidth = needsScrolling ? Math.max(data.length * 60, 800) : containerWidth;
  
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTooltip = (value: any, name: string) => {
    if (name === 'value' && onTooltipValueFormat) {
      return [onTooltipValueFormat(value), 'Revenue'];
    }
    return [value, name];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as DataBucket;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.label}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(data.start).toLocaleDateString()} - {new Date(data.end).toLocaleDateString()}
          </p>
          {payload.map((item: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {item.name}: {formatTooltip(item.value, item.name)[0]}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      ref={containerRef}
      className={`${className} ${needsScrolling ? 'overflow-x-auto' : ''}`}
      style={{ width: '100%' }}
    >
      <div style={{ width: chartWidth, minWidth: '100%' }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval={needsScrolling ? 0 : 'preserveStartEnd'}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => onTooltipValueFormat ? onTooltipValueFormat(value) : value}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))" 
              name="Revenue"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};