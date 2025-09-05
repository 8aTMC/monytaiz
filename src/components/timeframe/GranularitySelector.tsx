import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Granularity } from "@/types/timeframe";

interface GranularitySelectorProps {
  allowed: Granularity[];
  value: Granularity;
  onChange: (granularity: Granularity) => void;
}

const granularityLabels: Record<Granularity, string> = {
  hour: 'Shown by hour',
  day: 'Shown by day', 
  week: 'Shown by week',
  month: 'Shown by month'
};

export const GranularitySelector = ({ allowed, value, onChange }: GranularitySelectorProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowed.map((granularity) => (
          <SelectItem key={granularity} value={granularity}>
            {granularityLabels[granularity]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};