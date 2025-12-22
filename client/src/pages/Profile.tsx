import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Save, FileText, CheckCircle, RefreshCw, LogIn, LogOut, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CenteredLoader } from "@/components/ui/loader";

interface ProfileData {
  hhConnected: boolean;
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    hhUserId: string | null;
  } | null;
  hhResumes: Array<{
    id: number;
    hhResumeId: string | null;
    title: string | null;
    selected: boolean;
    updatedAt: string;
  }>;
  manualResume: string;
}

async function fetchProfile(userId: string | null): Promise<ProfileData> {
  const url = userId ? `/api/profile?userId=${userId}` : "/api/profile";
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch profile");
  return response.json();
}

async function saveManualResume(userId: string, content: string): Promise<void> {
  const response = await fetch("/api/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content }),
  });
  if (!response.ok) throw new Error("Failed to save resume");
}

async function selectResume(userId: string, resumeId: number): Promise<void> {
  const response = await fetch("/api/hh/resumes/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, resumeId }),
  });
  if (!response.ok) throw new Error("Failed to select resume");
}

async function syncResumes(userId: string): Promise<void> {
  const response = await fetch("/api/hh/resumes/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) throw new Error("Failed to sync resumes");
}

export default function Profile() {
  const queryClient = useQueryClient();
  const [resumeText, setResumeText] = useState("");
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("userId"));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    
    if (urlUserId) {
      localStorage.setItem("userId", urlUserId);
      setUserId(urlUserId);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId),
  });

  useEffect(() => {
    if (profile) {
      setResumeText(profile.manualResume || "");
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("User ID required");
      return saveManualResume(userId, resumeText);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const selectMutation = useMutation({
    mutationFn: (resumeId: number) => selectResume(userId!, resumeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      // Invalidate profession so vacancies can be updated
      queryClient.invalidateQueries({ queryKey: ["profession", userId] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncResumes(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      // Invalidate profession so vacancies can be updated with new resume data
      queryClient.invalidateQueries({ queryKey: ["profession", userId] });
    },
  });

  const handleSave = () => {
    if (!userId) {
      return;
    }
    saveMutation.mutate();
  };

  const handleLogin = () => {
    window.location.href = "/auth/hh/start";
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    setUserId(null);
    setResumeText("");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.clear();
  };

  const handleSelectResume = (resumeId: number) => {
    if (userId) {
      selectMutation.mutate(resumeId);
    }
  };

  const handleSync = () => {
    if (userId) {
      syncMutation.mutate();
    }
  };

  if (profileLoading) {
    return (
      <div className="relative h-full">
        <CenteredLoader message="Загрузка профиля..." />
      </div>
    );
  }

  const hhConnected = profile?.hhConnected ?? false;
  const user = profile?.user;
  const hhResumes = profile?.hhResumes ?? [];

  return (
    <div className="p-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-100 rounded-2xl">
          <User className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Профиль</h1>
          <p className="text-gray-500 text-sm">Управление аккаунтом и резюме</p>
        </div>
      </div>

      <Card className="rounded-2xl border-0 shadow-lg mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <img 
              src="https://hh.ru/favicon.ico" 
              alt="HH.ru" 
              className="w-5 h-5" 
            />
            Подключение к hh.ru
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hhConnected && user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-600"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  variant="outline"
                  className="flex-1 rounded-full"
                  data-testid="button-sync-resumes"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? "Синхронизация..." : "Обновить резюме"}
                </Button>
              </div>

              {hhResumes.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Ваши резюме с hh.ru:</p>
                  {hhResumes.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => handleSelectResume(r.id)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        r.selected
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-200 hover:border-indigo-300"
                      }`}
                      data-testid={`resume-item-${r.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {r.selected && <Check className="w-4 h-4 text-indigo-600" />}
                        <span className={r.selected ? "font-medium text-indigo-900" : "text-gray-700"}>
                          {r.title || "Без названия"}
                        </span>
                      </div>
                      {r.hhResumeId && (
                        <a 
                          href={`https://hh.ru/resume/${r.hhResumeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-500 flex items-center gap-1 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Открыть на hh.ru <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Резюме не найдены. Нажмите "Обновить резюме" для загрузки.
                </p>
              )}

              <div className="p-3 bg-green-50 rounded-xl">
                <p className="text-sm text-green-700">
                  Ваш аккаунт hh.ru подключен. Теперь при свайпе вправо отклики будут отправляться напрямую на hh.ru!
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <img 
                  src="https://hh.ru/favicon.ico" 
                  alt="HH.ru" 
                  className="w-8 h-8 opacity-50" 
                />
              </div>
              <p className="text-gray-600 mb-4">
                Подключите аккаунт hh.ru для отправки реальных откликов на вакансии
              </p>
              <Button
                onClick={handleLogin}
                className="rounded-full px-8 bg-red-600 hover:bg-red-700"
                data-testid="button-login-hh"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Войти через hh.ru
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-indigo-600" />
            Ручное резюме
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            {hhConnected 
              ? "Используется как дополнение к резюме с hh.ru для генерации писем"
              : "Используется для генерации сопроводительных писем в демо-режиме"
            }
          </p>
          
          {!userId && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">
              Войдите через hh.ru, чтобы сохранить своё ручное резюме
            </p>
          )}
          
          <Textarea
            placeholder="Введите информацию о себе, опыте работы, навыках..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="min-h-[200px] resize-none rounded-xl border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
            data-testid="input-resume"
            disabled={!userId}
          />
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {resumeText.length} символов
            </p>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !userId}
              className="rounded-full px-6 bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-save-resume"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Сохранено
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hhConnected && (
        <div className="mt-6 p-4 bg-amber-50 rounded-2xl">
          <p className="text-sm text-amber-700">
            <strong>Демо-режим:</strong> Сейчас отклики сохраняются только локально. Подключите hh.ru для отправки реальных откликов.
          </p>
        </div>
      )}
    </div>
  );
}
