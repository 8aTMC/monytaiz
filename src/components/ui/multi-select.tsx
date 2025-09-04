import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MultiSelectOption {
  value: string
  label: string
  description?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  emptyMessage?: string
  maxDisplayed?: number
  disabled?: boolean
  loading?: boolean
  className?: string
}

export const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  emptyMessage = "No options found.",
  maxDisplayed = 3,
  disabled = false,
  loading = false,
  className,
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleRemove = (optionValue: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onChange(value.filter((item) => item !== optionValue))
  }

  const selectedOptions = options.filter((option) => value.includes(option.value))
  const displayedOptions = selectedOptions.slice(0, maxDisplayed)
  const remainingCount = selectedOptions.length - maxDisplayed

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-10 h-auto px-3 py-2 bg-gradient-glass border-border/50 hover:border-primary/30",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
          {...props}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {displayedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  >
                    <span className="max-w-32 truncate">{option.label}</span>
                    <button
                      className="ml-1 hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                      onClick={(e) => handleRemove(option.value, e)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {remainingCount > 0 && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    +{remainingCount} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-0 bg-card/95 backdrop-blur-md border-border/50">
        <Command>
          <CommandInput placeholder="Search options..." />
          <CommandEmpty>{loading ? "Loading..." : emptyMessage}</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

MultiSelect.displayName = "MultiSelect"