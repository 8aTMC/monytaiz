import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { TimeframePreset } from "@/types/timeframe";

interface DateRangePickerProps {
  value: { start: Date; end: Date };
  onChange: (range: { start: Date; end: Date }) => void;
  timezone?: string;
}

export const DateRangePicker = ({ value, onChange, timezone }: DateRangePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date }>({
    from: value.start,
    to: value.end
  });

  const today = new Date();

  const presets: TimeframePreset[] = [
    {
      label: "Last 7 days",
      getValue: () => ({
        start: subDays(today, 6),
        end: today
      })
    },
    {
      label: "Last 30 days", 
      getValue: () => ({
        start: subDays(today, 29),
        end: today
      })
    },
    {
      label: "Last 90 days",
      getValue: () => ({
        start: subDays(today, 89),
        end: today
      })
    },
    {
      label: "Last 365 days",
      getValue: () => ({
        start: subDays(today, 364),
        end: today
      })
    },
    {
      label: "Current month",
      getValue: () => ({
        start: startOfMonth(today),
        end: today
      })
    },
    {
      label: "Last month",
      getValue: () => {
        const lastMonth = subMonths(today, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      }
    },
    {
      label: "Current year",
      getValue: () => ({
        start: startOfYear(today),
        end: today
      })
    }
  ];

  const handlePresetClick = (preset: TimeframePreset) => {
    const range = preset.getValue();
    setSelectedRange({ from: range.start, to: range.end });
    onChange(range);
    setIsOpen(false);
  };

  const handleRangeSelect = (range: { from: Date; to: Date } | undefined) => {
    if (!range?.from) return;
    
    const newRange = {
      from: range.from,
      to: range.to || range.from
    };
    
    setSelectedRange(newRange);
    
    if (range.to) {
      onChange({ start: range.from, end: range.to });
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value.start && value.end ? (
            format(value.start, "MMM dd, yyyy") + " - " + format(value.end, "MMM dd, yyyy")
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r border-border p-3 w-48">
            <div className="space-y-1">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={value.start}
              selected={selectedRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};