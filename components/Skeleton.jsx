'use client';
// Skeleton loading components — use while data is loading.

export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: 4, ...style }} />
  );
}

export function SkeletonCard({ lines = 3, style = {} }) {
  return (
    <div className="card card-pad col gap-3" style={style}>
      <SkeletonLine width="60%" height={18} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 2 ? '40%' : '90%'} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}>
        <SkeletonLine width="30%" height={14} />
      </div>
      <div className="col gap-0">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="row gap-4" style={{ padding: '12px 16px', borderBottom: r < rows - 1 ? '1px solid var(--border-soft)' : 'none' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonLine key={c} width={c === 0 ? '35%' : c === cols - 1 ? '15%' : '20%'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page col gap-4">
      <div className="col gap-2 mb-2">
        <SkeletonLine width="180px" height={12} />
        <SkeletonLine width="280px" height={28} />
        <SkeletonLine width="240px" height={14} />
      </div>
      <div className="grid grid-4 gap-3">
        {[1,2,3,4].map(i => <SkeletonCard key={i} lines={2} />)}
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
