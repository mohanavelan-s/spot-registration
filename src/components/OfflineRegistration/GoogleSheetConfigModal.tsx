import React, { useState, useEffect } from 'react';
import { X, FileSpreadsheet, CheckCircle, ExternalLink, RefreshCw, AlertCircle, ShieldCheck, PlayCircle, Wrench, Globe } from 'lucide-react';
import { offlineApiClient, onlineApiClient } from '../../services/googleSheetsService';

interface GoogleSheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string;
  onSaveSheetId: (newId: string) => void;
  onRefreshData: () => Promise<void>;
}

export const GoogleSheetConfigModal: React.FC<GoogleSheetConfigModalProps> = ({
  isOpen,
  onClose,
  sheetId,
  onSaveSheetId,
  onRefreshData
}) => {
  const [inputSheetId, setInputSheetId] = useState(sheetId);
  const [onlineSheetId, setOnlineSheetId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    setInputSheetId(sheetId);
    // Also load online sheet id config
    onlineApiClient.getConfig().then(cfg => {
      if (cfg && cfg.sheetId) {
        setOnlineSheetId(cfg.sheetId);
      }
    }).catch(() => {});
  }, [sheetId, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const cleanId = inputSheetId.trim();
    const cleanOnlineId = onlineSheetId.trim();
    try {
      await offlineApiClient.setConfig(cleanId);
      if (cleanOnlineId !== undefined) {
        await onlineApiClient.setConfig(cleanOnlineId);
      }
      onSaveSheetId(cleanId);
      setStatusMessage({ type: 'success', text: 'Google Sheet configuration saved to server!' });
      await onRefreshData();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update Google Sheet ID.' });
    }
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      await onRefreshData();
      setStatusMessage({ type: 'success', text: 'Synchronized latest data from Google Sheets successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Unable to sync with Google Sheets.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiag(true);
    setStatusMessage(null);
    try {
      const res = await offlineApiClient.getDiagnostics();
      setDiagResult(res);
      if (res.error) {
        setStatusMessage({ type: 'error', text: `Diagnostic Error: ${res.error}` });
      } else {
        setStatusMessage({ type: 'success', text: `Connected! Spreadsheet "${res.spreadsheetTitle}" found with ${res.rowCount || 0} rows.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Diagnostic failed' });
    } finally {
      setIsRunningDiag(false);
    }
  };

  const handleExecuteTestWrite = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await offlineApiClient.executeTestWrite();
      setStatusMessage({ type: 'success', text: res.message });
      await onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Test Write Failed: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Google Sheets Backend Configuration</h3>
              <p className="text-xs text-slate-300">
                Authoritative Primary Storage for Offline Registrations
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {statusMessage.type === 'info' && <CheckCircle className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Actionable Permissions Guide Banner */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                Google Sheet Access & Permission Setup
              </span>
              <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                Required for 403 Errors
              </span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              If you receive <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-950 font-bold">Permission Denied (403)</code>, your Google Spreadsheet is not shared with the backend service account. Follow these 2 quick steps:
            </p>
            <ol className="list-decimal list-inside text-[11px] space-y-1.5 pl-1 text-amber-900 font-medium">
              <li>
                Open your Google Sheet and click the green/blue <b>Share</b> button in the top-right.
              </li>
              <li>
                Add the backend service account email below as an <b>Editor</b> and uncheck "Notify people":
              </li>
            </ol>
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-100/90 border border-amber-300">
              <code className="font-mono text-[10.5px] font-bold text-amber-950 break-all select-all">
                firebase-adminsdk-fbsvc@gen-lang-client-0668725337.iam.gserviceaccount.com
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText('firebase-adminsdk-fbsvc@gen-lang-client-0668725337.iam.gserviceaccount.com');
                  setStatusMessage({ type: 'info', text: 'Service account email copied to clipboard!' });
                }}
                className="px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white font-bold text-[10px] shrink-0 transition"
              >
                Copy Email
              </button>
            </div>
          </div>

          {/* Architecture Details Banner */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Server-Side Authoritative Architecture
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-semibold text-[10px]">
                <CheckCircle className="w-3 h-3" />
                Google Sheets Authoritative
              </span>
            </div>
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Google Sheets is the authoritative storage. All writes must confirm success with the Google Sheets API before records are marked successful.
            </p>
          </div>

          {/* Sheet ID Inputs */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Offline Registration Sheet ID (<code className="font-mono text-emerald-700">OFFLINE_REGISTRATION_SHEET_ID</code>)
              </label>
              <input
                type="text"
                placeholder="e.g. 1CttdPVNnjildPxfPA40rIw-8NnvU_qxG3zgSesmV6mQ"
                value={inputSheetId}
                onChange={e => setInputSheetId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Online Registration Sheet ID (<code className="font-mono text-sky-700">ONLINE_REGISTRATION_SHEET_ID</code>)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Optional Google Sheet ID for online registrations"
                  value={onlineSheetId}
                  onChange={e => setOnlineSheetId(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shrink-0"
                >
                  Save All
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Extracted from URL: <code className="text-slate-600 font-mono">docs.google.com/spreadsheets/d/<b>[SHEET_ID]</b>/edit</code>
            </p>
          </div>

          {/* Live Diagnostics & Test Write Controls */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
                Connectivity Diagnostics & Verification
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRunDiagnostics}
                  disabled={isRunningDiag}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium text-[11px] flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isRunningDiag ? 'animate-spin' : ''}`} />
                  Check Connection
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTestWrite}
                  disabled={isTesting}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <PlayCircle className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                  Test Write (TEST-AIROX26)
                </button>
              </div>
            </div>

            {diagResult && (
              <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5 text-[11px]">
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800">Auth Method:</span> {diagResult.authMethod}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">API Enabled:</span>{' '}
                    <span className={diagResult.apiEnabled ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                      {diagResult.apiEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Service Account:</span>{' '}
                    <span className="font-mono text-[10px] break-all">{diagResult.serviceAccountEmail || 'Default ADC'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Target Tab:</span>{' '}
                    <span className="font-mono text-emerald-700 font-bold">{diagResult.targetTab || 'N/A'}</span>
                  </div>
                </div>

                {diagResult.availableTabs && diagResult.availableTabs.length > 0 && (
                  <div className="pt-1 border-t border-slate-100">
                    <span className="font-semibold text-slate-700">Available Tabs: </span>
                    <span className="font-mono text-slate-600">[{diagResult.availableTabs.join(', ')}]</span>
                  </div>
                )}

                {diagResult.recommendations && diagResult.recommendations.length > 0 && (
                  <div className="pt-1 border-t border-slate-100 space-y-1">
                    <span className="font-semibold text-amber-700 block">Actions Required:</span>
                    {diagResult.recommendations.map((rec: string, i: number) => (
                      <p key={i} className="text-amber-800 text-[10px] bg-amber-50 p-1.5 rounded border border-amber-200">
                        {rec}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expected Headers Reference */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-800 block text-xs">Standard Google Sheet Columns (Auto-Mapped)</span>
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                'Offline Registration ID',
                'Full Name',
                'Email Address',
                'Mobile Number',
                'College / Institution',
                'Department',
                'Year / Section',
                'Event',
                'Team Name',
                'Verification Status',
                'Registered At',
                'Registered By',
                'Updated At',
                'Updated By',
                'Status'
              ].map(h => (
                <span key={h} className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-mono">
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Offline Registrations'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
