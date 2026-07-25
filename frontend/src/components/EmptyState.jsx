import React from 'react';

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Icon size={40} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-md mb-8">{description}</p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
