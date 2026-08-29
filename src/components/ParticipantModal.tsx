import React from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  Award,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Tag,
  Globe,
  ClipboardList,
  Calendar,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { Participant } from '../types';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ParticipantModalProps {
  participant: Participant | null;
  onClose: () => void;
  onStatusChange: (id: string, newStatus: 'Verified' | 'Pending' | 'Rejected') => void;
}

export const ParticipantModal: React.FC<ParticipantModalProps> = ({
  participant,
  onClose,
  onStatusChange
}) => {
  useBodyScrollLock(Boolean(participant));
  if (!participant) return null;

  const isOnline = participant.source === 'ONLINE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0">
              {participant.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">{participant.fullName}</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                  {participant.registrationId}
                </span>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    <Globe className="w-2.5 h-2.5" />
                    ONLINE
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                    <ClipboardList className="w-2.5 h-2.5" />
                    OFFLINE
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">{participant.college}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Duplicate Alert Banner if flagged */}
          {participant.isPossibleDuplicate && participant.duplicateInfo && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <div className="font-bold">Cross-Registration Notice</div>
                <div className="mt-0.5">{participant.duplicateInfo.reason}</div>
                <div className="text-[11px] text-amber-700 mt-1 font-mono">
                  Matching Registration: {participant.duplicateInfo.matchedId} ({participant.duplicateInfo.matchedSource}) - {participant.duplicateInfo.matchedName}
                </div>
              </div>
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                Email Address
              </div>
              <div className="text-sm font-medium text-slate-900 break-all select-all">
                {participant.email || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                Mobile / Contact
              </div>
              <div className="text-sm font-medium text-slate-900 select-all font-mono">
                {participant.mobile || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-600" />
                College / Institution
              </div>
              <div className="text-sm font-medium text-slate-900">
                {participant.college || 'N/A'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                Department & Year
              </div>
              <div className="text-sm font-medium text-slate-900">
                {participant.department || 'N/A'} {participant.yearSection ? `(${participant.yearSection})` : ''}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Participation Mode
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">
                  {participant.participationMode || 'Individual'}
                </span>
                {participant.teamName && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-semibold">
                    Team: {participant.teamName}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500 font-semibold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Registration Metadata
              </div>
              <div className="text-xs text-slate-700 font-mono">
                <div>Source: <strong className="text-slate-900">{participant.source}</strong></div>
                {participant.registeredAt && <div>Time: {participant.registeredAt}</div>}
                {participant.registeredBy && <div>By: {participant.registeredBy}</div>}
              </div>
            </div>
          </div>

          {/* Registered Events Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              Registered Canonical Events
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Technical Events */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                <div className="text-xs font-bold text-indigo-900 mb-1 flex items-center justify-between">
                  <span>Technical Events</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-indigo-200 text-indigo-800 rounded font-semibold">
                    {participant.technicalEvents.length} Events
                  </span>
                </div>
                {participant.technicalEventsRaw && (
                  <div className="text-xs text-slate-600 mb-2 italic">
                    Raw: "{participant.technicalEventsRaw}"
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {participant.technicalEvents.length > 0 ? (
                    participant.technicalEvents.map((evKey, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-xs"
                      >
                        {evKey}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No technical events registered</span>
                  )}
                </div>
              </div>

              {/* Non-Technical Events */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                <div className="text-xs font-bold text-amber-900 mb-1 flex items-center justify-between">
                  <span>Non-Technical Events</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-800 rounded font-semibold">
                    {participant.nonTechnicalEvents.length} Events
                  </span>
                </div>
                {participant.nonTechnicalEventsRaw && (
                  <div className="text-xs text-slate-600 mb-2 italic">
                    Raw: "{participant.nonTechnicalEventsRaw}"
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {participant.nonTechnicalEvents.length > 0 ? (
                    participant.nonTechnicalEvents.map((evKey, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold shadow-xs"
                      >
                        {evKey}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No non-technical events registered</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verification Status Controls */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Symposium Verification Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onStatusChange(participant.id, 'Verified')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  participant.verificationStatus === 'Verified'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verified</span>
              </button>

              <button
                type="button"
                onClick={() => onStatusChange(participant.id, 'Pending')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  participant.verificationStatus === 'Pending'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Pending</span>
              </button>

              <button
                type="button"
                onClick={() => onStatusChange(participant.id, 'Rejected')}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  participant.verificationStatus === 'Rejected'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                }`}
              >
                <XCircle className="w-4 h-4" />
                <span>Rejected</span>
              </button>
            </div>
          </div>

          {/* Raw Record Inspector */}
          {participant.rawRow && Object.keys(participant.rawRow).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Raw Database Fields Preserved
              </h4>
              <div className="p-3 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono max-h-36 overflow-y-auto space-y-1">
                {Object.entries(participant.rawRow).map(([key, val]) => (
                  <div key={key} className="flex">
                    <span className="text-indigo-400 font-semibold min-w-[160px] truncate">{key}:</span>
                    <span className="text-slate-300 break-all">{String(val || '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
