import { memo } from 'react';

export const SkeletonLine = memo(function SkeletonLine({ width = '100%', height = '1rem' }) {
  return <div className="skeleton-line" style={{ width, height }} />;
});

export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <SkeletonLine width="60%" />
      <SkeletonLine width="85%" />
      <SkeletonLine width="40%" />
    </div>
  );
});

export const SkeletonList = memo(function SkeletonList({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
});
