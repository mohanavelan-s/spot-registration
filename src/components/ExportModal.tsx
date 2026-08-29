import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Check, X, CheckSquare, Square } from 'lucide-react';
import { Participant } from '../types';
import {
  DEFAULT_EXPORT_COLUMNS,
  ExportColumnOption,
  exportToCSV,
  exportToXLSX,
  generateExportFilename
} from '../utils/exporter';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  selectedParticipantIds: Set<string>;
  onlySelected: boolean;
  selectedEventDisplayName: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  participants,
  selectedParticipantIds,
  onlySelected: initialOnlySelected,
  selectedEventDisplayName
}) => {
  useBodyScrollLock(isOpen);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>(
    initialOnlySelected && selectedParticipantIds.size > 0 ? 'selected' : 'all'
  );
  const [columns, setColumns] = useState<ExportColumnOption[]>(DEFAULT_EXPORT_COLUMNS);

  if (!isOpen) return null;

  const targetParticipants =
    exportScope === 'selected' && selectedParticipantIds.size > 0
      ? participants.filter(p => selectedParticipantIds.has(p.id))
      : participants;

  const eventName = selectedEventDisplayName || 'All_Participants';
  const filename = generateExportFilename(eventName, format);

  const toggleColumn = (key: string) => {
    setColumns(prev =>
      prev.map(col => (col.key === key ? { ...col, enabled: !col.enabled } : col))
    );
  };

  const selectAllColumns = (enabled: boolean) => {
    setColumns(prev => prev.map(col => ({ ...col, enabled })));
  };

  const handleExport = () => {
    if (format === 'xlsx') {
      exportToXLSX(targetParticipants, eventName, columns);
    } else {
      exportToCSV(targetParticipants, eventName, columns);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Export Extracted Participants</h3>
              <p className="text-xs text-slate-300">
                {selectedEventDisplayName ? `Event: ${selectedEventDisplayName}` : 'All Symposium Registrations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setFormat('xlsx')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                  format === 'xlsx'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileSpreadsheet className={`w-6 h-6 ${format === 'xlsx' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs text-slate-900">Excel (.xlsx)</div>
                  <div className="text-[11px] text-slate-500">Includes formatted columns & summary sheet</div>
                </div>
              </div>

              <div
                onClick={() => setFormat('csv')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                  format === 'csv'
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <FileText className={`w-6 h-6 ${format === 'csv' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs text-slate-900">CSV (.csv)</div>
                  <div className="text-[11px] text-slate-500">Universal comma-separated format</div>
                </div>
              </div>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Participants to Include ({targetParticipants.length})
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                  exportScope === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Filtered ({participants.length})
              </button>

              <button
                type="button"
                onClick={() => setExportScope('selected')}
                disabled={selectedParticipantIds.size === 0}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  exportScope === 'selected'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Only Selected Checkboxes ({selectedParticipantIds.size})
              </button>
            </div>
          </div>

          {/* Columns Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Include Columns
              </label>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => selectAllColumns(true)}
                  className="text-indigo-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => selectAllColumns(false)}
                  className="text-slate-500 hover:underline font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              {columns.map(col => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-800 text-[11px] truncate">{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filename Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 block text-[11px]">Output Filename:</span>
            <span className="font-mono font-semibold text-indigo-700 text-xs break-all">
              {filename}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={targetParticipants.length === 0 || !columns.some(c => c.enabled)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
