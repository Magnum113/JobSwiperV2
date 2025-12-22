import { Briefcase, History, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export type TabType = "vacancies" | "history" | "profile";

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

async function fetchPendingCount(): Promise<number> {
  const userId = localStorage.getItem("userId");
  if (!userId) return 0;
  const response = await fetch(`/api/applications/pending-count?userId=${userId}`);
  if (!response.ok) return 0;
  const data = await response.json();
  return data.count || 0;
}

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "vacancies", label: "Вакансии", icon: <Briefcase className="w-5 h-5" /> },
  { id: "history", label: "История", icon: <History className="w-5 h-5" /> },
  { id: "profile", label: "Профиль", icon: <User className="w-5 h-5" /> },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  
  return (
    <span 
      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-[#22C55E] rounded-full shadow-sm"
      style={{ lineHeight: 1 }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pendingApplicationsCount"],
    queryFn: fetchPendingCount,
    refetchInterval: 2000,
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              activeTab === tab.id
                ? "text-indigo-600"
                : "text-gray-400 hover:text-gray-600"
            )}
            data-testid={`tab-${tab.id}`}
          >
            <div className="relative">
              {tab.icon}
              {tab.id === "history" && <Badge count={pendingCount} />}
            </div>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
