import React from 'react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface InputAreaProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}

const InputArea: React.FC<InputAreaProps> = ({ label, value, onChange, placeholder }) => {
  
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  return (
    <div className="w-full group">
      <div className="flex justify-between items-center mb-3">
        <label className="text-gray-500 text-[10px] tracking-[0.3em] font-light pl-1 group-focus-within:text-indigo-300 transition-colors">
          {label}
        </label>
        <button 
          onClick={handlePaste}
          className="text-[10px] text-gray-600 hover:text-white flex items-center gap-1 transition-colors tracking-widest opacity-0 group-hover:opacity-100"
        >
          <ClipboardDocumentIcon className="w-3 h-3" /> 貼上
        </button>
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-40 bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/5 focus:border-white/20 rounded-sm p-4 text-xs md:text-sm text-gray-300 focus:text-white focus:outline-none font-mono resize-none custom-scrollbar transition-all placeholder-gray-700 leading-relaxed tracking-wide"
        />
        {/* Decorative Corner */}
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/10 opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/10 opacity-50"></div>
      </div>
    </div>
  );
};

export default InputArea;