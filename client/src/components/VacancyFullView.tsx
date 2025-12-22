import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Building2, Wallet, MapPin, Briefcase, Heart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HHJob } from "@shared/schema";

interface VacancyFullViewProps {
  vacancy: HHJob | null;
  onClose: () => void;
  onApply: () => void;
  isApplying?: boolean;
}

const employmentTypeLabels: Record<string, string> = {
  "full-time": "Полный день",
  "remote": "Удалённая работа",
  "hybrid": "Гибридный формат",
  "part-time": "Частичная занятость",
};

export function VacancyFullView({ vacancy, onClose, onApply, isApplying }: VacancyFullViewProps) {
  const [logoError, setLogoError] = useState(false);
  
  useEffect(() => {
    setLogoError(false);
  }, [vacancy?.company]);
  
  if (!vacancy) return null;

  return (
    <AnimatePresence>
      {vacancy && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              duration: 0.25, 
              ease: [0.24, 0.8, 0.4, 1]
            }}
            className="fixed inset-4 z-[110] flex items-center justify-center pointer-events-none"
          >
            <div 
              className="bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative shrink-0">
                <div className="h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-400 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
                  {vacancy.logoUrl && !logoError ? (
                    <img 
                      src={vacancy.logoUrl} 
                      alt={`${vacancy.company} logo`}
                      className="max-h-14 max-w-[120px] object-contain"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <Building2 className="w-10 h-10 text-white/80" />
                  )}
                </div>
                
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  data-testid="button-close-fullview"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {vacancy.url && (
                  <a 
                    href={vacancy.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1" data-testid="fullview-title">
                    {vacancy.title}
                  </h2>
                  <p className="text-lg font-semibold text-indigo-600" data-testid="fullview-company">
                    {vacancy.company}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100/50">
                    <div className="flex items-center gap-2 text-green-700 mb-1">
                      <Wallet className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Зарплата</span>
                    </div>
                    <p className="font-bold text-green-800 text-lg" data-testid="fullview-salary">{vacancy.salary}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50">
                    <div className="flex items-center gap-2 text-blue-700 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Локация</span>
                    </div>
                    <p className="font-bold text-blue-800 text-lg" data-testid="fullview-location">{vacancy.location}</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100/50">
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">Тип занятости</span>
                  </div>
                  <p className="font-bold text-purple-800" data-testid="fullview-employment">
                    {employmentTypeLabels[vacancy.employmentType] || vacancy.employmentType}
                  </p>
                </div>
                
                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Описание</h3>
                  <p className="text-gray-700 leading-relaxed text-[15px]" data-testid="fullview-description">
                    {vacancy.description}
                  </p>
                </div>
                
                {vacancy.tags && vacancy.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Навыки</h3>
                    <div className="flex flex-wrap gap-2">
                      {vacancy.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 border border-gray-200/50 px-3 py-1.5 rounded-full text-sm font-medium"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="shrink-0 p-5 bg-white/80 backdrop-blur-sm border-t border-gray-100">
                <Button
                  onClick={onApply}
                  disabled={isApplying}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-lg shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40"
                  data-testid="button-apply-fullview"
                >
                  {isApplying ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Отправляем...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Heart className="w-5 h-5" fill="currentColor" />
                      Откликнуться
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
