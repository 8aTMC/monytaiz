import { Navigation, useSidebar } from '@/components/Navigation';
import { PendingDeletionsManager } from '@/components/PendingDeletionsManager';
import { useTranslation } from '@/hooks/useTranslation';

const PendingDeletions = () => {
  const { t } = useTranslation();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className={`transition-all duration-300 p-6 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <PendingDeletionsManager />
      </main>
    </div>
  );
};

export default PendingDeletions;