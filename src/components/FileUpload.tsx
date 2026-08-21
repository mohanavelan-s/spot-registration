import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw, Sparkles, FileText } from 'lucide-react';
import { ColumnMapping } from '../types';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  onLoadSample: () => void;
  isLoading: boolean;
  columnMapping?: ColumnMapping | null;
  error?: string | null;
  warnings?: string[];
  sheetNames?: string[];
  activeSheet?: string;
  onSelectSheet?: (sheetName: string) => void;
  currentFileName?: string | null;
  totalRegistrations?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  onLoadSample,
  isLoading,
  columnMapping,
  error,
  warnings,
  sheetNames,
  activeSheet,
  onSelectSheet,
  currentFileName,
  totalRegistrations
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await onFileUpload(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onFileUpload(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Registration Database Input
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload Excel (.xlsx, .xls) or CSV database from Google Forms or symposium portals
          </p>
        </div>

        {/* Fast Action: Load Official AIROX '26 Sample Dataset */}
        <div className="flex items-center gap-2">
          <button
            id="btn-load-sample-dataset"
            onClick={onLoadSample}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Load AIROX '26 Database (321 Registrations)</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        id="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
          id="registration-file-input"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            {isLoading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            ) : (
              <UploadCloud className="w-6 h-6 text-indigo-600" />
            )}
          </div>

          <div className="text-sm font-semibold text-slate-800">
            {isLoading ? (
              'Parsing and normalizing database...'
            ) : (
              <>
                <span className="text-indigo-600 hover:underline">Click to browse</span> or drag and drop your spreadsheet here
              </>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Supports <strong className="text-slate-700">.xlsx</strong>, <strong className="text-slate-700">.xls</strong>, and <strong className="text-slate-700">.csv</strong> formats. Dynamically maps headers and comma-separated events.
          </p>
        </div>
      </div>

      {/* Active File & Sheet Selection Indicator */}
      {currentFileName && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">Active File:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
              {currentFileName}
            </span>
            <span className="text-slate-500 font-medium">({totalRegistrations} rows parsed)</span>
          </div>

          {sheetNames && sheetNames.length > 1 && onSelectSheet && (
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium">Select Sheet:</span>
              <select
                id="select-sheet"
                value={activeSheet}
                onChange={e => onSelectSheet(e.target.value)}
                className="bg-white border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {sheetNames.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Column Mapping Feedback Summary */}
      {columnMapping && (
        <div className="mt-3 p-4 rounded-xl bg-slate-50/90 border border-slate-200 text-xs">
          <div className="font-bold text-slate-800 mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Auto-Detected Column Mappings
            </span>
            <span className="text-[11px] font-normal text-slate-500">Deterministic 4-Tier Independent Matching</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-[11px]">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 font-semibold">Registration ID</span>
              <div className="text-slate-800 font-mono font-medium text-xs mt-1 truncate flex items-center gap-1">
                <span className="text-slate-400">→</span>
                <span>{columnMapping.registrationIdKey || <span className="text-amber-600 font-sans">Auto-Generated</span>}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 font-semibold">Full Name</span>
              <div className="text-slate-800 font-mono font-medium text-xs mt-1 truncate flex items-center gap-1">
                <span className="text-slate-400">→</span>
                <span>{columnMapping.fullNameKey || <span className="text-rose-600 font-sans">Missing</span>}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-indigo-200 shadow-xs flex flex-col justify-between">
              <span className="text-indigo-800 font-semibold">Technical Events</span>
              <div className="text-indigo-700 font-mono font-bold text-xs mt-1 truncate flex items-center gap-1">
                <span className="text-indigo-400">→</span>
                <span>{columnMapping.technicalEventsKey || <span className="text-slate-400 font-sans font-normal">None</span>}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-cyan-200 shadow-xs flex flex-col justify-between">
              <span className="text-cyan-800 font-semibold">Non-Technical Events</span>
              <div className="text-cyan-700 font-mono font-bold text-xs mt-1 truncate flex items-center gap-1">
                <span className="text-cyan-400">→</span>
                <span>{columnMapping.nonTechnicalEventsKey || <span className="text-slate-400 font-sans font-normal">None</span>}</span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 font-semibold">Verification Status</span>
              <div className="text-emerald-700 font-mono font-medium text-xs mt-1 truncate flex items-center gap-1">
                <span className="text-slate-400">→</span>
                <span>{columnMapping.verificationStatusKey || <span className="text-slate-400 font-sans">Default (Verified)</span>}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">File Upload Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Warnings Display */}
      {warnings && warnings.length > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Parsing Notice</div>
            <ul className="list-disc list-inside space-y-0.5 mt-0.5">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
