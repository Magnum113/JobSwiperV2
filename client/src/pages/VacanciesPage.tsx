import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { VacancyCard, VacancyCardRef } from "@/components/VacancyCard";
import { VacancyFullView } from "@/components/VacancyFullView";
import { AnimatePresence } from "framer-motion";
import { X, Heart, RotateCcw, Briefcase, Filter, Search, ChevronDown, AlertCircle, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CenteredLoader } from "@/components/ui/loader";
import type { HHJob, HHJobsResponse, Resume, CompatibilityResult } from "@shared/schema";

type AreaOption = { value: string; label: string };

const STATIC_AREAS: AreaOption[] = [
  { value: "1", label: "Москва" },
  { value: "2", label: "Санкт-Петербург" },
  { value: "113", label: "Вся Россия" },
  { value: "1001", label: "Екатеринбург" },
  { value: "4", label: "Новосибирск" },
  { value: "3", label: "Казань" },
];

interface ProfessionResponse {
  profession: string | null;
  resumeTitle?: string;
}

interface AuthStatus {
  authenticated: boolean;
  user?: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface HHApplyResult {
  success: boolean;
  error?: string;
  application?: {
    id: number;
    status: string;
    errorReason?: string;
  };
}

interface HHFilters {
  text: string;
  areas: string[];
  employment: string;
  schedule: string;
  experience: string;
}

async function fetchHHJobs(filters: HHFilters, batch: number, userId?: string | null): Promise<HHJobsResponse> {
  const params = new URLSearchParams();
  if (filters.text) params.append("text", filters.text);
  if (filters.areas && filters.areas.length > 0) {
    filters.areas.forEach((areaId) => params.append("area", areaId));
  }
  if (filters.employment && filters.employment !== "all") params.append("employment", filters.employment);
  if (filters.schedule && filters.schedule !== "all") params.append("schedule", filters.schedule);
  if (filters.experience && filters.experience !== "all") params.append("experience", filters.experience);
  params.append("batch", String(batch));
  if (userId) params.append("userId", userId);
  
  const response = await fetch(`/api/hh/jobs?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch jobs");
  }
  return response.json();
}

async function recordSwipe(userId: string, vacancyId: string, direction: "left" | "right"): Promise<void> {
  const response = await fetch("/api/swipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, vacancyId, direction }),
  });
  if (!response.ok) {
    console.error("Failed to record swipe");
  }
}

async function fetchResume(): Promise<Resume | { content: string }> {
  const response = await fetch("/api/resume");
  if (!response.ok) {
    throw new Error("Failed to fetch resume");
  }
  return response.json();
}


async function applyAsync(data: {
  userId: string | null;
  vacancyId: string;
  vacancyData: {
    title: string;
    company: string;
    salary: string;
    description: string;
    tags: string[];
  };
  resumeText: string;
  isDemo: boolean;
}): Promise<{ status: string; applicationId: number }> {
  const response = await fetch("/api/apply/async", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to queue application");
  }
  return response.json();
}

async function fetchAuthStatus(userId: string | null): Promise<AuthStatus> {
  if (!userId) return { authenticated: false };
  const response = await fetch(`/api/auth/status?userId=${userId}`);
  if (!response.ok) return { authenticated: false };
  return response.json();
}

async function fetchProfession(userId: string | null): Promise<ProfessionResponse> {
  if (!userId) return { profession: null };
  const response = await fetch(`/api/user/profession?userId=${userId}`);
  if (!response.ok) return { profession: null };
  return response.json();
}

async function fetchCompatibility(userId: string, vacancies: HHJob[]): Promise<CompatibilityResult[]> {
  if (!userId || vacancies.length === 0) return [];
  
  const response = await fetch("/api/ai-compatibility/calc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      vacancies: vacancies.map(v => ({
        id: v.id,
        title: v.title,
        company: v.company,
        salary: v.salary,
        description: v.descriptionFull || v.description,
        tags: v.tags,
      })),
    }),
  });
  
  if (!response.ok) return [];
  return response.json();
}

const EMPLOYMENT_TYPES = [
  { value: "all", label: "Любой тип" },
  { value: "full", label: "Полная занятость" },
  { value: "part", label: "Частичная занятость" },
  { value: "project", label: "Проектная работа" },
];

const SCHEDULES = [
  { value: "all", label: "Любой график" },
  { value: "fullDay", label: "Полный день" },
  { value: "remote", label: "Удалённая работа" },
  { value: "flexible", label: "Гибкий график" },
  { value: "shift", label: "Сменный график" },
];

const EXPERIENCE = [
  { value: "all", label: "Любой опыт" },
  { value: "noExperience", label: "Без опыта" },
  { value: "between1And3", label: "1-3 года" },
  { value: "between3And6", label: "3-6 лет" },
  { value: "moreThan6", label: "Более 6 лет" },
];

export default function VacanciesPage() {
  const queryClient = useQueryClient();
  const [isSwiping, setIsSwiping] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [expandedVacancy, setExpandedVacancy] = useState<HHJob | null>(null);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  
  const [jobs, setJobs] = useState<HHJob[]>([]);
  const [batch, setBatch] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [compatibilityMap, setCompatibilityMap] = useState<Map<string, CompatibilityResult>>(new Map());
  const searchTokenRef = useRef(0);
  
  const cardRef = useRef<VacancyCardRef>(null);
  
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem("userId"));
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get("userId");
    if (urlUserId) {
      localStorage.setItem("userId", urlUserId);
      setUserId(urlUserId);
    }
  }, []);
  
  const { data: authStatus, isLoading: isAuthLoading } = useQuery({
    queryKey: ["authStatus", userId],
    queryFn: () => fetchAuthStatus(userId),
    enabled: !!userId,
  });

  // Fetch profession for personalized job search
  const { data: professionData } = useQuery({
    queryKey: ["profession", userId],
    queryFn: () => fetchProfession(userId),
    enabled: !!userId && authStatus?.authenticated,
  });
  
  const [filters, setFilters] = useState<HHFilters>({
    text: "",
    areas: ["1"],
    employment: "all",
    schedule: "all",
    experience: "all",
  });
  
  const [allAreas, setAllAreas] = useState<AreaOption[]>(STATIC_AREAS);
  const [areaSearch, setAreaSearch] = useState("");
  
  const [appliedFilters, setAppliedFilters] = useState<HHFilters | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const { data: resume } = useQuery({
    queryKey: ["resume"],
    queryFn: fetchResume,
  });

  const executeSearch = useCallback(async (searchFilters: HHFilters) => {
    setIsSearching(true);
    const currentToken = ++searchTokenRef.current;
    
    try {
      const currentUserId = localStorage.getItem("userId");
      const response = await fetchHHJobs(searchFilters, 1, currentUserId);
      
      // Check if this search is still the active one
      if (currentToken !== searchTokenRef.current) return;
      
      setJobs(response.jobs);
      setHasMore(response.hasMore);
      setBatch(1);
      setCurrentIndex(0);
      setHistory([]);
      setSwipedIds(new Set());
      setAppliedFilters(searchFilters);
      setCompatibilityMap(new Map()); // Clear old compatibility data
      
      // Fetch compatibility in background (first 5 jobs)
      if (currentUserId && response.jobs.length > 0) {
        const jobIdsToFetch = response.jobs.slice(0, 5).map(j => j.id);
        fetchCompatibility(currentUserId, response.jobs.slice(0, 5))
          .then(results => {
            // Verify this is still the active search before updating state
            if (currentToken !== searchTokenRef.current) return;
            
            setCompatibilityMap(prev => {
              const newMap = new Map(prev);
              results.forEach(r => {
                if (jobIdsToFetch.includes(r.vacancyId)) {
                  newMap.set(r.vacancyId, r);
                }
              });
              return newMap;
            });
          })
          .catch(err => console.error("Failed to fetch compatibility:", err));
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      if (currentToken === searchTokenRef.current) {
        setIsSearching(false);
      }
    }
  }, []);
  
  // Load all areas from HH API once
  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await fetch("/api/hh/areas");
        if (!res.ok) return;
        const data: { id: string; name: string }[] = await res.json();

        const dynamicAreas: AreaOption[] = data.map(a => ({
          value: String(a.id),
          label: a.name,
        }));

        const merged = new Map<string, AreaOption>();
        [...STATIC_AREAS, ...dynamicAreas].forEach(a => {
          if (!merged.has(a.value)) merged.set(a.value, a);
        });

        setAllAreas(Array.from(merged.values()));
      } catch (e) {
        console.error("Failed to load HH areas", e);
      }
    }

    loadAreas();
  }, []);

  const updateAreasAndSearch = useCallback((value: string, checked: boolean) => {
    setFilters(prev => {
      const set = new Set(prev.areas);
      if (checked) {
        set.add(value);
      } else {
        set.delete(value);
      }
      const next = Array.from(set);
      const newFilters = { ...prev, areas: next.length ? next : ["1"] };
      
      // Auto-trigger search with new areas
      setTimeout(() => executeSearch(newFilters), 0);
      
      return newFilters;
    });
  }, [executeSearch]);

  // Optimize: limit displayed areas to prevent rendering 1000+ items
  const displayedAreas = useMemo(() => {
    const searchLower = areaSearch.toLowerCase().trim();
    
    // If user is searching, filter and show matches (limited to 100)
    if (searchLower) {
      return allAreas
        .filter(a => a.label.toLowerCase().includes(searchLower))
        .slice(0, 100);
    }
    
    // No search - show selected areas first, then popular regions (max 30 total)
    const selectedSet = new Set(filters.areas);
    const selected = allAreas.filter(a => selectedSet.has(a.value));
    const unselected = allAreas.filter(a => !selectedSet.has(a.value)).slice(0, 30 - selected.length);
    
    return [...selected, ...unselected];
  }, [allAreas, areaSearch, filters.areas]);

  // Track the last used profession to detect changes
  const lastProfessionRef = useRef<string | null>(null);

  // Load personalized vacancies based on profession after auth
  useEffect(() => {
    if (!initialLoadDone && authStatus?.authenticated && professionData?.profession) {
      const initialFilters: HHFilters = {
        text: professionData.profession,
        areas: ["1"],
        employment: "all",
        schedule: "all",
        experience: "all",
      };
      setFilters(initialFilters);
      executeSearch(initialFilters);
      setInitialLoadDone(true);
      lastProfessionRef.current = professionData.profession;
    }
  }, [initialLoadDone, authStatus?.authenticated, professionData?.profession, executeSearch]);

  // Reload vacancies when profession changes (e.g., after resume sync or resume selection)
  useEffect(() => {
    if (initialLoadDone && professionData?.profession && lastProfessionRef.current !== professionData.profession) {
      const newFilters: HHFilters = {
        text: professionData.profession,
        areas: filters.areas,
        employment: filters.employment,
        schedule: filters.schedule,
        experience: filters.experience,
      };
      setFilters(newFilters);
      executeSearch(newFilters);
      lastProfessionRef.current = professionData.profession;
    }
  }, [initialLoadDone, professionData?.profession, filters.areas, filters.employment, filters.schedule, filters.experience, executeSearch]);

  const handleSearch = useCallback(() => {
    executeSearch(filters);
  }, [executeSearch, filters]);

  const currentJobs = jobs.slice(currentIndex).filter(job => !swipedIds.has(job.id));

  const lastSwipeRef = useRef<{ jobId: string; time: number } | null>(null);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (isSwiping) {
      console.log("SWIPE BLOCKED in parent - isSwiping=true");
      return;
    }
    if (currentJobs.length === 0) {
      console.log("SWIPE BLOCKED in parent - no jobs");
      return;
    }
    
    const currentJob = currentJobs[0];
    const now = Date.now();
    
    if (lastSwipeRef.current && 
        lastSwipeRef.current.jobId === currentJob.id && 
        now - lastSwipeRef.current.time < 500) {
      console.log("SWIPE BLOCKED in parent - duplicate for same job", currentJob.id);
      return;
    }
    
    lastSwipeRef.current = { jobId: currentJob.id, time: now };
    setIsSwiping(true);
    
    console.log("SWIPE HANDLED", direction, currentJob.id);

    if (direction === "right") {
      const isAuthenticated = authStatus?.authenticated && userId;
      const resumeContent = resume?.content || "";
      
      // Fire async request - don't wait for result
      applyAsync({
        userId: isAuthenticated ? userId : null,
        vacancyId: currentJob.id,
        vacancyData: {
          title: currentJob.title,
          company: currentJob.company,
          salary: currentJob.salary,
          description: currentJob.descriptionFull || currentJob.description || "",
          tags: currentJob.tags || [],
        },
        resumeText: resumeContent,
        isDemo: !isAuthenticated,
      }).then(() => {
        // Refresh applications list and pending count
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        queryClient.invalidateQueries({ queryKey: ["pendingApplicationsCount"] });
      }).catch((err) => {
        console.error("Failed to queue application:", err);
        queryClient.invalidateQueries({ queryKey: ["pendingApplicationsCount"] });
      });
    }

    // Record swipe to backend (fire and forget)
    if (userId) {
      recordSwipe(userId, currentJob.id, direction).catch((err) => {
        console.error("Failed to record swipe:", err);
      });
    }

    // Immediately update UI - no blocking
    setSwipedIds(prev => {
      const next = new Set(Array.from(prev));
      next.add(currentJob.id);
      return next;
    });
    setHistory(prev => [...prev, currentIndex]);
    setCurrentIndex(prev => prev + 1);
    setExpandedVacancy(null);

    // Fetch compatibility for the next job in queue (job at position 5)
    const nextJobIndex = currentIndex + 5;
    const nextJob = jobs[nextJobIndex];
    if (nextJob && userId && !compatibilityMap.has(nextJob.id)) {
      const currentToken = searchTokenRef.current;
      fetchCompatibility(userId, [nextJob])
        .then(results => {
          if (currentToken !== searchTokenRef.current) return;
          setCompatibilityMap(prev => {
            const newMap = new Map(prev);
            results.forEach(r => newMap.set(r.vacancyId, r));
            return newMap;
          });
        })
        .catch(err => console.error("Failed to fetch next compatibility:", err));
    }

    setTimeout(() => setIsSwiping(false), 300);
  }, [isSwiping, currentJobs, currentIndex, resume, queryClient, authStatus, userId, jobs, compatibilityMap]);

  const loadMoreJobs = useCallback(async () => {
    if (!hasMore || isLoadingMore || !appliedFilters) return;
    
    setIsLoadingMore(true);
    try {
      const nextBatch = batch + 1;
      const currentUserId = localStorage.getItem("userId");
      const response = await fetchHHJobs(appliedFilters, nextBatch, currentUserId);
      
      setJobs(prev => [...prev, ...response.jobs]);
      setBatch(nextBatch);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error("Failed to load more jobs:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [batch, appliedFilters, hasMore, isLoadingMore]);

  const triggerSwipe = useCallback(async (direction: "left" | "right") => {
    if (isSwiping || currentJobs.length === 0 || expandedVacancy) return;
    
    if (cardRef.current) {
      await cardRef.current.swipe(direction);
    }
  }, [isSwiping, currentJobs.length, expandedVacancy]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || expandedVacancy || isSwiping) return;
    
    const previousIndex = history[history.length - 1];
    const previousJob = jobs[previousIndex];
    
    if (previousJob) {
      setSwipedIds(prev => {
        const next = new Set(prev);
        next.delete(previousJob.id);
        return next;
      });
    }
    
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(previousIndex);
  }, [history, expandedVacancy, isSwiping, jobs]);

  const handleReset = useCallback(() => {
    if (appliedFilters) {
      executeSearch(appliedFilters);
    }
  }, [appliedFilters, executeSearch]);

  const updateFilter = useCallback((key: keyof HHFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    const clearedFilters: HHFilters = {
      text: "",
      areas: ["1"],
      employment: "all",
      schedule: "all",
      experience: "all",
    };
    setFilters(clearedFilters);
    executeSearch(clearedFilters);
  }, [executeSearch]);

  const handleApplyFromFullView = useCallback(async () => {
    if (!expandedVacancy || isSwiping) return;
    setExpandedVacancy(null);
    
    setTimeout(() => {
      triggerSwipe("right");
    }, 100);
  }, [expandedVacancy, isSwiping, triggerSwipe]);

  const hasActiveFilters = filters.text !== "" || 
    filters.employment !== "all" || 
    filters.schedule !== "all" || 
    filters.experience !== "all";

  const showLoadMore = currentJobs.length === 0 && hasMore && jobs.length > 0;
  const showNoMoreJobs = currentJobs.length === 0 && !hasMore && jobs.length > 0;

  // Check if user needs to authenticate
  const requiresAuth = !userId || (!isAuthLoading && !authStatus?.authenticated);

  // Loading state while checking auth
  if (userId && isAuthLoading) {
    return (
      <div className="relative h-full">
        <CenteredLoader message="Проверяем авторизацию..." />
      </div>
    );
  }

  // Auth screen for new/unauthenticated users
  if (requiresAuth) {
    return (
      <div className="flex flex-col h-full relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-100/40 blur-3xl" />
          <div className="absolute top-[30%] -right-[20%] w-[50%] h-[70%] rounded-full bg-gradient-to-br from-purple-100/30 to-pink-100/30 blur-3xl" />
          <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-indigo-100/20 to-blue-100/20 blur-3xl" />
        </div>
        <div className="flex-1 flex items-center justify-center relative z-10 px-4">
          <div className="max-w-md w-full">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-900/10 p-8 text-center border border-white/50">
              <div className="mb-6">
                <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 w-fit mx-auto mb-4">
                  <Briefcase className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">JobSwiper</h1>
                <p className="text-gray-500">Умный поиск работы в стиле Tinder</p>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Heart className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Свайпай вакансии</p>
                    <p className="text-sm text-gray-500">Влево — пропустить, вправо — откликнуться</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Search className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Персональный подбор</p>
                    <p className="text-sm text-gray-500">Вакансии по вашей специальности из резюме</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left p-3 bg-gray-50 rounded-xl">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Briefcase className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Отклики от нейросети</p>
                    <p className="text-sm text-gray-500">ИИ на основе вашего резюме генерирует эффективное сопроводительное письмо</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Чтобы начать пользоваться сервисом, авторизуйтесь через hh.ru
                </p>
                
                <a
                  href="/auth/hh/start"
                  className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-[#D6001C] hover:bg-[#B8001A] text-white font-semibold rounded-xl shadow-lg shadow-red-500/25 transition-all hover:shadow-xl hover:shadow-red-500/30"
                  data-testid="button-hh-auth"
                >
                  <img src="/hh-logo.svg" alt="hh.ru" className="h-6" />
                  Авторизоваться
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSearching && jobs.length === 0) {
    return (
      <div className="relative h-full">
        <CenteredLoader message="Загрузка вакансий с HH.ru..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-blue-100/40 to-indigo-100/40 blur-3xl" />
        <div className="absolute top-[30%] -right-[20%] w-[50%] h-[70%] rounded-full bg-gradient-to-br from-purple-100/30 to-pink-100/30 blur-3xl" />
        <div className="absolute -bottom-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-gradient-to-br from-indigo-100/20 to-blue-100/20 blur-3xl" />
      </div>
      <header className="relative z-20 px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">JobSwiper</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">{jobs.length} вакансий</p>
                {authStatus?.authenticated ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    hh.ru
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">демо</span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant={isFilterOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`rounded-full gap-2 transition-all ${isFilterOpen ? "bg-indigo-600 shadow-lg shadow-indigo-500/30" : "bg-white shadow-md"} ${hasActiveFilters && !isFilterOpen ? "border-indigo-300 bg-indigo-50" : ""}`}
            data-testid="button-toggle-filter"
          >
            <Filter className="w-4 h-4" />
            Фильтр
            {hasActiveFilters && !isFilterOpen && (
              <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
            )}
          </Button>
        </div>
      </header>
      {isFilterOpen && (
        <div className="relative z-20 px-4 pb-3 shrink-0">
          <div className="max-w-lg mx-auto bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-900/5 p-4 space-y-3 border border-white/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Поиск вакансий (например: маркетинг, разработчик)..."
                value={filters.text}
                onChange={(e) => updateFilter("text", e.target.value)}
                className="pl-9 rounded-xl border-gray-200/80 bg-white/80 shadow-sm focus:bg-white h-11"
                data-testid="input-filter-text"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Регион</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between rounded-xl border-gray-200/80 h-11 text-sm bg-white shadow-sm hover:shadow-md transition-shadow"
                      data-testid="select-area"
                    >
                      <span className="truncate">
                        {filters.areas.length === 0
                          ? "Выберите регионы"
                          : filters.areas.length === 1
                            ? allAreas.find(a => a.value === filters.areas[0])?.label ?? "Выбран 1 регион"
                            : `Выбрано регионов: ${filters.areas.length}`}
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 bg-white border border-gray-100 shadow-xl rounded-2xl">
                    <Input
                      placeholder="Найти регион..."
                      value={areaSearch}
                      onChange={(e) => setAreaSearch(e.target.value)}
                      className="mb-2 h-9 text-sm"
                    />
                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      {displayedAreas.map(area => {
                        const checked = filters.areas.includes(area.value);
                        return (
                          <label
                            key={area.value}
                            className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-gray-50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => updateAreasAndSearch(area.value, Boolean(v))}
                            />
                            <span className="truncate">{area.label}</span>
                          </label>
                        );
                      })}
                      {!areaSearch && allAreas.length > 30 && (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Введите название для поиска среди {allAreas.length} регионов
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {filters.areas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filters.areas.slice(0, 5).map(areaId => {
                      const area = allAreas.find(a => a.value === areaId);
                      return (
                        <span
                          key={areaId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs"
                        >
                          {area?.label || areaId}
                          <button
                            type="button"
                            onClick={() => updateAreasAndSearch(areaId, false)}
                            className="hover:bg-indigo-100 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {filters.areas.length > 5 && (
                      <span className="text-xs text-gray-500 px-2 py-0.5">
                        +{filters.areas.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Занятость</label>
                <Select value={filters.employment} onValueChange={(v) => updateFilter("employment", v)}>
                  <SelectTrigger 
                    className="rounded-xl border-gray-200/80 h-11 text-sm bg-white shadow-sm hover:shadow-md transition-shadow" 
                    data-testid="select-employment"
                  >
                    <SelectValue placeholder="Любой тип" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl">
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">График</label>
                <Select value={filters.schedule} onValueChange={(v) => updateFilter("schedule", v)}>
                  <SelectTrigger 
                    className="rounded-xl border-gray-200/80 h-11 text-sm bg-white shadow-sm hover:shadow-md transition-shadow" 
                    data-testid="select-schedule"
                  >
                    <SelectValue placeholder="Любой график" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl">
                    {SCHEDULES.map((schedule) => (
                      <SelectItem key={schedule.value} value={schedule.value}>{schedule.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block uppercase tracking-wide">Опыт</label>
                <Select value={filters.experience} onValueChange={(v) => updateFilter("experience", v)}>
                  <SelectTrigger 
                    className="rounded-xl border-gray-200/80 h-11 text-sm bg-white shadow-sm hover:shadow-md transition-shadow" 
                    data-testid="select-experience"
                  >
                    <SelectValue placeholder="Любой опыт" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-100 shadow-xl rounded-xl">
                    {EXPERIENCE.map((exp) => (
                      <SelectItem key={exp.value} value={exp.value}>{exp.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex-1 rounded-xl h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25"
                data-testid="button-search"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Поиск...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Поиск
                  </>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="rounded-xl h-11 px-4 text-gray-500 hover:text-gray-700"
                  data-testid="button-clear-filters"
                >
                  Сбросить
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center relative z-10 px-4 pb-36">
        <div className="relative w-full max-w-[400px] h-[480px] flex justify-center">
          <AnimatePresence>
            {currentJobs.map((job, index) => {
               if (index > 1) return null;
               
               const isTop = index === 0;
               
               return (
                 <div
                   key={job.id}
                   className="absolute w-full h-full flex justify-center"
                   style={{ 
                     zIndex: currentJobs.length - index,
                     scale: isTop ? 1 : 0.95,
                     top: isTop ? 0 : 20,
                     opacity: isTop ? 1 : 0.5,
                     transition: "all 0.3s ease-in-out"
                   }}
                 >
                    <VacancyCard 
                      ref={isTop ? cardRef : null}
                      job={job} 
                      onSwipe={handleSwipe} 
                      onExpand={() => setExpandedVacancy(job)}
                      active={isTop && !isSwiping && !expandedVacancy}
                      compatibility={compatibilityMap.get(job.id)}
                    />
                 </div>
               );
            })}
          </AnimatePresence>
          
          {showLoadMore && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/60 backdrop-blur-sm rounded-[28px] border-2 border-dashed border-gray-200">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg mb-4">
                  <ChevronDown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Показать ещё вакансии?
                </h3>
                <p className="text-gray-500 mb-6">
                  Вы просмотрели все {jobs.length} загруженных вакансий
                </p>
                <Button 
                  onClick={loadMoreJobs}
                  disabled={isLoadingMore}
                  className="rounded-full px-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  data-testid="button-load-more"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    "Показать ещё вакансии"
                  )}
                </Button>
             </div>
          )}
          
          {showNoMoreJobs && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/60 backdrop-blur-sm rounded-[28px] border-2 border-dashed border-gray-200">
                <div className="bg-gradient-to-br from-gray-400 to-gray-500 p-4 rounded-2xl shadow-lg mb-4">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Больше вакансий нет
                </h3>
                <p className="text-gray-500 mb-6">
                  Вы просмотрели все вакансии по этому запросу
                </p>
                <Button 
                  onClick={handleReset}
                  className="rounded-full px-8"
                  variant="outline"
                  data-testid="button-reset"
                >
                  Начать заново
                </Button>
             </div>
          )}
          
          {currentJobs.length === 0 && jobs.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/60 backdrop-blur-sm rounded-[28px] border-2 border-dashed border-gray-200">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg mb-4">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Ничего не найдено
                </h3>
                <p className="text-gray-500 mb-6">
                  Попробуйте изменить параметры поиска
                </p>
                <Button 
                  onClick={clearFilters} 
                  className="rounded-full px-8"
                  variant="outline"
                  data-testid="button-clear-filters-empty"
                >
                  Сбросить фильтры
                </Button>
             </div>
          )}
        </div>
      </div>
      <div className="fixed bottom-[72px] left-0 right-0 z-40 flex justify-center items-center gap-6 py-3 bg-gradient-to-t from-white via-white/90 to-transparent">
        <Button
          size="icon"
          variant="outline"
          className="h-16 w-16 rounded-full border-2 border-red-100 bg-white text-red-500 shadow-xl shadow-red-500/10 hover:bg-red-50 hover:border-red-200 hover:shadow-2xl hover:shadow-red-500/20 transition-all hover:scale-110 active:scale-95"
          onClick={() => triggerSwipe("left")}
          disabled={currentJobs.length === 0 || isSwiping || !!expandedVacancy}
          data-testid="button-nope"
        >
          <X className="h-7 w-7" strokeWidth={3} />
        </Button>

        <Button
           size="icon"
           variant="secondary"
           className="h-12 w-12 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-lg transition-all hover:scale-105 active:scale-95"
           onClick={handleUndo}
           disabled={history.length === 0 || isSwiping || !!expandedVacancy}
           data-testid="button-undo"
        >
           <RotateCcw className="h-5 w-5" />
        </Button>

        <Button
          size="icon"
          variant="outline"
          className="h-16 w-16 rounded-full border-2 border-green-100 bg-white text-green-500 shadow-xl shadow-green-500/10 hover:bg-green-50 hover:border-green-200 hover:shadow-2xl hover:shadow-green-500/20 transition-all hover:scale-110 active:scale-95"
          onClick={() => triggerSwipe("right")}
          disabled={currentJobs.length === 0 || isSwiping || !!expandedVacancy}
          data-testid="button-like"
        >
          <Heart className="h-7 w-7" strokeWidth={3} fill="currentColor" />
        </Button>
      </div>
      <VacancyFullView 
        vacancy={expandedVacancy}
        onClose={() => setExpandedVacancy(null)}
        onApply={handleApplyFromFullView}
        isApplying={isSwiping}
      />
    </div>
  );
}
