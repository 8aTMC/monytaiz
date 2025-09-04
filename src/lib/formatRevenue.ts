/**
 * Format revenue from cents to currency display
 * @param cents - Revenue in cents
 * @returns Formatted currency string (e.g., "$5.99", "$1.2K", "$0")
 */
export const formatRevenue = (cents: number | null | undefined): string => {
  if (!cents || cents <= 0) {
    return "$0";
  }
  
  const dollars = cents / 100;
  
  // For amounts over $10,000, show in K format
  if (dollars >= 10000) {
    const thousands = dollars / 1000;
    return `$${thousands.toFixed(1)}K`;
  }
  
  // For amounts over $1,000, show rounded K format
  if (dollars >= 1000) {
    const thousands = Math.round(dollars / 100) / 10;
    return `$${thousands}K`;
  }
  
  // For regular amounts, show with appropriate decimal places
  if (dollars >= 100) {
    return `$${Math.round(dollars)}`;
  }
  
  return `$${dollars.toFixed(2)}`;
};