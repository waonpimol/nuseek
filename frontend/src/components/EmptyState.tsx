import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center py-12 sm:py-16 px-4 ${className}`}>
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-sm sm:text-base font-semibold text-gray-800">{title}</h3>
      {description && (
        <p className="mt-1 text-xs sm:text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">{children}</div>}
    </div>
  );
}