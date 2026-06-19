import React, { useEffect, useState } from 'react';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { exportDatabaseToJson, importDatabaseFromJson } from '../db/db';
import type { ThemePref } from '../hooks/useTheme';
import {
  Cloud, CloudOff, RefreshCw, Upload, Download,
  ShieldAlert, HardDrive, Key, CheckCircle, HelpCircle, ChevronDown, ChevronUp, Copy, ExternalLink,
  Palette, Sun, Moon, Monitor
} from 'lucide-react';

interface SettingsScreenProps {
  pref: ThemePref;
  setTheme: (p: ThemePref) => void;
}

export default function SettingsScreen({ pref, setTheme }: SettingsScreenProps) {
  const gdrive = useGoogleDrive();
  const [showClientIdHelp, setShowClientIdHelp] = useState(false);

  const themeOptions: { id: ThemePref; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  // Values that must be whitelisted in Google Cloud Console. On a GitHub project
  // page these differ: the JS origin has no path, the redirect URI includes it
  // (this must match exactly what the OAuth flow sends — origin + pathname).
  const jsOrigin = window.location.origin;
  const redirectUri = window.location.origin + window.location.pathname;

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`Copied ${label}:\n${text}`);
    } catch {
      alert(`Copy this ${label} manually:\n${text}`);
    }
  };

  // Run redirect callback checking if "code" exists in the URL parameters
  useEffect(() => {
    if (window.location.search.includes('code=')) {
      gdrive.handleRedirectCallback();
    }
  }, []);

  const handleExport = async () => {
    try {
      const json = await exportDatabaseToJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym_logger_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm('WARNING: Importing this file will OVERWRITE all your current workout routines, exercises, and logs. This cannot be undone. Do you want to proceed?')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          await importDatabaseFromJson(text, true);
          alert('Database restored successfully!');
          // Force page refresh to reload IndexedDB queries
          window.location.reload();
        } catch (err: any) {
          alert(`Import failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
    // reset file input
    e.target.value = '';
  };

  const requestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      alert(isPersisted 
        ? 'Storage persistence granted! The browser will protect your workout database from eviction.' 
        : 'Storage persistence denied. The browser might delete your local data if storage runs low.'
      );
    } else {
      alert('Storage persistence API is not supported by your browser.');
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: '32px' }}>
      <div className="screen-header">
        <h1 className="screen-title">Settings</h1>
        <p className="screen-subtitle">manage your data and backup preferences</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Appearance / Theme */}
        <div className="card">
          <div style={styles.cardHeader}>
            <Palette size={18} className="text-accent" />
            <h2 style={styles.cardTitle}>Appearance</h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '14px', lineHeight: '1.4' }}>
            Choose a theme. "System" follows your device's light/dark setting automatically.
          </p>
          <div className="segmented">
            {themeOptions.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  className={pref === opt.id ? 'active' : ''}
                  onClick={() => setTheme(opt.id)}
                >
                  <Icon size={15} /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Storage Persistence */}
        <div className="card">
          <div style={styles.cardHeader}>
            <HardDrive size={18} className="text-accent" />
            <h2 style={styles.cardTitle}>Durable storage</h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px', lineHeight: '1.4' }}>
            Request persistent storage to prevent your browser from evicting workout logs if the device gets low on space.
          </p>
          <button className="btn btn-secondary w-full" onClick={requestPersistence}>
            Request persistence
          </button>
        </div>

        {/* Local Backup */}
        <div className="card">
          <div style={styles.cardHeader}>
            <Upload size={18} className="text-accent" />
            <h2 style={styles.cardTitle}>Local backup</h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '16px', lineHeight: '1.4' }}>
            Export your entire database to a JSON file, or restore from a previously exported backup file.
          </p>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={handleExport} style={{ flex: 1 }}>
              <Download size={16} /> Export JSON
            </button>
            <label className="btn btn-secondary" style={{ flex: 1, cursor: 'pointer' }}>
              <Upload size={16} /> Import JSON
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImport} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>
        </div>

        {/* Google Drive Backup */}
        <div className="card">
          <div style={styles.cardHeader}>
            <Cloud size={18} className="text-accent" />
            <h2 style={styles.cardTitle}>Google Drive backup</h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '12px', lineHeight: '1.4' }}>
            Sync your workout logs to Google Drive's hidden app-specific folder. Client-side OAuth with PKCE.
          </p>

          {/* How to get a Client ID — collapsible guide */}
          <button onClick={() => setShowClientIdHelp(v => !v)} style={styles.helpToggle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} /> How do I get a Client ID?
            </span>
            {showClientIdHelp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showClientIdHelp && (
            <div style={styles.helpBox}>
              <ol style={styles.helpList}>
                <li>
                  Open the{' '}
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={styles.helpLink}>
                    Google Cloud Console <ExternalLink size={10} />
                  </a>{' '}
                  and create a new project (or pick an existing one).
                </li>
                <li>
                  Go to <b>APIs &amp; Services → Library</b>, search for <b>Google Drive API</b> and click <b>Enable</b>.
                </li>
                <li>
                  Go to <b>APIs &amp; Services → OAuth consent screen</b>. Choose <b>External</b>, fill in the app
                  name and your email, and add your Google account under <b>Test users</b>.
                </li>
                <li>
                  Go to <b>APIs &amp; Services → Credentials → Create credentials → OAuth client ID</b>.
                  Choose <b>Web application</b>.
                </li>
                <li>
                  Add this under <b>Authorized JavaScript origins</b> (no path):
                  <div style={styles.originRow}>
                    <code style={styles.originCode}>{jsOrigin}</code>
                    <button onClick={() => copyText('JS origin', jsOrigin)} style={styles.copyBtn} aria-label="Copy JavaScript origin">
                      <Copy size={13} />
                    </button>
                  </div>
                  …and this under <b>Authorized redirect URIs</b> (with path):
                  <div style={styles.originRow}>
                    <code style={styles.originCode}>{redirectUri}</code>
                    <button onClick={() => copyText('redirect URI', redirectUri)} style={styles.copyBtn} aria-label="Copy redirect URI">
                      <Copy size={13} />
                    </button>
                  </div>
                </li>
                <li>
                  Click <b>Create</b>, then copy the <b>Client ID</b> (ends in
                  <code style={styles.inlineCode}>.apps.googleusercontent.com</code>) and paste it below.
                </li>
              </ol>
              <div style={styles.helpNote}>
                <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>The Client ID is <b>public by design</b> — no client secret is used. Restricting the origins
                above is what keeps it safe.</span>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Key size={12} /> Google Client ID
            </label>
            <input 
              type="text" 
              className="input-text" 
              placeholder="Enter Google Client ID" 
              value={gdrive.clientId}
              onChange={(e) => gdrive.saveClientId(e.target.value)}
              disabled={gdrive.isAuthenticated}
              style={{ fontSize: '13px' }}
            />
          </div>

          {gdrive.isAuthenticated ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={styles.authStatusSuccess}>
                <CheckCircle size={16} color="var(--accent)" />
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Connected to Google Drive</span>
              </div>

              {gdrive.syncStatus.state !== 'idle' && (
                <div style={{ 
                  ...styles.syncAlert,
                  color: gdrive.syncStatus.state === 'error' ? '#ef4444' : 'var(--text-secondary)'
                }}>
                  {gdrive.syncStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={gdrive.sync} 
                  disabled={gdrive.syncStatus.state === 'syncing'}
                  style={{ flex: 1 }}
                >
                  <RefreshCw size={16} className={gdrive.syncStatus.state === 'syncing' ? 'spin' : ''} style={gdrive.syncStatus.state === 'syncing' ? { animation: 'spin 1.5s linear infinite' } : {}} /> 
                  Sync now
                </button>
                <button className="btn btn-danger" onClick={gdrive.logout} style={{ flex: 1 }}>
                  <CloudOff size={16} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div>
              {gdrive.syncStatus.state === 'error' && (
                <div style={{ ...styles.syncAlert, color: '#ef4444', marginBottom: '12px' }}>
                  {gdrive.syncStatus.message}
                </div>
              )}
              <button 
                className="btn btn-primary w-full" 
                onClick={gdrive.login}
                disabled={!gdrive.clientId}
              >
                <Cloud size={16} /> Connect Google Drive
              </button>
            </div>
          )}
          
          <div style={styles.securityNote}>
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              Your credentials are held safely in memory. Backups are saved to a private folder hidden from other apps.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}

const styles = {
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '500',
    textTransform: 'lowercase' as const,
  },
  authStatusSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
  },
  syncAlert: {
    fontSize: '12px',
    backgroundColor: 'var(--bg-card-solid)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '10px',
    lineHeight: '1.4',
  },
  securityNote: {
    display: 'flex',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '12px',
    lineHeight: '1.4',
  },
  helpToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'var(--hairline)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
  },
  helpBox: {
    marginTop: '10px',
    padding: '14px 14px 14px 0',
    backgroundColor: 'var(--hairline)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
  },
  helpList: {
    margin: 0,
    paddingLeft: '28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    fontSize: '12.5px',
    lineHeight: '1.5',
    color: 'var(--text-secondary)',
  },
  helpLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
  },
  originRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '6px',
  },
  originCode: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '11.5px',
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '6px 8px',
    overflowX: 'auto' as const,
    whiteSpace: 'nowrap' as const,
  },
  copyBtn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: '6px',
    color: 'var(--accent)',
    cursor: 'pointer',
  },
  inlineCode: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '4px',
    padding: '1px 4px',
    margin: '0 3px',
    wordBreak: 'break-all' as const,
  },
  helpNote: {
    display: 'flex',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '12px',
    marginLeft: '28px',
    lineHeight: '1.4',
  },
};
