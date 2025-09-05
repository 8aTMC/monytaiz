import * as React from "react"
import { Check, ChevronDown, X, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  avatar?: string
  initials?: string
  username?: string
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
  maxSelections?: number
  searchPlaceholder?: string
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
  maxSelections = Infinity,
  searchPlaceholder = "Search options...",
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue))
    } else {
      // Check max selections limit
      if (value.length >= maxSelections) {
        return // Don't allow more selections
      }
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
  const isAtMaxLimit = value.length >= maxSelections

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
                    <div
                      className="ml-1 hover:bg-primary/30 rounded-full p-0.5 transition-colors cursor-pointer"
                      onClick={(e) => handleRemove(option.value, e)}
                    >
                      <X className="h-3 w-3" />
                    </div>
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
      <PopoverContent className="w-full min-w-[var(--radix-popover-trigger-width)] p-0 bg-card/95 backdrop-blur-md border-border/50 z-[110]">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandEmpty>{loading ? "Loading..." : emptyMessage}</CommandEmpty>
          {isAtMaxLimit && maxSelections !== Infinity && (
            <div className="px-2 py-1 text-xs text-muted-foreground border-b">
              Maximum {maxSelections} selections allowed
            </div>
          )}
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              const isDisabled = !isSelected && isAtMaxLimit;
              
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    "cursor-pointer",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isDisabled}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {(option.avatar || option.initials) && (
                    <Avatar className="h-8 w-8 mr-3">
                      {option.avatar && <AvatarImage src={option.avatar} alt={option.label} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {option.initials || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  )}
                   <div className="flex-1">
                     <div className="font-medium flex items-center gap-1">
                       <span>{option.label}</span>
                       {option.username && (
                         <span className="text-sm text-muted-foreground/80">@{option.username}</span>
                       )}
                     </div>
                     {option.description && (
                       <div className="text-xs text-foreground/70">{option.description}</div>
                     )}
                   </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

MultiSelect.displayName = "MultiSelect"