import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Loader({ className, size = "md" }: LoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-700" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-indigo-300 animate-spin" style={{ animationDuration: "0.8s", animationDirection: "reverse" }} />
      </div>
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-100 dark:border-gray-800" />
          <div 
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 dark:border-t-indigo-400"
            style={{ animation: "spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
          />
          <div 
            className="absolute inset-3 rounded-full border-2 border-transparent border-t-indigo-300 dark:border-t-indigo-600"
            style={{ animation: "spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CenteredLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          <div 
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-500 dark:border-t-indigo-400"
            style={{ animation: "spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
          />
          <div 
            className="absolute inset-2.5 rounded-full border-2 border-transparent border-t-indigo-300 dark:border-t-indigo-600"
            style={{ animation: "spin 0.7s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
          </div>
        </div>
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{message}</p>
        )}
      </div>
    </div>
  );
}
