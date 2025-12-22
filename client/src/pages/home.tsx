import { useState, useEffect } from "react";
import { VacancyCard } from "@/components/VacancyCard";
import { AnimatePresence } from "framer-motion";
import { X, Heart, RotateCcw, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job } from "@shared/schema";

async function fetchUnswipedJobs(): Promise<Job[]> {
  const response = await fetch("/api/jobs/unswiped");
  if (!response.ok) {
    throw new Error("Failed to fetch jobs");
  }
  return response.json();
}

async function recordSwipe(jobId: number, direction: "left" | "right") {
  const response = await fetch("/api/swipes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jobId, direction }),
  });
  if (!response.ok) {
    throw new Error("Failed to record swipe");
  }
  return response.json();
}

export default function Home() {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", "unswiped"],
    queryFn: fetchUnswipedJobs,
  });

  const swipeMutation = useMutation({
    mutationFn: ({ jobId, direction }: { jobId: number; direction: "left" | "right" }) =>
      recordSwipe(jobId, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "unswiped"] });
    },
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const currentJobs = jobs.slice(currentIndex);

  const handleSwipe = (direction: "left" | "right") => {
    if (currentJobs.length === 0) return;

    const currentJob = currentJobs[0];
    swipeMutation.mutate({ jobId: currentJob.id, direction });
    setHistory([...history, currentIndex]);
    setCurrentIndex(currentIndex + 1);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previousIndex = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCurrentIndex(previousIndex);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setHistory([]);
    queryClient.invalidateQueries({ queryKey: ["jobs", "unswiped"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center overflow-hidden py-8 relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <header className="mb-8 text-center z-10">
         <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4">
            <Briefcase className="w-6 h-6 text-indigo-600 mr-2" />
            <span className="font-bold text-gray-900 tracking-tight">JobSwipe</span>
         </div>
         <p className="text-gray-500 font-medium">Find your dream job, one swipe at a time</p>
      </header>

      <div className="relative w-full max-w-[400px] h-[550px] flex justify-center z-20 px-4">
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
                    job={job} 
                    onSwipe={handleSwipe} 
                    active={isTop}
                  />
               </div>
             );
          })}
        </AnimatePresence>
        
        {currentJobs.length === 0 && (
           <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/50 rounded-[24px] border-2 border-dashed border-gray-200">
              <div className="bg-white p-4 rounded-full shadow-lg mb-4">
                <Briefcase className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No more jobs!</h3>
              <p className="text-gray-500 mb-6">You've swiped through all available positions.</p>
              <Button 
                onClick={handleReset} 
                className="rounded-full px-8"
                variant="outline"
                data-testid="button-reset"
              >
                Start Over
              </Button>
           </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-10 flex items-center gap-6 z-20">
        <Button
          size="icon"
          variant="outline"
          className="h-14 w-14 rounded-full border-2 border-red-100 bg-white text-red-500 shadow-lg hover:bg-red-50 hover:border-red-200 transition-all hover:scale-110"
          onClick={() => currentJobs.length > 0 && handleSwipe("left")}
          disabled={currentJobs.length === 0}
          data-testid="button-nope"
        >
          <X className="h-6 w-6" strokeWidth={3} />
        </Button>

        <Button
           size="icon"
           variant="secondary"
           className="h-10 w-10 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 shadow-md transition-all hover:scale-105"
           onClick={handleUndo}
           disabled={history.length === 0}
           data-testid="button-undo"
        >
           <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant="outline"
          className="h-14 w-14 rounded-full border-2 border-green-100 bg-white text-green-500 shadow-lg hover:bg-green-50 hover:border-green-200 transition-all hover:scale-110"
          onClick={() => currentJobs.length > 0 && handleSwipe("right")}
          disabled={currentJobs.length === 0}
          data-testid="button-like"
        >
          <Heart className="h-6 w-6 text-green-500/20" strokeWidth={3} fill="currentColor" />
        </Button>
      </div>
    </div>
  );
}
