import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSubscriptionDuration(days: number): string {
  if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    
    if (months === 0) {
      return `${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    } else if (remainingDays === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    } else {
      return `${months} month${months !== 1 ? 's' : ''} ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
    }
  } else {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    const months = Math.floor(remainingDays / 30);
    
    if (months === 0) {
      return `${years} year${years !== 1 ? 's' : ''}`;
    } else {
      return `${years} year${years !== 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
    }
  }
}

export function formatPercentageWithPeriodical(percentage: number): string {
  // Check for periodical decimals by examining common fractions that result in repeating decimals
  const rounded = Math.round(percentage * 100) / 100; // Round to 2 decimal places for comparison
  const formatted = rounded.toFixed(2);
  
  // Detect common periodical patterns (like 11.111... from 1/9, 33.333... from 1/3, etc.)
  const decimal = rounded % 1;
  const isRepeating = Math.abs(decimal * 9 - Math.round(decimal * 9)) < 0.001 || 
                      Math.abs(decimal * 3 - Math.round(decimal * 3)) < 0.001 ||
                      Math.abs(decimal * 99 - Math.round(decimal * 99)) < 0.001;
  
  if (isRepeating) {
    // For numbers like 11.111..., show 11.1̄1%
    const parts = formatted.split('.');
    if (parts[1]) {
      const lastDigit = parts[1][1];
      const firstDigit = parts[1][0];
      if (lastDigit && firstDigit === lastDigit) {
        return `${parts[0]}.${firstDigit}̄${lastDigit}%`;
      }
    }
  }
  
  return `${formatted}%`;
}
