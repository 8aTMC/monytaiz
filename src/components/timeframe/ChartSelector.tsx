import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export type ChartMetric = 'revenue' | 'sent' | 'purchased';

interface ChartSelectorProps {
  selectedMetrics: ChartMetric[];
  onSelectionChange: (metrics: ChartMetric[]) => void;
}

const metricConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
    icon: '💰'
  },
  sent: {
    label: 'Times Sent', 
    color: 'hsl(142, 76%, 36%)', // green
    icon: '📤'
  },
  purchased: {
    label: 'Times Purchased',
    color: 'hsl(24, 95%, 53%)', // orange  
    icon: '🛒'
  }
};

export const ChartSelector = ({ selectedMetrics, onSelectionChange }: ChartSelectorProps) => {
  const handleMetricToggle = (metric: ChartMetric, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedMetrics, metric]);
    } else {
      onSelectionChange(selectedMetrics.filter(m => m !== metric));
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap gap-6">
          {Object.entries(metricConfig).map(([metric, config]) => {
            const isSelected = selectedMetrics.includes(metric as ChartMetric);
            
            return (
              <div key={metric} className="flex items-center space-x-2">
                <Checkbox
                  id={metric}
                  checked={isSelected}
                  onCheckedChange={(checked) => 
                    handleMetricToggle(metric as ChartMetric, checked as boolean)
                  }
                />
                <Label 
                  htmlFor={metric}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: config.color }}
                  />
                </Label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export { metricConfig };