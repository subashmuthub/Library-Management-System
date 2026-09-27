import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="text-green-500" size={20} />,
  error: <XCircle className="text-red-500" size={20} />,
  warning: <AlertTriangle className="text-amber-500" size={20} />,
  info: <Info className="text-blue-500" size={20} />
};

export const Toast = ({ type = 'info', message, onClose, duration = 3000 }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible && duration > 0) return null;

  return (
    <div className={`toast toast-${type} flex items-start gap-3`}>
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{message}</p>
      </div>
      <button 
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
