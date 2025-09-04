import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface RangeSliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  formatValue?: (value: number) => string
}

const RangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(({ 
  className, 
  value = [0, 100], 
  onValueChange, 
  min = 0, 
  max = 100, 
  step = 1,
  minLabel = "Min",
  maxLabel = "Max",
  formatValue = (val) => val.toString(),
  ...props 
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value)
  
  React.useEffect(() => {
    setInternalValue(value)
  }, [value])

  const handleValueChange = (newValue: number[]) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <div className="space-y-3">
      {/* Labels and Values */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{minLabel}: {formatValue(internalValue[0])}</span>
        <span>{maxLabel}: {formatValue(internalValue[1])}</span>
      </div>
      
      {/* Slider */}
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        value={internalValue}
        onValueChange={handleValueChange}
        min={min}
        max={max}
        step={step}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary/30">
          <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary to-primary-glow rounded-full" />
        </SliderPrimitive.Track>
        
        {/* First thumb */}
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 hover:shadow-shadow-glow" />
        
        {/* Second thumb */}
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 hover:shadow-shadow-glow" />
      </SliderPrimitive.Root>
      
      {/* Range indicator */}
      <div className="flex justify-center text-xs text-muted-foreground">
        Range: {formatValue(internalValue[1] - internalValue[0])}
      </div>
    </div>
  )
})

RangeSlider.displayName = "RangeSlider"

export { RangeSlider }