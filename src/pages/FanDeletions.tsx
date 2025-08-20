import { Navigation, useSidebar } from '@/components/Navigation';
import { PendingFanDeletionsManager } from '@/components/PendingFanDeletionsManager';
import { useTranslation } from '@/hooks/useTranslation';

const FanDeletions = () => {
  const { t } = useTranslation();
  const { isCollapsed, isNarrowScreen } = useSidebar();

  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className={`flex-1 transition-all duration-300 p-6 overflow-x-auto ${isNarrowScreen && !isCollapsed ? 'ml-0' : ''}`}>
        <div className="min-w-[600px]">
          <PendingFanDeletionsManager />
        </div>
      </main>
    </div>
  );
};

export default FanDeletions;