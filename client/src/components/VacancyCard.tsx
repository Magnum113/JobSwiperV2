import { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { motion, PanInfo, useMotionValue, useTransform, useAnimation, AnimatePresence } from "framer-motion";
import { Building2, Wallet, MapPin, Clock, ExternalLink, Zap, X, Brain, FileText, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HHJob, CompatibilityResult } from "@shared/schema";

interface VacancyCardProps {
  job: HHJob;
  onSwipe: (direction: "left" | "right") => void;
  onExpand: () => void;
  active: boolean;
  compatibility?: CompatibilityResult;
}

export interface VacancyCardRef {
  swipe: (direction: "left" | "right") => Promise<void>;
}

const employmentTypeLabels: Record<string, string> = {
  "full-time": "Полный день",
  "remote": "Удалённо",
  "hybrid": "Гибрид",
  "part-time": "Частичная",
};

function CompatibilityBadge({ compatibility }: { compatibility: CompatibilityResult }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const getGradient = () => {
    if (compatibility.score >= 70) return "from-emerald-400 to-green-500";
    if (compatibility.score >= 40) return "from-amber-400 to-orange-500";
    return "from-rose-400 to-red-500";
  };
  
  const getLabel = () => {
    if (compatibility.score >= 70) return "Отличное совпадение";
    if (compatibility.score >= 40) return "Частичное совпадение";
    return "Низкое совпадение";
  };

  return (
    <>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={`absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg cursor-pointer bg-gradient-to-r ${getGradient()} text-white border border-white/20 backdrop-blur-sm`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="badge-compatibility"
      >
        <Zap className="w-3.5 h-3.5" />
        <span className="font-bold text-sm">{compatibility.score}%</span>
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl p-5 max-w-[340px] w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl bg-gradient-to-r ${getGradient()}`}>
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">AI-совместимость</h3>
                      <p className="text-xs text-gray-500">{getLabel()}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  AI сравнивает ваше резюме с требованиями вакансии и показывает, насколько вы подходите для этой позиции.
                </p>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Совпадение</span>
                    <span className={`text-2xl font-bold bg-gradient-to-r ${getGradient()} bg-clip-text text-transparent`}>
                      {compatibility.score}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${compatibility.score}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={`h-full bg-gradient-to-r ${getGradient()}`}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Анализ AI:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {compatibility.explanation}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">На основе чего оценка:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Навыки из резюме</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Target className="w-3.5 h-3.5 text-purple-500" />
                      <span>Требования вакансии</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Опыт работы</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Brain className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ключевые слова</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export const VacancyCard = forwardRef<VacancyCardRef, VacancyCardProps>(
  ({ job, onSwipe, onExpand, active, compatibility }, ref) => {
    const controls = useAnimation();
    const x = useMotionValue(0);
    const isMounted = useRef(true);
    const hasSwiped = useRef(false);
    const touchActive = useRef(false);
    const lastSwipeTime = useRef(0);

    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

    const likeOpacity = useTransform(x, [20, 150], [0, 1]);
    const nopeOpacity = useTransform(x, [-150, -20], [1, 0]);

    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
      isMounted.current = true;
      hasSwiped.current = false;
      touchActive.current = false;
      lastSwipeTime.current = 0;
      setLogoError(false);
      
      x.set(0);
      controls.set({ x: 0, rotate: 0, opacity: 1 });
      
      return () => {
        isMounted.current = false;
      };
    }, [job.id, controls, x]);

    const performSwipe = useCallback(async (direction: "left" | "right") => {
      const now = Date.now();
      if (!isMounted.current || hasSwiped.current) {
        console.log("SWIPE BLOCKED - already swiped", job.id);
        return;
      }
      if (now - lastSwipeTime.current < 300) {
        console.log("SWIPE BLOCKED - too fast", job.id);
        return;
      }
      
      hasSwiped.current = true;
      lastSwipeTime.current = now;
      
      console.log("CARD SWIPE CALL", direction, job.id);

      const targetX = direction === "right" ? 500 : -500;
      await controls.start({
        x: targetX,
        opacity: 0,
        transition: { duration: 0.25 }
      });

      onSwipe(direction);
    }, [controls, onSwipe, job.id]);

    useImperativeHandle(ref, () => ({
      swipe: performSwipe
    }), [performSwipe]);

    const handleDragStart = useCallback((event: MouseEvent | TouchEvent | PointerEvent) => {
      if (event.type === "touchstart" || event.type === "pointerdown") {
        touchActive.current = true;
      }
    }, []);

    const handleDragEnd = useCallback(async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (event.type === "mouseup" && touchActive.current) {
        console.log("DRAG END BLOCKED - mouseup after touch", job.id);
        return;
      }
      
      if (event.type === "touchend" || event.type === "pointerup") {
        setTimeout(() => {
          touchActive.current = false;
        }, 100);
      }
      
      if (hasSwiped.current) {
        console.log("DRAG END BLOCKED - already swiped", job.id);
        return;
      }

      const offset = info.offset.x;
      const velocity = info.velocity.x;

      if (offset > 100 || velocity > 500) {
        await performSwipe("right");
      } else if (offset < -100 || velocity < -500) {
        await performSwipe("left");
      } else {
        if (isMounted.current && !hasSwiped.current) {
          controls.start({
            x: 0,
            rotate: 0,
            transition: { type: "spring", stiffness: 500, damping: 30 }
          });
        }
      }
    }, [controls, performSwipe, job.id]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (Math.abs(x.get()) < 5 && !hasSwiped.current) {
          onExpand();
        }
      },
      [x, onExpand]
    );

    if (!active) return null;

    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{
          x,
          rotate,
          opacity,
          position: "absolute",
          zIndex: 10,
          width: "100%",
          maxWidth: "400px",
          cursor: "grab",
          touchAction: "pan-y",
        }}
        animate={controls}
        whileTap={{ cursor: "grabbing", scale: 1.02 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        className="perspective-1000"
      >
        <Card className="h-[480px] w-full overflow-hidden rounded-[28px] border-0 select-none relative bg-gradient-to-br from-white via-white to-gray-50/80 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-indigo-50/30 pointer-events-none" />

          <motion.div style={{ opacity: likeOpacity }} className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-20 pointer-events-none rounded-[28px]">
            <div className="border-4 border-green-500 px-5 py-2.5 rounded-xl transform -rotate-12 bg-white/50 backdrop-blur-sm">
              <span className="text-4xl font-black text-green-500">Like</span>
            </div>
          </motion.div>

          <motion.div style={{ opacity: nopeOpacity }} className="absolute inset-0 bg-red-500/10 flex items-center justify-center z-20 pointer-events-none rounded-[28px]">
            <div className="border-4 border-red-500 px-5 py-2.5 rounded-xl transform rotate-12 bg-white/50 backdrop-blur-sm">
              <span className="text-4xl font-black text-red-500">Nope</span>
            </div>
          </motion.div>

          <CardContent className="p-0 h-full flex flex-col relative z-10">
            {compatibility && <CompatibilityBadge compatibility={compatibility} />}
            
            <div className="h-20 min-h-20 max-h-20 flex-shrink-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 flex items-center justify-center relative overflow-hidden">
              {!logoError && job.logoUrl ? (
                <img 
                  src={job.logoUrl} 
                  alt={job.company} 
                  className="h-12 max-w-[120px] object-contain" 
                  onError={() => setLogoError(true)} 
                />
              ) : (
                <Building2 className="w-8 h-8 text-indigo-400" />
              )}
              
              {job.url && (
                <a 
                  href={job.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 p-2 bg-white/80 hover:bg-white rounded-full shadow-md transition-all hover:scale-110"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-600" />
                </a>
              )}
            </div>

            <div className="px-6 py-5 flex-1 flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1 line-clamp-2" data-testid="text-job-title">{job.title}</h2>
                <p className="text-base font-semibold text-indigo-600" data-testid="text-company">{job.company}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100/50">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="font-semibold text-sm" data-testid="text-salary">{job.salary}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100/50">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="font-medium text-sm">{job.location}</span>
                </div>

                <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-3 py-1.5 rounded-full border border-purple-100/50">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-medium text-sm">{employmentTypeLabels[job.employmentType] || job.employmentType}</span>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-gray-600 leading-relaxed line-clamp-4 text-[15px]" data-testid="text-description">{job.description}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {job.tags?.slice(0, 4).map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 text-xs py-1 px-2.5 rounded-full font-medium border border-gray-200/50">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="text-center">
                <span className="text-xs text-gray-400 font-medium">Нажми, чтобы узнать больше</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
);

VacancyCard.displayName = "VacancyCard";
