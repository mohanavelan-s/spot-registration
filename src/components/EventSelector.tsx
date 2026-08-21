import React, { useState, useMemo } from 'react';
import { Search, Sparkles, Filter, Layers, Check, ArrowRight, Info, Zap, Globe, ClipboardList } from 'lucide-react';
import { DetectedEvent } from '../types';

interface EventSelectorProps {
  detectedEvents: DetectedEvent[];
  selectedEventKey: string | null;
  onSelectEvent: (eventKey: string | null) => void;
  totalParticipants: number;
  onlineTotal?: number;
  offlineTotal?: number;
}

export const EventSelector: React.FC<EventSelectorProps> = ({
  detectedEvents,
  selectedEventKey,
  onSelectEvent,
  totalParticipants,
  onlineTotal = 0,
  offlineTotal = 0
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'Technical' | 'Non-Technical'>('ALL');
  const [activeDebugTab, setActiveDebugTab] = useState<'tech' | 'nonTech' | 'legacy'>('tech');

  const techCount = useMemo(() => {
    return detectedEvents.filter(e => e.category === 'Technical' || e.category === 'Both').length;
  }, [detectedEvents]);

  const nonTechCount = useMemo(() => {
    return detectedEvents.filter(e => e.category === 'Non-Technical' || e.category === 'Both').length;
  }, [detectedEvents]);

  const filteredEvents = useMemo(() => {
    return detectedEvents.filter(ev => {
      const matchesSearch =
        ev.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
        ev.aliases.some(a => a.toLowerCase().includes(searchFilter.toLowerCase())) ||
        ev.sampleRawOccurrences.some(o => o.toLowerCase().includes(searchFilter.toLowerCase()));

      let matchesCat = true;
      if (categoryFilter === 'Technical') {
        matchesCat = ev.category === 'Technical' || ev.category === 'Both';
      } else if (categoryFilter === 'Non-Technical') {
        matchesCat = ev.category === 'Non-Technical' || ev.category === 'Both';
      }

      return matchesSearch && matchesCat;
    });
  }, [detectedEvents, searchFilter, categoryFilter]);

  const selectedEvent = detectedEvents.find(e => e.key === selectedEventKey);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 mb-6">
      {/* Header with Title & Category Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            Combined Event Roster Selection
          </label>
          <p className="text-xs text-slate-500">
            Combined online and offline participant registrations categorized by canonical symposium event
          </p>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center bg-slate-50 p-1 rounded-lg border border-slate-200 gap-1">
          <button
            id="btn-filter-all-events"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              categoryFilter === 'ALL'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Events ({detectedEvents.length})
          </button>
          <button
            id="btn-filter-tech-events"
            onClick={() => setCategoryFilter('Technical')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              categoryFilter === 'Technical'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Technical ({techCount})
          </button>
          <button
            id="btn-filter-non-tech-events"
            onClick={() => setCategoryFilter('Non-Technical')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              categoryFilter === 'Non-Technical'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Non-Technical ({nonTechCount})
          </button>
        </div>
      </div>

      {/* Search Filter for Events & View All toggle */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            id="search-event-input"
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search event (e.g. 'AD SHOT', 'The Final Hire', 'GOATED OR GHOSTED', 'Zero Hour')..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 pl-9 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
          />
          <div className="absolute left-3 top-2.5 text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* View All / Clear Selection Button */}
        <button
          id="btn-all-participants"
          onClick={() => onSelectEvent(null)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition flex items-center justify-between gap-3 shrink-0 ${
            selectedEventKey === null
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          <span>All Combined Participants</span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className={`px-1.5 py-0.2 rounded font-bold ${
              selectedEventKey === null ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-800'
            }`}>
              Total: {totalParticipants}
            </span>
          </div>
        </button>
      </div>

      {/* Selected Event Prominent Breakdown Banner */}
      {selectedEvent && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-white to-slate-50 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                selectedEvent.category === 'Technical'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}>
                {selectedEvent.category}
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedEvent.displayName}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Active combined participant roster for {selectedEvent.displayName}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-200/80 shadow-xs">
            <div className="px-3 py-1 text-center">
              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center justify-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Online</span>
              </div>
              <div className="text-base font-extrabold text-slate-900 font-mono">
                {selectedEvent.onlineCount}
              </div>
            </div>

            <div className="w-px h-8 bg-slate-200" />

            <div className="px-3 py-1 text-center">
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-1">
                <ClipboardList className="w-3 h-3" />
                <span>Offline</span>
              </div>
              <div className="text-base font-extrabold text-slate-900 font-mono">
                {selectedEvent.offlineCount}
              </div>
            </div>

            <div className="w-px h-8 bg-slate-200" />

            <div className="px-3 py-1 text-center bg-indigo-50/70 rounded-md">
              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Total Combined
              </div>
              <div className="text-base font-extrabold text-indigo-700 font-mono">
                {selectedEvent.combinedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Grid / Roster Cards */}
      <div className="mt-4 max-h-60 overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No symposium events matched "{searchFilter}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredEvents.map(event => {
              const isSelected = selectedEventKey === event.key;
              const isTech = event.category === 'Technical';

              return (
                <div
                  key={event.key}
                  id={`event-card-${event.key.replace(/\s+/g, '-')}`}
                  onClick={() => onSelectEvent(event.key)}
                  className={`p-3 rounded-lg text-sm font-medium cursor-pointer transition border flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 shadow-xs'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs sm:text-sm font-semibold" title={event.displayName}>
                          {event.displayName}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {isTech ? 'Technical Event' : 'Non-Technical Event'}
                      </div>
                    </div>

                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                        isTech ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isTech ? 'Tech' : 'Non-Tech'}
                    </span>
                  </div>

                  {/* Online / Offline / Combined Count Pills */}
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 font-mono">
                    <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                      <span title="Online Registrations" className="text-indigo-600 font-medium">
                        On: <strong>{event.onlineCount}</strong>
                      </span>
                      <span>•</span>
                      <span title="Offline Registrations" className="text-emerald-600 font-medium">
                        Off: <strong>{event.offlineCount}</strong>
                      </span>
                    </div>

                    <div className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      Total: {event.combinedCount}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Normalization Engine Monitor Footer Box */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 w-full md:w-auto">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Canonical Normalization:</span>
          </div>

          {/* If specific event is selected */}
          {selectedEvent ? (
            <div className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 font-mono text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-slate-400">Canonical:</span>
              <span className="text-indigo-700 font-bold">"{selectedEvent.displayName}"</span>
              <span className="text-slate-400">| Category:</span>
              <span className="font-semibold text-slate-800">{selectedEvent.category}</span>
              <span className="text-slate-400">| Active Roster:</span>
              <span className="font-bold text-slate-900">
                {selectedEvent.onlineCount} Online + {selectedEvent.offlineCount} Offline = {selectedEvent.combinedCount} Total
              </span>
            </div>
          ) : (
            /* Multi-mode Diagnostic Samples */
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 font-mono text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1">
                {activeDebugTab === 'tech' && (
                  <>
                    <span className="text-slate-400">Raw Input:</span>
                    <span className="text-slate-800 font-medium">"The FinalHire"</span>
                    <span className="text-indigo-600 font-bold">→ Canonical: "The Final Hire"</span>
                    <span className="text-slate-400">→ Category:</span>
                    <span className="font-semibold text-indigo-700">Technical</span>
                  </>
                )}
                {activeDebugTab === 'nonTech' && (
                  <>
                    <span className="text-slate-400">Raw Input:</span>
                    <span className="text-slate-800 font-medium">"AD SHOT"</span>
                    <span className="text-indigo-600 font-bold">→ Canonical: "AD SHOT"</span>
                    <span className="text-slate-400">→ Category:</span>
                    <span className="font-semibold text-amber-700">Non-Technical</span>
                  </>
                )}
                {activeDebugTab === 'legacy' && (
                  <>
                    <span className="text-slate-400">Raw Input:</span>
                    <span className="text-slate-800 font-medium">"AD BATTLE"</span>
                    <span className="text-indigo-600 font-bold">→ Canonical: "AD SHOT"</span>
                    <span className="text-slate-400">→ Category:</span>
                    <span className="font-semibold text-amber-700">Non-Technical</span>
                    <span className="text-amber-700 bg-amber-50 border border-amber-200/60 px-1 rounded text-[10px]">
                      → Normalized Alias
                    </span>
                  </>
                )}
              </div>

              {/* Toggle switch */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveDebugTab('tech')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    activeDebugTab === 'tech' ? 'bg-indigo-100 text-indigo-800 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Tech
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setActiveDebugTab('nonTech')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    activeDebugTab === 'nonTech' ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Non-Tech
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setActiveDebugTab('legacy')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    activeDebugTab === 'legacy' ? 'bg-rose-100 text-rose-800 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Legacy (AD BATTLE)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 shrink-0 font-mono">
          Symposium Total: <strong className="text-indigo-600">{onlineTotal}</strong> Online + <strong className="text-emerald-600">{offlineTotal}</strong> Offline = <strong className="text-slate-900">{totalParticipants}</strong>
        </div>
      </div>
    </div>
  );
};
