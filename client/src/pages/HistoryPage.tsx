import { useQuery } from "@tanstack/react-query";
import { History, Building2, Calendar, FileText, ChevronDown, ChevronUp, CheckCircle, Loader2, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { CenteredLoader } from "@/components/ui/loader";
import type { Application } from "@shared/schema";

async function fetchApplications(userId: string): Promise<Application[]> {
  const response = await fetch(`/api/applications?userId=${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch applications");
  }
  return response.json();
}

const STATUS_TRANSLATIONS: Record<string, string> = {
  "pending": "В ожидании",
  "success": "Отправлено",
  "submitted": "Отправлено",
  "failed": "Ошибка",
  "demo": "Демо",
  "queued": "В очереди",
};

function getStatusLabel(status: string): string {
  return STATUS_TRANSLATIONS[status.toLowerCase()] || status;
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "success" || s === "submitted") return "bg-green-100 text-green-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  if (s === "pending" || s === "queued") return "bg-yellow-100 text-yellow-700";
  if (s === "demo") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function ApplicationCard({ application }: { application: Application }) {
  const [expanded, setExpanded] = useState(false);
  
  const formattedDate = new Date(application.appliedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isGenerating = !application.coverLetter;
  const statusLabel = getStatusLabel(application.status);
  const statusColor = getStatusColor(application.status);

  return (
    <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg leading-tight" data-testid={`text-history-title-${application.id}`}>
                {application.jobTitle}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-indigo-600">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">{application.company}</span>
              </div>
            </div>
            <Badge className={`${statusColor} rounded-full px-3`}>
              <CheckCircle className="w-3 h-3 mr-1" />
              {statusLabel}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors text-sm font-medium"
            data-testid={`button-expand-${application.id}`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Генерируется...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Сопроводительное письмо
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </>
            )}
          </button>
        </div>
        
        {expanded && !isGenerating && (
          <div className="bg-gray-50 p-5 border-t border-gray-100">
            <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed" data-testid={`text-cover-letter-${application.id}`}>
              {application.coverLetter}
            </p>
          </div>
        )}
        
        {expanded && isGenerating && (
          <div className="bg-gray-50 p-5 border-t border-gray-100">
            <div className="flex items-center gap-3 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm">Генерируется сопроводительное письмо...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoryPage() {
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("userId"));
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    if (urlUserId) {
      localStorage.setItem("userId", urlUserId);
      setUserId(urlUserId);
    }
  }, []);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["applications", userId],
    queryFn: () => fetchApplications(userId!),
    refetchInterval: 3000,
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="p-4 bg-gray-100 rounded-full mb-4">
          <LogIn className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Требуется авторизация</h3>
        <p className="text-gray-500 max-w-xs mb-6">
          Для просмотра истории откликов необходимо авторизоваться через hh.ru
        </p>
        <a
          href="/auth/hh/start"
          className="flex items-center justify-center gap-3 py-3 px-6 bg-[#D6001C] hover:bg-[#B8001A] text-white font-semibold rounded-xl shadow-lg transition-all"
          data-testid="button-hh-auth-history"
        >
          <img src="/hh-logo.svg" alt="hh.ru" className="h-5" />
          Авторизоваться
        </a>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="relative h-full">
        <CenteredLoader message="Загрузка истории..." />
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 rounded-2xl">
          <History className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">История</h1>
          <p className="text-gray-500 text-sm">Ваши отклики на вакансии</p>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <History className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Пока нет откликов</h3>
          <p className="text-gray-500 max-w-xs">
            Свайпните вправо на понравившейся вакансии, чтобы откликнуться
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-500 mb-2">
            Всего откликов: {applications.length}
          </div>
          {applications.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </div>
  );
}
