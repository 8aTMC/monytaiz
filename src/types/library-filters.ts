export interface LibraryFilterState {
  collaborators: string[];
  tags: string[];
  mentions: string[];
  priceRange: [number, number]; // in cents
}

export interface UseLibraryDataProps {
  selectedCategory: string;
  searchQuery: string;
  selectedFilter: string;
  sortBy: string;
  advancedFilters?: LibraryFilterState;
}