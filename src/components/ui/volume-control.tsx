import * as React from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface VolumeControlProps {
  volume: number[]
  isMuted: boolean
  onVolumeChange: (value: number[]) => void
  onToggleMute: () => void
  className?: string
  variant?: "video" | "audio"
}

export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  className,
  variant = "video"
}: VolumeControlProps) {
  const [open, setOpen] = React.useState(false)
  const volumePercentage = Math.round(volume[0] * 100)

  const buttonStyles = variant === "video" 
    ? "text-white hover:bg-white/20 p-2"
    : "h-8 w-8"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            // If right-clicked or ctrl+clicked, toggle mute instead of opening popover
            if (e.ctrlKey || e.button === 2) {
              e.preventDefault()
              onToggleMute()
              return
            }
            setOpen(!open)
          }}
          className={cn(buttonStyles, className)}
          title={`Volume: ${isMuted ? 'Muted' : `${volumePercentage}%`}`}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-12 p-2" 
        side="top" 
        align="center"
        sideOffset={8}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {volumePercentage}%
          </span>
          <div className="h-20 flex items-center">
            <Slider
              value={volume}
              onValueChange={onVolumeChange}
              max={1}
              step={0.01}
              orientation="vertical"
              className="h-full"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMute}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}