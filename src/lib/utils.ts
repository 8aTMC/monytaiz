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
