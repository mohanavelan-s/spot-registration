import React, { useState, useEffect } from 'react';
import { X, Edit3, CheckCircle2, AlertCircle } from 'lucide-react';
import { OfflineRegistrationRecord } from '../../types';
import { defaultNormalizer } from '../../utils/normalizer';
import { formatTimestamp } from '../../services/googleSheetsService';

interface EditOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: OfflineRegistrationRecord | null;
  onSave: (updatedRecord: OfflineRegistrationRecord) => Promise<void>;
  currentCoordinator: string;
}

export const EditOfflineModal: React.FC<EditOfflineModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  currentCoordinator
}) => {
  const [formData, setFormData] = useState<OfflineRegistrationRecord | null>(null);
  const [selectedEventsList, setSelectedEventsList] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setFormData({ ...record });
      // Parse events into array of strings
      const rawEvents = record.event
        .split(/[,;\n\r|]/)
        .map(e => e.trim())
        .filter(Boolean);
      setSelectedEventsList(rawEvents);
    }
  }, [record]);

  if (!isOpen || !formData) return null;

  const canonicalEvents = defaultNormalizer.getCanonicalEventsList();
  const techEvents = canonicalEvents.filter(e => e.category === 'Technical' || e.category === 'Both');
  const nonTechEvents = canonicalEvents.filter(e => e.category === 'Non-Technical');

  const toggleEventSelection = (displayName: string) => {
    setSelectedEventsList(prev => {
      const exists = prev.includes(displayName);
      const next = exists
        ? prev.filter(e => e !== displayName)
        : [...prev, displayName];
      return next;
    });
    if (errors.selectedEvents) {
      setErrors(prev => ({ ...prev, selectedEvents: '' }));
    }
  };

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full Name is required';
    if (!formData.mobile.trim()) errs.mobile = 'Mobile number is required';
    if (!formData.college.trim()) errs.college = 'College is required';
    if (selectedEventsList.length === 0) errs.selectedEvents = 'Select at least one event';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const updated: OfflineRegistrationRecord = {
        ...formData,
        event: selectedEventsList.join(', '),
        updatedAt: formatTimestamp(),
        updatedBy: currentCoordinator || 'Desk Admin'
      };
      await onSave(updated);
      onClose();
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to update registration' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Edit Offline Registration</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 text-indigo-200">
                  {formData.offlineRegistrationId}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Update participant details while preserving audit history
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errors.submit && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Audit Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
            <div>
              <span className="text-slate-400 block">Registered At:</span>
              <span className="font-semibold text-slate-800">{formData.registeredAt || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Registered By:</span>
              <span className="font-semibold text-slate-800">{formData.registeredBy || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Last Updated At:</span>
              <span className="font-semibold text-slate-800">{formData.updatedAt || 'Not updated yet'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Last Updated By:</span>
              <span className="font-semibold text-slate-800">{formData.updatedBy || 'N/A'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => setFormData(p => (p ? { ...p, fullName: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {errors.fullName && <p className="text-[11px] text-rose-500 mt-1">{errors.fullName}</p>}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={e => setFormData(p => (p ? { ...p, mobile: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {errors.mobile && <p className="text-[11px] text-rose-500 mt-1">{errors.mobile}</p>}
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(p => (p ? { ...p, email: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* College / Institution */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                College / Institution <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.college}
                onChange={e => setFormData(p => (p ? { ...p, college: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {errors.college && <p className="text-[11px] text-rose-500 mt-1">{errors.college}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={e => setFormData(p => (p ? { ...p, department: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Year / Section */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Year / Section</label>
              <input
                type="text"
                value={formData.yearSection}
                onChange={e => setFormData(p => (p ? { ...p, yearSection: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Event Selection */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Registered Event(s) <span className="text-rose-500">*</span>
            </label>

            {/* Tech Events */}
            <div className="mb-2">
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block mb-1">
                Technical Events
              </span>
              <div className="flex flex-wrap gap-2">
                {techEvents.map(ev => {
                  const isSelected = selectedEventsList.includes(ev.displayName);
                  return (
                    <button
                      key={ev.key}
                      type="button"
                      onClick={() => toggleEventSelection(ev.displayName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{ev.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Non Tech Events */}
            <div>
              <span className="text-[11px] font-semibold text-cyan-700 uppercase tracking-wider block mb-1">
                Non-Technical Events
              </span>
              <div className="flex flex-wrap gap-2">
                {nonTechEvents.map(ev => {
                  const isSelected = selectedEventsList.includes(ev.displayName);
                  return (
                    <button
                      key={ev.key}
                      type="button"
                      onClick={() => toggleEventSelection(ev.displayName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>{ev.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {errors.selectedEvents && (
              <p className="text-[11px] text-rose-500 mt-1">{errors.selectedEvents}</p>
            )}
          </div>

          {/* Team Name & Verification Status & Record Status */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Team Name</label>
              <input
                type="text"
                value={formData.teamName}
                onChange={e => setFormData(p => (p ? { ...p, teamName: e.target.value } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Verification Status</label>
              <select
                value={formData.verificationStatus}
                onChange={e =>
                  setFormData(p => (p ? { ...p, verificationStatus: e.target.value as any } : null))
                }
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Registration Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData(p => (p ? { ...p, status: e.target.value as any } : null))}
                className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="CANCELLED">CANCELLED (Soft-Deleted)</option>
              </select>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Saving Changes...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
