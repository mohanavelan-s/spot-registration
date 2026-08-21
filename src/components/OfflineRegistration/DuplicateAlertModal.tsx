import React from 'react';
import { AlertTriangle, UserCheck, ShieldAlert, X, ArrowRight, CornerDownRight } from 'lucide-react';
import { DuplicateCheckResult, OfflineRegistrationFormData } from '../../types';

interface DuplicateAlertModalProps {
  isOpen: boolean;
  duplicateInfo: DuplicateCheckResult | null;
  pendingFormData: OfflineRegistrationFormData | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DuplicateAlertModal: React.FC<DuplicateAlertModalProps> = ({
  isOpen,
  duplicateInfo,
  pendingFormData,
  onConfirm,
  onCancel
}) => {
  if (!isOpen || !duplicateInfo || !pendingFormData) return null;

  const matched = duplicateInfo.matchedRecord;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-amber-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-amber-50 border-b border-amber-100 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-900">
                Possible Duplicate Registration Detected
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {duplicateInfo.message || 'A participant with matching contact details already exists.'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-amber-500 hover:text-amber-800 hover:bg-amber-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comparison Details */}
        <div className="p-5 space-y-4 text-xs">
          {matched && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Existing Registered Record ({matched.source})
                </span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">
                  {matched.id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400 block">Name:</span>
                  <span className="font-semibold text-slate-900">{matched.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Mobile:</span>
                  <span className="font-semibold text-slate-900">{matched.mobile}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">College:</span>
                  <span className="font-semibold text-slate-900 truncate block">{matched.college}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Event(s):</span>
                  <span className="font-semibold text-indigo-700 truncate block">{matched.events}</span>
                </div>
              </div>
            </div>
          )}

          {/* New Entry Details */}
          <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <CornerDownRight className="w-4 h-4 text-indigo-600" />
                New Offline Entry Attempt
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-semibold">
                Pending Creation
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-indigo-100">
              <div>
                <span className="text-slate-400 block">Name:</span>
                <span className="font-semibold text-slate-900">{pendingFormData.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Mobile:</span>
                <span className="font-semibold text-slate-900">{pendingFormData.mobile}</span>
              </div>
              <div>
                <span className="text-slate-400 block">College:</span>
                <span className="font-semibold text-slate-900 truncate block">{pendingFormData.college}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Event(s):</span>
                <span className="font-semibold text-indigo-700 truncate block">
                  {pendingFormData.selectedEvents.join(', ')}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-800 text-[11px] leading-relaxed">
            <strong>Desk Policy:</strong> If this is an additional event registration for an existing attendee or a separate team member, you may confirm and create the entry. Otherwise, cancel to avoid double billing.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
          >
            Cancel & Correct Form
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <span>Confirm & Register Anyway</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
