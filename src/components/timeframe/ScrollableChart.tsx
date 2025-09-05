import { useRef, useEffect, useState } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Line } from 'recharts';
import { DataBucket } from '@/types/timeframe';
import { ChartMetric, metricConfig } from './ChartSelector';

interface MetricData {
  metric: ChartMetric;
  data: DataBucket[];
  format?: (value: number) => string;
}

interface ScrollableChartProps {
  metrics: MetricData[];
  className?: string;
}

export const ScrollableChart = ({ metrics, className }: ScrollableChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  
  // Get the data length from first metric (they should all have same length)
  const dataLength = metrics.length > 0 ? metrics[0].data.length : 0;
  
  // Calculate if we need scrolling (more than ~12 data points)
  const needsScrolling = dataLength > 12;
  const chartWidth = needsScrolling ? Math.max(dataLength * 60, 800) : containerWidth;
  
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

  // Merge all metric data into a single dataset for the chart
  const chartData = dataLength > 0 ? metrics[0].data.map((_, index) => {
    const point: any = { 
      label: metrics[0].data[index].label,
      start: metrics[0].data[index].start,
      end: metrics[0].data[index].end 
    };
    
    metrics.forEach(({ metric, data }) => {
      point[metric] = data[index]?.value || 0;
    });
    
    return point;
  }) : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length && payload[0].payload) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.label}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(data.start).toLocaleDateString()} - {new Date(data.end).toLocaleDateString()}
          </p>
          {payload.map((item: any, index: number) => {
            const metric = metrics.find(m => m.metric === item.dataKey);
            const formatter = metric?.format;
            const formattedValue = formatter ? formatter(item.value) : item.value.toLocaleString();
            
            return (
              <p key={index} className="text-sm" style={{ color: item.color }}>
                {metricConfig[item.dataKey as ChartMetric]?.label}: {formattedValue}
              </p>
            );
          })}
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
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval={needsScrolling ? 0 : 'preserveStartEnd'}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Render each selected metric */}
            {metrics.map(({ metric }) => {
              const config = metricConfig[metric];
              
              if (metric === 'revenue') {
                return (
                  <Bar 
                    key={metric}
                    dataKey={metric}
                    fill={config.color}
                    name={config.label}
                    radius={[4, 4, 0, 0]}
                  />
                );
              } else {
                return (
                  <Line
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
                    name={config.label}
                  />
                );
              }
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};