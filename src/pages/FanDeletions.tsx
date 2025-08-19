import { Navigation, useSidebar } from '@/components/Navigation';
import { PendingFanDeletionsManager } from '@/components/PendingFanDeletionsManager';
import { useTranslation } from '@/hooks/useTranslation';

const FanDeletions = () => {
  const { t } = useTranslation();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className={`transition-all duration-300 p-6 ${isCollapsed ? 'ml-16' : 'ml-52'}`}>
        <PendingFanDeletionsManager />
      </main>
    </div>
  );
};

export default FanDeletions;