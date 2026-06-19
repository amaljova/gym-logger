import { useState, useEffect } from 'react';
import { db, exportDatabaseToJson, type Workout, type WorkoutSet, type Exercise, type Routine, type WorkoutNote } from '../db/db';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface SyncStatus {
  state: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
}

export function useGoogleDrive() {
  const [clientId, setClientId] = useState<string>(() => localStorage.getItem('gdrive_client_id') || '');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' });

  // Load client ID and token from storage on mount
  useEffect(() => {
    const refreshToken = localStorage.getItem('gdrive_refresh_token');
    if (refreshToken && clientId) {
      refreshAccessToken(clientId, refreshToken);
    }
  }, []);

  // Save client ID to localStorage when updated
  const saveClientId = (id: string) => {
    setClientId(id);
    localStorage.setItem('gdrive_client_id', id);
  };

  // Helper: PKCE code challenge generation
  const generatePKCEPair = async () => {
    const dec2hex = (dec: number) => dec.toString(16).padStart(2, '0');
    const arr = new Uint8Array(40);
    window.crypto.getRandomValues(arr);
    const verifier = Array.from(arr, dec2hex).join('');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
      
    return { verifier, challenge };
  };

  // Step 1: Initiate OAuth Login with PKCE
  const login = async () => {
    if (!clientId) {
      alert('Please enter a Google Client ID in the Settings screen first.');
      return;
    }
    
    setSyncStatus({ state: 'syncing', message: 'Initiating authentication...' });
    const { verifier, challenge } = await generatePKCEPair();
    
    sessionStorage.setItem('pkce_verifier', verifier);
    
    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = `${GOOGLE_AUTH_URL}?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'consent',
      access_type: 'offline' // Request refresh token
    }).toString();
    
    window.location.href = authUrl;
  };

  // Step 2: Handle redirect callback and exchange authorization code for tokens
  const handleRedirectCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Clear the query parameters from the address bar
    window.history.replaceState({}, document.title, window.location.pathname);

    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) {
      setSyncStatus({ state: 'error', message: 'PKCE verifier missing. Please login again.' });
      return;
    }

    setSyncStatus({ state: 'syncing', message: 'Exchanging auth code...' });
    const redirectUri = window.location.origin + window.location.pathname;

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          code: code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error_description || 'Token exchange failed');
      }

      const tokens = await response.json();
      setAccessToken(tokens.access_token);
      setIsAuthenticated(true);
      
      if (tokens.refresh_token) {
        localStorage.setItem('gdrive_refresh_token', tokens.refresh_token);
      }
      
      setSyncStatus({ state: 'success', message: 'Connected to Google Drive successfully.' });
      sessionStorage.removeItem('pkce_verifier');
      
      // Auto-sync after successful connection
      setTimeout(() => performSync(tokens.access_token), 1000);
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ state: 'error', message: `Auth error: ${err.message}` });
    }
  };

  // Refresh access token
  const refreshAccessToken = async (cid: string, refreshToken: string) => {
    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cid,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        })
      });

      if (!response.ok) {
        throw new Error('Refresh token expired or invalid');
      }

      const tokens = await response.json();
      setAccessToken(tokens.access_token);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Failed to refresh token, logging out:', err);
      logout();
    }
  };

  // Disconnect Google Drive
  const logout = () => {
    setAccessToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('gdrive_refresh_token');
    setSyncStatus({ state: 'idle' });
  };

  // Search for the appData backup file
  const findBackupFile = async (token: string): Promise<{ id: string; modifiedTime: string } | null> => {
    const query = new URLSearchParams({
      q: "name = 'gym_logger_backup.json' and 'appDataFolder' in parents",
      spaces: 'appDataFolder',
      fields: 'files(id, name, modifiedTime)',
    }).toString();

    const response = await fetch(`${DRIVE_FILES_URL}?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to query Google Drive files');
    }

    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0] : null;
  };

  // Fetch the remote backup content
  const downloadBackupFile = async (token: string, fileId: string): Promise<any> => {
    const response = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to download backup file');
    }

    return response.json();
  };

  // Create or Update backup file on Drive
  const uploadBackupFile = async (token: string, fileId: string | null, content: string) => {
    const metadata = {
      name: 'gym_logger_backup.json',
      parents: fileId ? undefined : ['appDataFolder'],
    };

    const boundary = 'foo_bar_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const url = fileId 
      ? `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=multipart` 
      : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

    const method = fileId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body
    });

    if (!response.ok) {
      const errTxt = await response.text();
      throw new Error(`Upload failed: ${errTxt}`);
    }
  };

  // Last-Write-Wins merge handler
  const mergeDatabase = async (remoteBackup: any): Promise<boolean> => {
    // Accept any known backup version (1 = pre-notes, 2 = with workoutNotes).
    if (!remoteBackup || !remoteBackup.data || !remoteBackup.version) {
      return false;
    }

    const remoteData = remoteBackup.data;
    let localHasNewer = false;

    await db.transaction('rw', [db.exercises, db.routines, db.workouts, db.sets, db.workoutNotes], async () => {
      // 1. Exercises Merge
      const localExercises = await db.exercises.toArray();
      const localExMap = new Map(localExercises.map(e => [e.id, e]));
      const remoteExList = (remoteData.exercises || []) as Exercise[];

      for (const rx of remoteExList) {
        const lx = localExMap.get(rx.id);
        if (!lx || rx.updatedAt > lx.updatedAt) {
          await db.exercises.put(rx);
        } else if (lx.updatedAt > rx.updatedAt) {
          localHasNewer = true;
        }
      }
      
      // Look for local exercises not present in remote
      const remoteExIds = new Set(remoteExList.map(r => r.id));
      if (localExercises.some(l => !remoteExIds.has(l.id))) {
        localHasNewer = true;
      }

      // 2. Routines Merge
      const localRoutines = await db.routines.toArray();
      const localRotMap = new Map(localRoutines.map(r => [r.id, r]));
      const remoteRotList = (remoteData.routines || []) as Routine[];

      for (const rr of remoteRotList) {
        const lr = localRotMap.get(rr.id);
        if (!lr || rr.updatedAt > lr.updatedAt) {
          await db.routines.put(rr);
        } else if (lr.updatedAt > rr.updatedAt) {
          localHasNewer = true;
        }
      }
      const remoteRotIds = new Set(remoteRotList.map(r => r.id));
      if (localRoutines.some(l => !remoteRotIds.has(l.id))) {
        localHasNewer = true;
      }

      // 3. Workouts Merge
      const localWorkouts = await db.workouts.toArray();
      const localWktMap = new Map(localWorkouts.map(w => [w.id, w]));
      const remoteWktList = (remoteData.workouts || []) as Workout[];

      for (const rw of remoteWktList) {
        const lw = localWktMap.get(rw.id);
        if (!lw || rw.updatedAt > lw.updatedAt) {
          await db.workouts.put(rw);
        } else if (lw.updatedAt > rw.updatedAt) {
          localHasNewer = true;
        }
      }
      const remoteWktIds = new Set(remoteWktList.map(r => r.id));
      if (localWorkouts.some(l => !remoteWktIds.has(l.id))) {
        localHasNewer = true;
      }

      // 4. Sets Merge
      const localSets = await db.sets.toArray();
      const localSetMap = new Map(localSets.map(s => [s.id, s]));
      const remoteSetList = (remoteData.sets || []) as WorkoutSet[];

      for (const rs of remoteSetList) {
        const ls = localSetMap.get(rs.id);
        if (!ls || rs.updatedAt > ls.updatedAt) {
          await db.sets.put(rs);
        } else if (ls.updatedAt > rs.updatedAt) {
          localHasNewer = true;
        }
      }
      const remoteSetIds = new Set(remoteSetList.map(r => r.id));
      if (localSets.some(l => !remoteSetIds.has(l.id))) {
        localHasNewer = true;
      }

      // 5. Workout Notes Merge (absent in v1 backups — defaults to empty)
      const localNotes = await db.workoutNotes.toArray();
      const localNoteMap = new Map(localNotes.map(n => [n.id, n]));
      const remoteNoteList = (remoteData.workoutNotes || []) as WorkoutNote[];

      for (const rn of remoteNoteList) {
        const ln = localNoteMap.get(rn.id);
        if (!ln || rn.updatedAt > ln.updatedAt) {
          await db.workoutNotes.put(rn);
        } else if (ln.updatedAt > rn.updatedAt) {
          localHasNewer = true;
        }
      }
      const remoteNoteIds = new Set(remoteNoteList.map(r => r.id));
      if (localNotes.some(l => !remoteNoteIds.has(l.id))) {
        localHasNewer = true;
      }
    });

    return localHasNewer;
  };

  // Perform full sync (pull -> merge -> push if local is newer or file didn't exist)
  const performSync = async (tokenOverride?: string) => {
    const token = tokenOverride || accessToken;
    if (!token) {
      setSyncStatus({ state: 'error', message: 'Not authenticated' });
      return;
    }

    setSyncStatus({ state: 'syncing', message: 'Syncing database with Google Drive...' });

    try {
      const file = await findBackupFile(token);
      let localHasChangesToUpload = false;

      if (file) {
        const remoteBackup = await downloadBackupFile(token, file.id);
        const hasNewerLocal = await mergeDatabase(remoteBackup);
        if (hasNewerLocal) {
          localHasChangesToUpload = true;
        }
      } else {
        // No file exists on drive yet - initial upload required
        localHasChangesToUpload = true;
      }

      if (localHasChangesToUpload) {
        setSyncStatus({ state: 'syncing', message: 'Uploading changes to Drive...' });
        const localBackupJson = await exportDatabaseToJson();
        await uploadBackupFile(token, file ? file.id : null, localBackupJson);
      }

      setSyncStatus({ state: 'success', message: 'Google Drive sync completed successfully.' });
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ state: 'error', message: `Sync error: ${err.message}` });
    }
  };

  return {
    clientId,
    saveClientId,
    isAuthenticated,
    syncStatus,
    login,
    logout,
    sync: () => performSync(),
    handleRedirectCallback
  };
}
