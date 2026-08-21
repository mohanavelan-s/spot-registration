import React from 'react';
import { Layers, Users, Award, ArrowRight, CheckCircle2, Cpu, Sparkles, Globe, ClipboardList } from 'lucide-react';
import { DetectedEvent, Participant } from '../types';

interface AllEventsOverviewProps {
  detectedEvents: DetectedEvent[];
  participants: Participant[];
  onSelectEventAndSwitch: (eventKey: string) => void;
}

export const AllEventsOverview: React.FC<AllEventsOverviewProps> = ({
  detectedEvents,
  participants,
  onSelectEventAndSwitch
}) => {
  const techEvents = detectedEvents.filter(e => e.category === 'Technical' || e.category === 'Both');
  const nonTechEvents = detectedEvents.filter(e => e.category === 'Non-Technical');
  const totalRegistrations = participants.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AIROX '26 Symposium Master Matrix</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Event Registration Overview</h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Consolidated distribution of all {detectedEvents.length} normalized symposium events across {totalRegistrations} registered students. Click any event card to immediately extract and export its roster.
          </p>
        </div>
      </div>

      {/* Technical Events Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Technical Events ({techEvents.length})</h3>
              <p className="text-xs text-slate-500">Core engineering, coding, robotics, and innovation competitions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techEvents.map(event => {
            const percentage = totalRegistrations > 0 ? Math.round((event.combinedCount / totalRegistrations) * 100) : 0;

            return (
              <div
                key={event.key}
                onClick={() => onSelectEventAndSwitch(event.key)}
                className="bg-white rounded-xl border border-slate-200 hover:border-indigo-400 p-4 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition">
                      {event.displayName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold shrink-0">
                      Technical
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-700">{event.combinedCount}</span>
                    <span className="text-xs text-slate-500 font-medium">Combined ({percentage}%)</span>
                  </div>

                  {/* Online vs Offline breakdown */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-500">
                    <span className="text-indigo-600 font-semibold">Online: {event.onlineCount}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">Offline: {event.offlineCount}</span>
                  </div>

                  <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(percentage * 2, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-indigo-600">
                  <span>Extract Combined Roster</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Non-Technical Events Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Non-Technical Events ({nonTechEvents.length})</h3>
              <p className="text-xs text-slate-500">Creativity, gaming, trivia, auction, and media events</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {nonTechEvents.map(event => {
            const percentage = totalRegistrations > 0 ? Math.round((event.combinedCount / totalRegistrations) * 100) : 0;

            return (
              <div
                key={event.key}
                onClick={() => onSelectEventAndSwitch(event.key)}
                className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 p-4 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-600 transition">
                      {event.displayName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold shrink-0">
                      Non-Technical
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-700">{event.combinedCount}</span>
                    <span className="text-xs text-slate-500 font-medium">Combined ({percentage}%)</span>
                  </div>

                  {/* Online vs Offline breakdown */}
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-500">
                    <span className="text-indigo-600 font-semibold">Online: {event.onlineCount}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">Offline: {event.offlineCount}</span>
                  </div>

                  <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(percentage * 2, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-amber-600">
                  <span>Extract Combined Roster</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
