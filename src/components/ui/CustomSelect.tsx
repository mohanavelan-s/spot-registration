import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CustomSelectOption {
  value: string;
  label: string;
  group?: string;
  badge?: string | number;
  description?: string;
  disabled?: boolean;
}

export interface CustomSelectGroup {
  label: string;
  options: CustomSelectOption[];
}

export interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options?: (CustomSelectOption | string)[];
  groups?: CustomSelectGroup[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'Select an option...',
  className = '',
  triggerClassName = '',
  dropdownClassName = '',
  disabled = false,
  icon,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options
  const normalizedOptions: CustomSelectOption[] = React.useMemo(() => {
    if (groups && groups.length > 0) {
      const list: CustomSelectOption[] = [];
      groups.forEach(g => {
        g.options.forEach(opt => {
          list.push({ ...opt, group: g.label });
        });
      });
      return list;
    }

    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options, groups]);

  // Find currently selected option
  const selectedOption = normalizedOptions.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (optionValue: string, isDisabled?: boolean) => {
    if (isDisabled) return;
    onChange(optionValue);
    setIsOpen(false);
  };

  // Group options for rendering
  const groupedStructure: { groupName?: string; items: CustomSelectOption[] }[] = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.map(g => ({
        groupName: g.label,
        items: g.options
      }));
    }

    const map: { [key: string]: CustomSelectOption[] } = {};
    const ungrouped: CustomSelectOption[] = [];

    normalizedOptions.forEach(opt => {
      if (opt.group) {
        if (!map[opt.group]) map[opt.group] = [];
        map[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    const result: { groupName?: string; items: CustomSelectOption[] }[] = [];
    if (ungrouped.length > 0) {
      result.push({ items: ungrouped });
    }
    Object.keys(map).forEach(groupName => {
      result.push({ groupName, items: map[groupName] });
    });

    return result;
  }, [normalizedOptions, groups]);

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs min-h-[32px]',
    md: 'py-2 px-3 text-xs min-h-[38px]',
    lg: 'py-2.5 px-4 text-sm min-h-[44px]'
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${className}`}
    >
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-white text-slate-800 border border-slate-300 rounded-xl font-medium shadow-xs transition-all outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none ${sizeClasses} ${
          isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500 bg-slate-50/50' : ''
        } ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate text-left">
          {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
          <span className={`truncate ${!selectedOption ? 'text-slate-400 font-normal' : 'text-slate-800'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu with Rounded Corners */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute left-0 right-0 z-50 mt-1.5 max-h-72 w-full overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl ring-1 ring-black/5 p-1.5 space-y-1 focus:outline-none custom-scrollbar ${dropdownClassName}`}
            role="listbox"
          >
            {groupedStructure.map((group, gIdx) => (
              <div key={gIdx} className="space-y-0.5">
                {group.groupName && (
                  <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50/80 rounded-lg">
                    {group.groupName}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map(opt => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => handleSelect(opt.value, opt.disabled)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-xl font-medium transition-all text-left cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                        } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="text-[10px] text-slate-400 font-normal truncate">
                              {opt.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isSelected
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
