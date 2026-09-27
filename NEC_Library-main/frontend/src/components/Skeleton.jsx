import React from 'react';

const Skeleton = ({ className = '', type = 'rect', ...props }) => {
  const baseClasses = 'bg-slate-200 animate-pulse';
  let typeClasses = '';

  if (type === 'circle') {
    typeClasses = 'rounded-full';
  } else if (type === 'text') {
    typeClasses = 'h-4 rounded';
  } else {
    typeClasses = 'rounded-lg';
  }

  return (
    <div 
      className={`${baseClasses} ${typeClasses} ${className}`}
      {...props}
    />
  );
};

export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <div className="table-shell mt-4">
    <table className="w-full">
      <thead>
        <tr>
          {Array(cols).fill(0).map((_, i) => (
            <th key={`th-${i}`} className="py-3 px-4">
              <Skeleton type="text" className="w-20 bg-slate-300" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array(rows).fill(0).map((_, i) => (
          <tr key={`tr-${i}`}>
            {Array(cols).fill(0).map((_, j) => (
              <td key={`td-${i}-${j}`} className="py-3 px-4">
                <Skeleton type="text" className={j === 0 ? "w-24" : "w-full max-w-[120px]"} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const CardSkeleton = () => (
  <div className="card h-full p-5 space-y-4">
    <div className="flex gap-4">
      <Skeleton type="circle" className="w-12 h-12 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton type="text" className="w-3/4" />
        <Skeleton type="text" className="w-1/2" />
      </div>
    </div>
    <div className="space-y-2 pt-4">
      <Skeleton type="text" className="w-full" />
      <Skeleton type="text" className="w-5/6" />
    </div>
  </div>
);

export default Skeleton;
