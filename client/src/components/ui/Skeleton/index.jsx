// Shape-matched skeleton loaders — DESIGN.md "Motion"/"States": never a generic spinner.
export function Skeleton({ className = '' }) {
  return <div className={`animate-shimmer rounded-(--radius-md) ${className}`} aria-hidden="true" />;
}

export function SkeletonText({ lines = 1, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export default Skeleton;
