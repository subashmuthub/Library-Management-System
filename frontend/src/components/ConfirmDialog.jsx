import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel,
  type = "danger" // danger, warning, info, success
}) => {
  if (!isOpen) return null;

  const colorConfig = {
    danger: { bg: 'bg-red-600', hover: 'hover:bg-red-700', icon: 'text-red-500', iconBg: 'bg-red-100' },
    warning: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', icon: 'text-amber-500', iconBg: 'bg-amber-100' },
    info: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', icon: 'text-blue-500', iconBg: 'bg-blue-100' },
    success: { bg: 'bg-green-600', hover: 'hover:bg-green-700', icon: 'text-green-500', iconBg: 'bg-green-100' }
  };

  const colors = colorConfig[type] || colorConfig.danger;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full ${colors.iconBg} flex items-center justify-center`}>
              <AlertTriangle className={colors.icon} size={24} />
            </div>
            <div className="pt-1 flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500">{message}</p>
            </div>
            <button 
              onClick={onCancel}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
          <button 
            onClick={onCancel}
            className="btn btn-secondary px-5"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
            }}
            className={`btn text-white px-5 ${colors.bg} ${colors.hover}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
