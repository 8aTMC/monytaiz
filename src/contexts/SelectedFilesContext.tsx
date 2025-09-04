import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MediaFile {
  id: string;
  file: File;
  metadata?: {
    mentions?: string[];
    tags?: string[];
    folders?: string[];
    description?: string;
    suggestedPrice?: number | null;
  };
}

interface SelectedFilesContextType {
  files: MediaFile[];
  previewFile: MediaFile | null;
  previewIndex: number;
  isPreviewOpen: boolean;
  
  // Core methods
  setFiles: (files: MediaFile[]) => void;
  openPreview: (index: number) => void;
  closePreview: () => void;
  
  // Navigation methods
  goToNext: () => void;
  goToPrevious: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  
  // Computed values
  fileCount: number;
}

const SelectedFilesContext = createContext<SelectedFilesContextType | null>(null);

interface SelectedFilesProviderProps {
  children: ReactNode;
}

export const SelectedFilesProvider = ({ children }: SelectedFilesProviderProps) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Computed values
  const fileCount = files.length;
  const previewFile = previewIndex >= 0 && previewIndex < files.length ? files[previewIndex] : null;
  const canGoNext = previewIndex < fileCount - 1;
  const canGoPrevious = previewIndex > 0;

  // Core methods
  const openPreview = useCallback((index: number) => {
    if (index >= 0 && index < files.length) {
      setPreviewIndex(index);
      setIsPreviewOpen(true);
    }
  }, [files.length]);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewIndex(-1);
  }, []);

  // Navigation methods
  const goToNext = useCallback(() => {
    if (canGoNext) {
      setPreviewIndex(prev => prev + 1);
    }
  }, [canGoNext]);

  const goToPrevious = useCallback(() => {
    if (canGoPrevious) {
      setPreviewIndex(prev => prev - 1);
    }
  }, [canGoPrevious]);

  const value: SelectedFilesContextType = {
    files,
    previewFile,
    previewIndex,
    isPreviewOpen,
    setFiles,
    openPreview,
    closePreview,
    goToNext,
    goToPrevious,
    canGoNext,
    canGoPrevious,
    fileCount,
  };

  return (
    <SelectedFilesContext.Provider value={value}>
      {children}
    </SelectedFilesContext.Provider>
  );
};

export const useSelectedFiles = (): SelectedFilesContextType => {
  const context = useContext(SelectedFilesContext);
  if (!context) {
    throw new Error('useSelectedFiles must be used within a SelectedFilesProvider');
  }
  return context;
};