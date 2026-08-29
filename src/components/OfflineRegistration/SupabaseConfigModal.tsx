import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  PlayCircle,
  Wrench,
  Copy,
  Check,
  Zap,
  Server,
  Code
} from 'lucide-react';
import { supabaseApiClient } from '../../services/supabaseService';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onRefreshData
}) => {
  useBodyScrollLock(isOpen);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [tableName, setTableName] = useState('offline_registrations');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [sqlScript, setSqlScript] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'sql' | 'sync'>('connection');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const config = await supabaseApiClient.getConfig();
      if (config.supabaseUrl) setSupabaseUrl(config.supabaseUrl);
      if (config.supabaseAnonKey && !config.supabaseAnonKey.includes('...')) {
        setSupabaseAnonKey(config.supabaseAnonKey);
      }
      if (config.tableName) setTableName(config.tableName);

      const sqlRes = await supabaseApiClient.getSqlMigrationScript();
      if (sqlRes.sql) setSqlScript(sqlRes.sql);

      // Automatically run quick diagnostics
      handleRunDiagnostics();
    } catch (e) {
      console.warn('Failed to load Supabase config:', e);
    }
  };

  if (!isOpen) return null;

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await supabaseApiClient.setConfig({
        supabaseUrl: supabaseUrl.trim(),
        supabaseAnonKey: supabaseAnonKey.trim(),
        tableName: tableName.trim()
      });
      setStatusMessage({ type: 'success', text: 'Supabase configuration saved successfully!' });
      await handleRunDiagnostics();
      await onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update Supabase configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiag(true);
    try {
      const res = await supabaseApiClient.getDiagnostics();
      setDiagResult(res);
      if (res.isConnected && res.tableExists) {
        setStatusMessage({
          type: 'success',
          text: `Connected to Supabase! Table "${res.tableName}" is ready (${res.rowCount} records found, ${res.latencyMs || 0}ms latency).`
        });
      } else if (res.isConnected && !res.tableExists) {
        setStatusMessage({
          type: 'info',
          text: `Connected to Supabase project, but table "${res.tableName}" was not found. Please run the SQL migration script.`
        });
      } else if (res.error) {
        setStatusMessage({ type: 'error', text: res.error });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Diagnostics failed' });
    } finally {
      setIsRunningDiag(false);
    }
  };

  const handleTriggerPullSync = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const res = await supabaseApiClient.syncRegistrations();
      await onRefreshData();
      setStatusMessage({ type: 'success', text: res.message || 'Synchronized latest data from Supabase successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Unable to sync with Supabase.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushSync = async () => {
    setIsPushing(true);
    setStatusMessage(null);
    try {
      const res = await supabaseApiClient.pushSyncToSupabase();
      setStatusMessage({ type: 'success', text: res.message || `Successfully synced ${res.syncedCount} records to Supabase!` });
      await onRefreshData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to push sync to Supabase: ${err.message}` });
    } finally {
      setIsPushing(false);
    }
  };

  const handleExecuteTestWrite = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await supabaseApiClient.executeTestWrite();
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        await onRefreshData();
        await handleRunDiagnostics();
      } else {
        setStatusMessage({ type: 'error', text: `Test Write Failed: ${res.error || res.message}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Test Write Failed: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopySql = () => {
    if (sqlScript) {
      navigator.clipboard.writeText(sqlScript);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Supabase Database Setup & Sync
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  PostgreSQL
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time cloud database persistence and synchronization for AIROX'26 offline registrations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6 pt-2">
          <button
            onClick={() => setActiveTab('connection')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-2 ${
              activeTab === 'connection'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Connection & Credentials
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            SQL Schema Migration
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 flex items-center gap-2 ${
              activeTab === 'sync'
                ? 'border-emerald-500 text-emerald-400 bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Live Sync & Diagnostics
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: Connection & Credentials */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Supabase Project URL</span>
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      Supabase Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={e => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzabcdefgh.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Found in Supabase Dashboard → Project Settings → API → Project URL
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Supabase Anon Public API Key / Service Key
                  </label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={e => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Found in Supabase Dashboard → Project Settings → API → Project API keys (<code className="text-emerald-300">anon public</code> or <code className="text-emerald-300">service_role</code>)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    PostgreSQL Target Table
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    placeholder="offline_registrations"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono text-xs focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleRunDiagnostics}
                  disabled={isRunningDiag}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiag ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save & Connect Supabase'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SQL Schema Migration */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Supabase SQL Table Migration</h4>
                  <p className="text-[11px] text-slate-400">
                    Paste this into your Supabase Dashboard SQL Editor to initialize the table with RLS policies and indexes.
                  </p>
                </div>
                <button
                  onClick={handleCopySql}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed">
                  {sqlScript || `-- SQL Schema is ready for ${tableName}`}
                </pre>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-emerald-400">How to execute in Supabase:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-400 text-[11px]">
                  <li>Open your Supabase project at <code className="text-slate-200">supabase.com/dashboard</code></li>
                  <li>Click on <strong>SQL Editor</strong> on the left sidebar</li>
                  <li>Click <strong>New query</strong>, paste the copied SQL above, and click <strong>Run</strong></li>
                  <li>Your <code className="text-slate-200">{tableName}</code> table is instantly ready for high-speed live writes!</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: Live Sync & Diagnostics */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Push Local Records to Supabase
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Uploads all locally registered participant records to the Supabase database table.
                    </p>
                  </div>
                  <button
                    onClick={handlePushSync}
                    disabled={isPushing}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                    {isPushing ? 'Pushing Records...' : 'Push to Supabase'}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      Fetch & Sync from Supabase
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Pulls the latest rows from Supabase into your local registration workspace.
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerPullSync}
                    disabled={isSyncing}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Fetch from Supabase'}
                  </button>
                </div>
              </div>

              {/* Diagnostic Test Row Action */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4 text-emerald-400" />
                    Write Sample Diagnostic Record
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Verifies that table write permissions and inserts are operating with sub-second latency.
                  </p>
                </div>
                <button
                  onClick={handleExecuteTestWrite}
                  disabled={isTesting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  {isTesting ? 'Writing...' : 'Test Write'}
                </button>
              </div>

              {/* Diagnostic Results Box */}
              {diagResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-slate-300 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-slate-400" />
                      Live Diagnostic Summary
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(diagResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Status</div>
                      <div className={`font-bold text-xs ${diagResult.isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {diagResult.isConnected ? 'Connected' : 'Offline'}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Table Exists</div>
                      <div className={`font-bold text-xs ${diagResult.tableExists ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {diagResult.tableExists ? 'Ready' : 'Missing'}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Row Count</div>
                      <div className="font-bold text-xs text-slate-200">
                        {diagResult.rowCount ?? 0}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <div className="text-[10px] text-slate-500">Storage Mode</div>
                      <div className="font-bold text-xs text-cyan-300">
                        {diagResult.storageMode === 'SUPABASE_CLOUD' ? 'Supabase Cloud' : 'Local Backup'}
                      </div>
                    </div>
                  </div>

                  {diagResult.recommendations && diagResult.recommendations.length > 0 && (
                    <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                      {diagResult.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Persistent disk cache active — zero data loss guarantee
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
