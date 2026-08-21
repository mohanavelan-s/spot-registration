import React, { useState } from 'react';
import { Sliders, Plus, Trash2, Check, X, RotateCcw, Tag } from 'lucide-react';
import { EventAliasMap } from '../types';
import { DEFAULT_EVENT_REGISTRY } from '../config/defaultAliases';

interface AliasManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  registry: EventAliasMap;
  onSaveRegistry: (newRegistry: EventAliasMap) => void;
}

export const AliasManagerModal: React.FC<AliasManagerModalProps> = ({
  isOpen,
  onClose,
  registry,
  onSaveRegistry
}) => {
  const [currentMap, setCurrentMap] = useState<EventAliasMap>(registry);
  const [selectedEventKey, setSelectedEventKey] = useState<string>(Object.keys(registry)[0] || '');
  const [newAliasInput, setNewAliasInput] = useState('');
  const [newEventDisplayName, setNewEventDisplayName] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'Technical' | 'Non-Technical'>('Technical');
  const [isAddingNewEvent, setIsAddingNewEvent] = useState(false);

  if (!isOpen) return null;

  const currentEvent = currentMap[selectedEventKey];

  const handleAddAlias = () => {
    if (!newAliasInput.trim() || !selectedEventKey) return;
    const alias = newAliasInput.trim();

    setCurrentMap(prev => {
      const target = prev[selectedEventKey];
      if (!target) return prev;
      if (target.aliases.includes(alias)) return prev;

      return {
        ...prev,
        [selectedEventKey]: {
          ...target,
          aliases: [...target.aliases, alias]
        }
      };
    });
    setNewAliasInput('');
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setCurrentMap(prev => {
      const target = prev[selectedEventKey];
      if (!target) return prev;
      return {
        ...prev,
        [selectedEventKey]: {
          ...target,
          aliases: target.aliases.filter(a => a !== aliasToRemove)
        }
      };
    });
  };

  const handleCreateNewEvent = () => {
    if (!newEventDisplayName.trim()) return;
    const canonicalKey = newEventDisplayName.trim().toLowerCase();

    setCurrentMap(prev => ({
      ...prev,
      [canonicalKey]: {
        displayName: newEventDisplayName.trim(),
        category: newEventCategory,
        aliases: [newEventDisplayName.trim().toLowerCase()]
      }
    }));

    setSelectedEventKey(canonicalKey);
    setNewEventDisplayName('');
    setIsAddingNewEvent(false);
  };

  const handleResetToDefault = () => {
    setCurrentMap({ ...DEFAULT_EVENT_REGISTRY });
    setSelectedEventKey(Object.keys(DEFAULT_EVENT_REGISTRY)[0] || '');
  };

  const handleSaveAndApply = () => {
    onSaveRegistry(currentMap);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Event Alias & Normalization Config</h3>
              <p className="text-xs text-slate-300">
                Configure canonical names and spellings mapped during participant extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Layout: Left Master List, Right Alias Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 flex-1 overflow-hidden">
          {/* Left Column: Events Master */}
          <div className="p-4 overflow-y-auto max-h-[300px] md:max-h-[500px] bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Canonical Events ({Object.keys(currentMap).length})
              </span>
              <button
                type="button"
                onClick={() => setIsAddingNewEvent(!isAddingNewEvent)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {isAddingNewEvent && (
              <div className="p-3 mb-3 bg-white rounded-xl border border-indigo-200 shadow-sm space-y-2 text-xs">
                <input
                  type="text"
                  value={newEventDisplayName}
                  onChange={e => setNewEventDisplayName(e.target.value)}
                  placeholder="New Event Name..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                />
                <select
                  value={newEventCategory}
                  onChange={e => setNewEventCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1 border border-slate-300 rounded-lg outline-none text-xs"
                >
                  <option value="Technical">Technical</option>
                  <option value="Non-Technical">Non-Technical</option>
                </select>
                <div className="flex justify-end gap-1 pt-1">
                  <button
                    onClick={() => setIsAddingNewEvent(false)}
                    className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewEvent}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {(Object.entries(currentMap) as [string, EventAliasMap[string]][]).map(([key, config]) => {
                const isSelected = selectedEventKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedEventKey(key)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60'
                    }`}
                  >
                    <span className="truncate">{config.displayName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        isSelected
                          ? 'bg-indigo-700 text-indigo-100'
                          : config.category === 'Technical'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-cyan-50 text-cyan-700'
                      }`}
                    >
                      {config.aliases.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Aliases for Selected Event */}
          <div className="p-6 md:col-span-2 overflow-y-auto max-h-[500px] flex flex-col justify-between">
            {currentEvent ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-slate-900">{currentEvent.displayName}</h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                      {currentEvent.category || 'Technical'} Event
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Canonical Key: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">{selectedEventKey}</code>
                  </p>
                </div>

                {/* Add New Alias Input */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Add Recognized Spelling / Alias:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAliasInput}
                      onChange={e => setNewAliasInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddAlias()}
                      placeholder="e.g. 'The FinalHire', 'final-hire', '0 hour'..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddAlias}
                      disabled={!newAliasInput.trim()}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
                    >
                      Add Alias
                    </button>
                  </div>
                </div>

                {/* Active Aliases List */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Active Recognized Variations ({currentEvent.aliases.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentEvent.aliases.map((alias, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-800 font-medium"
                      >
                        <Tag className="w-3 h-3 text-indigo-600" />
                        <span>"{alias}"</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAlias(alias)}
                          className="p-0.5 text-slate-400 hover:text-rose-600 transition"
                          title="Remove alias"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                Select an event from the left to manage aliases.
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to AIROX'26 Defaults</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndApply}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  Save & Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
