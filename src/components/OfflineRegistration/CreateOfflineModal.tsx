import React, { useState } from 'react';
import { X, UserPlus, CheckCircle2, AlertCircle, Sparkles, Building2, Phone, Mail, BookOpen, Users } from 'lucide-react';
import { OfflineRegistrationFormData, OfflineRegistrationRecord, Participant } from '../../types';
import { defaultNormalizer } from '../../utils/normalizer';
import { checkDuplicateRegistration } from '../../services/googleSheetsService';
import { DuplicateAlertModal } from './DuplicateAlertModal';
import { CustomSelect } from '../ui/CustomSelect';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface CreateOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: OfflineRegistrationFormData) => Promise<void>;
  existingRecords: OfflineRegistrationRecord[];
  onlineParticipants: Participant[];
  currentCoordinator: string;
}

export const CreateOfflineModal: React.FC<CreateOfflineModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingRecords,
  onlineParticipants,
  currentCoordinator
}) => {
  useBodyScrollLock(isOpen);
  const [formData, setFormData] = useState<OfflineRegistrationFormData>({
    fullName: '',
    email: '',
    mobile: '',
    college: '',
    department: '',
    yearSection: '',
    selectedEvents: [],
    teamName: '',
    verificationStatus: 'Verified',
    registeredBy: currentCoordinator || 'Desk Admin'
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);

  if (!isOpen) return null;

  // Retrieve canonical events from the central normalizer registry
  const canonicalEvents = defaultNormalizer.getCanonicalEventsList();
  const techEvents = canonicalEvents.filter(e => e.category === 'Technical' || e.category === 'Both');
  const nonTechEvents = canonicalEvents.filter(e => e.category === 'Non-Technical');

  const toggleEventSelection = (displayName: string) => {
    setFormData(prev => {
      const exists = prev.selectedEvents.includes(displayName);
      const next = exists
        ? prev.selectedEvents.filter(e => e !== displayName)
        : [...prev.selectedEvents, displayName];
      return { ...prev, selectedEvents: next };
    });
    if (errors.selectedEvents) {
      setErrors(prev => ({ ...prev, selectedEvents: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!formData.fullName.trim()) {
      errs.fullName = 'Full Name is required';
    }

    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!formData.mobile.trim()) {
      errs.mobile = 'Mobile number is required';
    } else if (cleanMobile.length < 10) {
      errs.mobile = 'Enter a valid 10-digit mobile number';
    }

    if (!formData.college.trim()) {
      errs.college = 'College / Institution is required';
    }

    if (formData.selectedEvents.length === 0) {
      errs.selectedEvents = 'Please select at least one event';
    }

    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check for potential duplicate registration
    const dupCheck = checkDuplicateRegistration(formData, existingRecords, onlineParticipants);
    if (dupCheck.isDuplicate) {
      setDuplicateInfo(dupCheck);
      setDuplicateModalOpen(true);
      return;
    }

    // Proceed to create
    await executeRegistration();
  };

  const executeRegistration = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        mobile: '',
        college: '',
        department: '',
        yearSection: '',
        selectedEvents: [],
        teamName: '',
        verificationStatus: 'Verified',
        registeredBy: currentCoordinator || 'Desk Admin'
      });
      setDuplicateModalOpen(false);
      onClose();
    } catch (err: any) {
      setErrors(prev => ({ ...prev, submit: err.message || 'Failed to submit registration' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">New Offline Registration</h3>
                <p className="text-xs text-slate-300">
                  On-spot participant registration for AIROX'26 symposium
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

          {/* Form Content */}
          <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
            {errors.submit && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.submit}</span>
              </div>
            )}

            {/* Primary Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={formData.fullName}
                  onChange={e => {
                    setFormData(p => ({ ...p, fullName: e.target.value }));
                    if (errors.fullName) setErrors(p => ({ ...p, fullName: '' }));
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${
                    errors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                />
                {errors.fullName && <p className="text-[11px] text-rose-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs pointer-events-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={formData.mobile}
                    onChange={e => {
                      setFormData(p => ({ ...p, mobile: e.target.value }));
                      if (errors.mobile) setErrors(p => ({ ...p, mobile: '' }));
                    }}
                    className={`w-full pl-10 pr-3 py-2 rounded-xl text-xs border ${
                      errors.mobile ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                    } focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono`}
                  />
                </div>
                {errors.mobile && <p className="text-[11px] text-rose-500 mt-1">{errors.mobile}</p>}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="rahul@example.com"
                  value={formData.email}
                  onChange={e => {
                    setFormData(p => ({ ...p, email: e.target.value }));
                    if (errors.email) setErrors(p => ({ ...p, email: '' }));
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${
                    errors.email ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                />
                {errors.email && <p className="text-[11px] text-rose-500 mt-1">{errors.email}</p>}
              </div>

              {/* College / Institution */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  College / Institution <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. PSG College of Technology"
                  value={formData.college}
                  onChange={e => {
                    setFormData(p => ({ ...p, college: e.target.value }));
                    if (errors.college) setErrors(p => ({ ...p, college: '' }));
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs border ${
                    errors.college ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                  } focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500`}
                />
                {errors.college && <p className="text-[11px] text-rose-500 mt-1">{errors.college}</p>}
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. CSE / IT / ECE"
                  value={formData.department}
                  onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Year / Section */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Year / Section
                </label>
                <input
                  type="text"
                  placeholder="e.g. III Year / A"
                  value={formData.yearSection}
                  onChange={e => setFormData(p => ({ ...p, yearSection: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Event Selection (From Canonical Registry) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-900">
                  Select Event(s) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {formData.selectedEvents.length} selected
                </span>
              </div>

              {/* Technical Events */}
              <div className="mb-3">
                <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block mb-1.5">
                  Technical Events
                </span>
                <div className="flex flex-wrap gap-2">
                  {techEvents.map(ev => {
                    const isSelected = formData.selectedEvents.includes(ev.displayName);
                    return (
                      <button
                        key={ev.key}
                        type="button"
                        onClick={() => toggleEventSelection(ev.displayName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{ev.displayName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Non-Technical Events */}
              <div>
                <span className="text-[11px] font-semibold text-cyan-700 uppercase tracking-wider block mb-1.5">
                  Non-Technical Events
                </span>
                <div className="flex flex-wrap gap-2">
                  {nonTechEvents.map(ev => {
                    const isSelected = formData.selectedEvents.includes(ev.displayName);
                    return (
                      <button
                        key={ev.key}
                        type="button"
                        onClick={() => toggleEventSelection(ev.displayName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/30'
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
                <p className="text-[11px] text-rose-500 mt-1.5">{errors.selectedEvents}</p>
              )}
            </div>

            {/* Team Name & Status & Coordinator */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Team Name <span className="text-slate-400 font-normal">(if team event)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CyberKnights"
                  value={formData.teamName}
                  onChange={e => setFormData(p => ({ ...p, teamName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verification Status
                </label>
                <CustomSelect
                  id="select-create-verification-status"
                  value={formData.verificationStatus}
                  onChange={val => setFormData(p => ({ ...p, verificationStatus: val as any }))}
                  options={[
                    { value: 'Verified', label: 'Verified (Paid / Approved)' },
                    { value: 'Pending', label: 'Pending' },
                    { value: 'Rejected', label: 'Rejected' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registered By
                </label>
                <input
                  type="text"
                  placeholder="Desk Coordinator"
                  value={formData.registeredBy}
                  onChange={e => setFormData(p => ({ ...p, registeredBy: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
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
              onClick={handleFormSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving Registration...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Offline Registration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Check Warning Modal */}
      <DuplicateAlertModal
        isOpen={duplicateModalOpen}
        duplicateInfo={duplicateInfo}
        pendingFormData={formData}
        onConfirm={executeRegistration}
        onCancel={() => setDuplicateModalOpen(false)}
      />
    </>
  );
};
