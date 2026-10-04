interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 16, className = "" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="กำลังโหลด"
      className={`inline-block flex-shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
