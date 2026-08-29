import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Check,
  X,
  RotateCcw,
  Tag,
  Search,
  Sparkles,
  AlertTriangle,
  Layers,
  Save,
  CheckCircle2
} from 'lucide-react';
import { EventAliasMap, EventConfig } from '../types';
import { DEFAULT_EVENT_REGISTRY } from '../config/defaultAliases';
import { CustomSelect } from './ui/CustomSelect';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface EventCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  registry: EventAliasMap;
  onSaveRegistry: (newRegistry: EventAliasMap) => Promise<void>;
  onResetRegistry?: () => Promise<void>;
}

export const EventCustomizerModal: React.FC<EventCustomizerModalProps> = ({
  isOpen,
  onClose,
  registry,
  onSaveRegistry,
  onResetRegistry
}) => {
  useBodyScrollLock(isOpen);

  // Working local copy of the registry
  const [localRegistry, setLocalRegistry] = useState<EventAliasMap>(() => ({ ...registry }));
  const [activeTab, setActiveTab] = useState<'ALL' | 'Technical' | 'Non-Technical'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Event Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'Technical' | 'Non-Technical'>('Technical');
  const [newEventAliasesInput, setNewEventAliasesInput] = useState('');

  // Per-event new alias input tracker
  const [eventAliasInputs, setEventAliasInputs] = useState<Record<string, string>>({});

  // Sync state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalRegistry({ ...registry });
      setStatusMessage(null);
      setIsAddingNew(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  const eventEntries = useMemo(() => {
    return (Object.entries(localRegistry) as [string, EventConfig][]).map(([key, config]) => ({
      key,
      displayName: config?.displayName || key,
      category: (config?.category || 'Technical') as 'Technical' | 'Non-Technical' | 'Both',
      aliases: config?.aliases || []
    }));
  }, [localRegistry]);

  const totalCount = eventEntries.length;
  const technicalCount = eventEntries.filter(e => e.category === 'Technical').length;
  const nonTechnicalCount = eventEntries.filter(e => e.category === 'Non-Technical').length;

  const filteredEvents = useMemo(() => {
    return eventEntries.filter(event => {
      const matchesTab = activeTab === 'ALL' || event.category === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        event.displayName.toLowerCase().includes(q) ||
        event.aliases.some(a => a.toLowerCase().includes(q)) ||
        event.category.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [eventEntries, activeTab, searchQuery]);

  if (!isOpen) return null;

  // Handler: Add New Event
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const trimmedName = newEventName.trim();
    const canonicalKey = trimmedName.toLowerCase().trim();

    if (localRegistry[canonicalKey]) {
      setStatusMessage({
        type: 'error',
        text: `An event '${trimmedName}' already exists. Please choose a unique name or edit the existing event.`
      });
      return;
    }

    const aliases = [
      canonicalKey,
      ...newEventAliasesInput
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    ];

    const uniqueAliases = Array.from(new Set(aliases));

    setLocalRegistry(prev => ({
      ...prev,
      [canonicalKey]: {
        displayName: trimmedName,
        category: newEventCategory,
        aliases: uniqueAliases
      }
    }));

    setNewEventName('');
    setNewEventAliasesInput('');
    setIsAddingNew(false);

    // Make sure new event is immediately visible in the list
    if (activeTab !== 'ALL' && activeTab !== newEventCategory) {
      setActiveTab('ALL');
    }
    setSearchQuery('');

    setStatusMessage({
      type: 'success',
      text: `Added new event "${trimmedName}" (${newEventCategory}). Remember to click "Save & Sync Across Portal" below.`
    });
  };

  // Handler: Update existing event display name
  const handleUpdateDisplayName = (key: string, newName: string) => {
    setLocalRegistry(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          displayName: newName
        }
      };
    });
  };

  // Handler: Update category (Technical vs Non-Technical)
  const handleUpdateCategory = (key: string, category: 'Technical' | 'Non-Technical') => {
    setLocalRegistry(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          category
        }
      };
    });
  };

  // Handler: Add alias to specific event
  const handleAddAliasToEvent = (key: string) => {
    const aliasToAdd = (eventAliasInputs[key] || '').trim().toLowerCase();
    if (!aliasToAdd) return;

    setLocalRegistry(prev => {
      const current = prev[key];
      if (!current) return prev;
      if (current.aliases.includes(aliasToAdd)) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          aliases: [...current.aliases, aliasToAdd]
        }
      };
    });

    setEventAliasInputs(prev => ({ ...prev, [key]: '' }));
  };

  // Handler: Remove alias
  const handleRemoveAlias = (key: string, aliasToRemove: string) => {
    setLocalRegistry(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: {
          ...current,
          aliases: current.aliases.filter(a => a !== aliasToRemove)
        }
      };
    });
  };

  // Handler: Delete event
  const handleDeleteEvent = (key: string, name: string) => {
    if (totalCount <= 1) {
      alert('You must have at least one registered event for the symposium.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove the event "${name}"? Existing registrations will no longer be mapped to this canonical event unless re-added.`)) {
      setLocalRegistry(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setStatusMessage({
        type: 'success',
        text: `Removed "${name}". Click "Save & Sync Across Portal" to persist changes.`
      });
    }
  };

  // Handler: Reset to Defaults
  const handleReset = async () => {
    if (window.confirm('Reset all symposium events back to the official default AIROX list (9 events)? All custom names and added events will be reverted.')) {
      if (onResetRegistry) {
        setIsSaving(true);
        try {
          await onResetRegistry();
          setLocalRegistry({ ...DEFAULT_EVENT_REGISTRY });
          setStatusMessage({ type: 'success', text: 'Reset events to default AIROX configuration.' });
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message || 'Failed to reset events' });
        } finally {
          setIsSaving(false);
        }
      } else {
        setLocalRegistry({ ...DEFAULT_EVENT_REGISTRY });
        setStatusMessage({ type: 'success', text: 'Reset local events to AIROX defaults. Click Save & Sync to apply.' });
      }
    }
  };

  // Handler: Save & Broadcast
  const handleSave = async () => {
    if (Object.keys(localRegistry).length === 0) {
      setStatusMessage({ type: 'error', text: 'At least one event is required.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      await onSaveRegistry(localRegistry);
      setStatusMessage({
        type: 'success',
        text: 'Symposium events & tracks successfully updated and synchronized across all users!'
      });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to update symposium events.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        id="modal-event-customizer"
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Symposium Events & Tracks Management
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-bold border border-indigo-400/30 uppercase tracking-wider">
                  Admin Control
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Customize symposium event names, total events count, and track types (Technical / Non-Technical).
              </p>
            </div>
          </div>
          <button
            id="btn-close-event-customizer"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Subheader Counters & Filter Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Track Summary Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs text-xs font-bold text-slate-800">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Total Events:</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-black">
                {totalCount}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs font-bold text-indigo-900">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              <span>Technical:</span>
              <span className="font-extrabold text-indigo-700">{technicalCount}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs font-bold text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Non-Technical:</span>
              <span className="font-extrabold text-amber-700">{nonTechnicalCount}</span>
            </div>
          </div>

          {/* Quick Add Button */}
          <button
            type="button"
            id="btn-toggle-add-event"
            onClick={() => {
              setIsAddingNew(prev => !prev);
              setStatusMessage(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className={`w-4 h-4 transition-transform duration-200 ${isAddingNew ? 'rotate-45' : ''}`} />
            <span>{isAddingNew ? 'Close Form' : 'Add New Event'}</span>
          </button>
        </div>

        {/* Add New Event Form Drawer */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateEvent}
            className="p-5 bg-indigo-50/80 border-b border-indigo-200 transition-all"
          >
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Create New Symposium Event / Track</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Event Name */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Event Display Name *
                </label>
                <input
                  id="input-new-event-name"
                  type="text"
                  required
                  placeholder="e.g., Code Sprint, Web Design, Robo Race"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Event Type / Category */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Event Type / Category *
                </label>
                <CustomSelect
                  id="select-new-event-category"
                  value={newEventCategory}
                  onChange={val => setNewEventCategory(val as any)}
                  options={[
                    { value: 'Technical', label: 'Technical Event' },
                    { value: 'Non-Technical', label: 'Non-Technical Event' }
                  ]}
                />
              </div>

              {/* Initial Aliases */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Common Aliases / Spellings (Comma-separated)
                </label>
                <input
                  id="input-new-event-aliases"
                  type="text"
                  placeholder="e.g. codesprint, code-sprint, coding"
                  value={newEventAliasesInput}
                  onChange={e => setNewEventAliasesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-indigo-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-confirm-add-event"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Confirm & Add Event</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter and Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Events ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('Technical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'Technical'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-indigo-600'
              }`}
            >
              Technical ({technicalCount})
            </button>
            <button
              onClick={() => setActiveTab('Non-Technical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'Non-Technical'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-amber-600'
              }`}
            >
              Non-Technical ({nonTechnicalCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search event name or alias..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Events List Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-semibold">No events matching your filters</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting the search query or category tabs</p>
            </div>
          ) : (
            filteredEvents.map((event, idx) => (
              <div
                key={event.key}
                id={`event-item-${event.key.replace(/\s+/g, '-')}`}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs transition hover:border-indigo-300 space-y-3"
              >
                {/* Event Top Bar: Display Name & Category & Delete */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <span className="text-xs font-bold text-slate-400 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Official Event Display Name
                      </label>
                      <input
                        type="text"
                        value={event.displayName}
                        onChange={e => handleUpdateDisplayName(event.key, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl text-xs font-bold text-slate-900 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Category Selector */}
                  <div className="w-48">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      Event Track Type
                    </label>
                    <CustomSelect
                      id={`select-category-${event.key.replace(/\s+/g, '-')}`}
                      value={event.category}
                      onChange={val => handleUpdateCategory(event.key, val as any)}
                      size="sm"
                      options={[
                        { value: 'Technical', label: 'Technical' },
                        { value: 'Non-Technical', label: 'Non-Technical' }
                      ]}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="pt-3">
                    <button
                      id={`btn-delete-event-${event.key.replace(/\s+/g, '-')}`}
                      onClick={() => handleDeleteEvent(event.key, event.displayName)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                      title="Delete event from symposium"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Aliases Section */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Aliases &amp; Accepted Input Variations ({event.aliases.length}):</span>
                    </span>
                  </div>

                  {/* Aliases Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {event.aliases.map(alias => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 group"
                      >
                        <span>{alias}</span>
                        {event.aliases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAlias(event.key, alias)}
                            className="text-slate-400 hover:text-rose-600 ml-0.5 rounded transition"
                            title={`Remove alias "${alias}"`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}

                    {/* Inline Add Alias Input */}
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="+ Add alias..."
                        value={eventAliasInputs[event.key] || ''}
                        onChange={e =>
                          setEventAliasInputs(prev => ({ ...prev, [event.key]: e.target.value }))
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAliasToEvent(event.key);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-28"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAliasToEvent(event.key)}
                        disabled={!(eventAliasInputs[event.key] || '').trim()}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 disabled:opacity-40 transition cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            id="btn-reset-default-events"
            onClick={handleReset}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to AIROX Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel-event-customizer"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-event-customizer"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving &amp; Broadcasting...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save &amp; Sync Across Portal</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
