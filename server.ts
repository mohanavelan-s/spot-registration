import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverSheetsService } from './server/sheetsService';
import { serverAuthService, AppUser, UserRole } from './server/authService';
import { serverCertificateService } from './server/certificateService';

// Extend Express Request type to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: AppUser | null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing
  app.use(express.json());

  // Global Auth Context Middleware
  app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = serverAuthService.resolveUserFromHeaders(req.headers as any);
      req.user = user;
    } catch (e) {
      req.user = null;
    }
    next();
  });

  // Guard: Require Active Authenticated User
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required. Please sign in with an authorized account.'
      });
    }
    if (req.user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Your account is currently disabled. Please contact the symposium administrator.'
      });
    }
    next();
  };

  // Guard: Require Specific Roles
  const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user || req.user.status !== 'ACTIVE') {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Please sign in.'
        });
      }
      const hasAllowedRole =
        allowedRoles.includes(req.user.role) ||
        (req.user.secondaryRoles && req.user.secondaryRoles.some(r => allowedRoles.includes(r)));

      if (!hasAllowedRole) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'ACCESS_DENIED',
          details: `Attempted access to role-restricted resource requiring [${allowedRoles.join(', ')}]`,
          status: 'DENIED'
        });

        return res.status(403).json({
          success: false,
          error: `Forbidden: Action requires role [${allowedRoles.join(', ')}]. Your role is ${req.user.role}.`
        });
      }
      next();
    };
  };

  // --- HEALTH & STATUS ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      sheetConfigured: Boolean(serverSheetsService.getSheetId()),
      googleAuthReady: serverSheetsService.isAuthConfigured(),
      authMethod: serverSheetsService.getAuthMethod(),
      serviceAccountEmail: serverSheetsService.getServiceAccountEmail(),
      registeredUsersCount: serverAuthService.getAllUsers().length
    });
  });

  // --- AUTHENTICATION & USER MANAGEMENT ROUTES ---

  // Current authenticated user session
  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'No active session or account not yet authorized.'
      });
    }

    if (req.user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        authenticated: true,
        user: req.user,
        message: 'Account is disabled. Contact system administrator.'
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: req.user
    });
  });

  // Login handler (Supports Username/Password Credentials and OAuth)
  app.post('/api/auth/login', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, password, email, name, picture } = req.body;

      // A. Credentials Login (Username/Email + Password)
      if (password !== undefined) {
        const identifier = username || email;
        if (!identifier) {
          return res.status(400).json({ success: false, error: 'Username or email is required.' });
        }
        const authResult = serverAuthService.authenticateWithCredentials(identifier, password);
        return res.json({
          success: true,
          token: authResult.token,
          user: authResult.user,
          mustChangePassword: authResult.mustChangePassword
        });
      }

      // B. OAuth Login (Google Sign-In)
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email or Username + Password is required for authentication.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = serverAuthService.getUserByEmail(normalizedEmail) || serverAuthService.getUserByUsername(normalizedEmail);

      if (!user) {
        serverAuthService.logAudit({
          userEmail: normalizedEmail,
          userName: name || 'Unknown User',
          role: 'ANONYMOUS',
          action: 'ACCESS_DENIED',
          details: 'Login attempt by unregistered/unauthorized account.',
          status: 'DENIED'
        });

        return res.status(403).json({
          success: false,
          error: 'Access Denied: Your Google account is not authorized to access this symposium portal. Please contact an Administrator to assign your role.'
        });
      }

      if (user.status !== 'ACTIVE') {
        serverAuthService.logAudit({
          userEmail: user.email,
          userName: user.name,
          role: user.role,
          action: 'ACCESS_DENIED',
          details: 'Login attempt by disabled account.',
          status: 'DENIED'
        });

        return res.status(403).json({
          success: false,
          error: 'Access Denied: Your account has been marked as INACTIVE. Please contact the symposium administrator.'
        });
      }

      // Update last login
      const updated = serverAuthService.updateUser(user.id, {}, user);
      if (picture) updated.picture = picture;

      // Create session for authenticated OAuth user
      const session = serverAuthService.createSession(user.id);

      serverAuthService.logAudit({
        userEmail: user.email,
        userName: user.name,
        role: user.role,
        action: 'LOGIN',
        details: `User logged in with role: ${user.role}`,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        token: session.token,
        user: updated,
        mustChangePassword: Boolean(updated.mustChangePassword)
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Authentication failed' });
    }
  });

  // Change Password endpoint (first login or self-service)
  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { newPassword, currentPassword, userId } = req.body;
      const targetId = req.user!.role === 'ADMIN' && userId ? userId : req.user!.id;
      const updatedUser = serverAuthService.changePassword(
        targetId,
        newPassword,
        currentPassword,
        req.user!
      );
      res.json({
        success: true,
        user: updatedUser,
        message: 'Password successfully updated.'
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Password update failed' });
    }
  });

  // Logout handler
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      serverAuthService.destroySession(authHeader.substring(7).trim());
    } else if (typeof req.headers['x-session-token'] === 'string') {
      serverAuthService.destroySession(req.headers['x-session-token'].trim());
    }

    if (req.user) {
      serverAuthService.logAudit({
        userEmail: req.user.email,
        userName: req.user.name,
        role: req.user.role,
        action: 'LOGOUT',
        details: 'User signed out',
        status: 'SUCCESS'
      });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // Admin: List all authorized users
  app.get('/api/auth/users', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    const users = serverAuthService.getAllUsers();
    res.json({ success: true, users });
  });

  // Admin: Create new authorized user
  app.post('/api/auth/users', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, username, email, role, secondaryRoles, status, assignedEvents, teamName, yearSection, password } = req.body;
      if (!name || !role) {
        return res.status(400).json({ success: false, error: 'Name and role are required.' });
      }

      const newUser = serverAuthService.createUser(
        { name, username, email, role, secondaryRoles, status, assignedEvents, teamName, yearSection, password },
        req.user!
      );

      res.status(201).json({ success: true, user: newUser });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Admin: Update user role / status / assigned events
  app.put('/api/auth/users/:id', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, username, email, role, secondaryRoles, status, assignedEvents, teamName, yearSection } = req.body;

      const updatedUser = serverAuthService.updateUser(
        id,
        { name, username, email, role, secondaryRoles, status, assignedEvents, teamName, yearSection },
        req.user!
      );

      res.json({ success: true, user: updatedUser });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Admin: Reset password for user
  app.post('/api/auth/users/:id/reset-password', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const result = serverAuthService.resetPassword(id, newPassword, req.user!);
      res.json({
        success: true,
        user: result.user,
        temporaryPassword: result.temporaryPassword,
        message: 'Password reset successfully. The user will be prompted to set a new password on their next login.'
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Admin: Delete user
  app.delete('/api/auth/users/:id', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      serverAuthService.deleteUser(id, req.user!);
      res.json({ success: true, message: 'User removed successfully.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Admin: View Audit Logs
  app.get('/api/audit-logs', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    const limit = Number(req.query.limit) || 100;
    const logs = serverAuthService.getAuditLogs(limit);
    res.json({ success: true, logs });
  });

  // Post Audit Log Entry (for client actions like Exports or Syncs)
  app.post('/api/audit-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { action, details, targetId, status } = req.body;
    const entry = serverAuthService.logAudit({
      userEmail: req.user!.email,
      userName: req.user!.name,
      role: req.user!.role,
      action: action || 'DATA_SYNCED',
      details: details || '',
      targetId,
      status: status || 'SUCCESS'
    });
    res.json({ success: true, entry });
  });

  // --- CERTIFICATE DESK & TRACKING APIS ---

  // Get all certificate records
  app.get('/api/certificates', requireRole('ADMIN', 'CERTIFICATE', 'DATABASE'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const records = serverCertificateService.getAllRecords();
      res.json({
        success: true,
        records
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update certificate status for an event (ADMIN or CERTIFICATE only)
  app.post('/api/certificates/update', requireRole('ADMIN', 'CERTIFICATE'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { registrationId, event, status, participantName, college } = req.body;
      if (!registrationId || !event || !status) {
        return res.status(400).json({
          success: false,
          error: 'registrationId, event, and status (PENDING or ISSUED) are required.'
        });
      }

      const updated = serverCertificateService.updateCertificateStatus(
        registrationId,
        event,
        status,
        participantName,
        req.user!,
        college
      );

      res.json({
        success: true,
        record: updated,
        message: `Certificate for ${registrationId} (${event}) updated to ${status}.`
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Bulk update certificate statuses (ADMIN or CERTIFICATE only)
  app.post('/api/certificates/bulk-update', requireRole('ADMIN', 'CERTIFICATE'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, error: 'updates array is required.' });
      }

      const records = serverCertificateService.bulkUpdateStatus(updates, req.user!);
      res.json({
        success: true,
        records,
        message: `Updated ${records.length} certificate records.`
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Sync / Refresh certificates
  app.post('/api/certificates/sync', requireRole('ADMIN', 'CERTIFICATE'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const records = serverCertificateService.getAllRecords();
      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Refreshed ${records.length} certificate tracking records.`,
          status: 'SUCCESS'
        });
      }
      res.json({
        success: true,
        records,
        message: `Synchronized ${records.length} certificate records.`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- EVENT-LEVEL AUTHORIZATION & PARTICIPANTS API ---

  // Verify access for a specific event
  app.get('/api/events/:eventKey/verify-access', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { eventKey } = req.params;
    const isAllowed = serverAuthService.canUserAccessEvent(req.user || null, eventKey);

    if (!isAllowed) {
      serverAuthService.logAudit({
        userEmail: req.user!.email,
        userName: req.user!.name,
        role: req.user!.role,
        action: 'ACCESS_DENIED',
        details: `Event-level access denied for event: ${eventKey}`,
        targetId: eventKey,
        status: 'DENIED'
      });

      return res.status(403).json({
        success: false,
        allowed: false,
        error: `Access Denied: You do not have permission to view or export event '${eventKey}'.`
      });
    }

    res.json({
      success: true,
      allowed: true,
      eventKey,
      userRole: req.user!.role,
      assignedEvents: req.user!.assignedEvents
    });
  });

  // Comprehensive Diagnostics Endpoint (ADMIN only)
  app.get('/api/offline/diagnostics', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const diag = await serverSheetsService.runDiagnostics();
      res.json(diag);
    } catch (err: any) {
      console.error('[API:Diagnostics] Error:', err);
      res.status(500).json({
        error: err.message || 'Diagnostic execution failed',
        details: err
      });
    }
  });

  // Diagnostic Test-Write (TEST-AIROX26) (ADMIN only)
  app.post('/api/offline/test-write', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSheetsService.executeTestWrite();
      if (!result.success) {
        return res.status(500).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error('[API:TestWrite] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Test write failed',
        message: 'Unable to write test record.'
      });
    }
  });

  // Get configuration (Authenticated users only)
  app.get('/api/offline/config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      sheetId: serverSheetsService.getSheetId(),
      isGoogleAuthReady: serverSheetsService.isAuthConfigured(),
      authMethod: serverSheetsService.getAuthMethod(),
      serviceAccountEmail: serverSheetsService.getServiceAccountEmail()
    });
  });

  // Update configuration (ADMIN only)
  app.post('/api/offline/config', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    const { sheetId } = req.body;
    if (typeof sheetId === 'string') {
      serverSheetsService.setSheetId(sheetId);
    }
    res.json({
      success: true,
      sheetId: serverSheetsService.getSheetId(),
      isGoogleAuthReady: serverSheetsService.isAuthConfigured(),
      authMethod: serverSheetsService.getAuthMethod(),
      serviceAccountEmail: serverSheetsService.getServiceAccountEmail()
    });
  });

  // READ: Fetch all offline registrations (Authenticated users)
  app.get('/api/offline/registrations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSheetsService.fetchRegistrations();
      res.json({
        success: true,
        records: result.records,
        headers: result.headers,
        source: result.source,
        sheetId: serverSheetsService.getSheetId(),
        warning: result.warning
      });
    } catch (err: any) {
      console.warn('[API:Read] Notice fetching offline registrations:', err?.message || err);
      const cached = serverSheetsService.getCachedRecords();
      res.json({
        success: true,
        records: cached,
        headers: serverSheetsService.getHeaders(),
        source: 'LOCAL_BACKUP',
        sheetId: serverSheetsService.getSheetId(),
        warning: err.message || 'Serving local cached records due to temporary rate limit.'
      });
    }
  });

  // SYNC: Force fresh sync from Google Sheets (Authenticated users)
  app.post('/api/offline/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSheetsService.fetchRegistrations(true);

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Synchronized ${result.records.length} registrations.`,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        records: result.records,
        headers: result.headers,
        source: result.source,
        warning: result.warning,
        message: result.warning || `Synchronized ${result.records.length} registrations successfully.`
      });
    } catch (err: any) {
      console.warn('[API:Sync] Notice syncing offline registrations:', err?.message || err);
      const cached = serverSheetsService.getCachedRecords();
      res.json({
        success: true,
        records: cached,
        headers: serverSheetsService.getHeaders(),
        source: 'LOCAL_BACKUP',
        warning: err.message || 'Serving local cached records due to temporary rate limit.',
        message: `Served ${cached.length} local records (Google Sheets rate limit reached).`
      });
    }
  });

  // CREATE: Append new registration (Requires ADMIN or ON_SPOT)
  app.post('/api/offline/registrations', requireRole('ADMIN', 'ON_SPOT'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { formData, coordinatorName } = req.body;

      if (!formData || !formData.fullName || !formData.mobile) {
        return res.status(400).json({
          success: false,
          error: 'Full Name and Mobile Number are required.'
        });
      }

      const eventString = Array.isArray(formData.selectedEvents)
        ? formData.selectedEvents.join(', ')
        : String(formData.event || formData.selectedEvents || '');

      const registeredBy = formData.registeredBy || coordinatorName || req.user?.name || 'Desk Admin';

      const newRecord = await serverSheetsService.createRegistration(
        {
          fullName: formData.fullName,
          email: formData.email,
          mobile: formData.mobile,
          college: formData.college,
          department: formData.department,
          yearSection: formData.yearSection,
          event: eventString,
          teamName: formData.teamName || '',
          verificationStatus: formData.verificationStatus || 'Verified',
          registeredBy
        },
        registeredBy
      );

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_CREATED',
          details: `Created registration for ${newRecord.fullName} (${newRecord.college}) in events: [${eventString}]`,
          targetId: newRecord.offlineRegistrationId,
          status: 'SUCCESS'
        });
      }

      res.status(201).json({
        success: true,
        record: newRecord,
        message: `Offline Registration ${newRecord.offlineRegistrationId} saved successfully.`
      });
    } catch (err: any) {
      console.error('[API:Create] Error creating offline registration:', err);
      res.status(500).json({
        success: false,
        error: `Unable to save registration: ${err.message || 'Storage error'}`,
        details: err.message
      });
    }
  });

  // UPDATE: Edit existing registration (ADMIN or ON_SPOT)
  app.put('/api/offline/registrations/:id', requireRole('ADMIN', 'ON_SPOT'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { updates, coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const updater = coordinatorName || req.user?.name || 'Desk Admin';
      const updatedRecord = await serverSheetsService.updateRegistration(
        id,
        updates,
        updater
      );

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_UPDATED',
          details: `Updated registration ${id}`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: updatedRecord,
        message: `Record ${id} updated successfully.`
      });
    } catch (err: any) {
      console.error(`[API:Update] Error updating registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to update registration: ${err.message || 'Storage error'}`
      });
    }
  });

  // CANCEL: Soft delete registration (ADMIN or ON_SPOT)
  app.post('/api/offline/registrations/:id/cancel', requireRole('ADMIN', 'ON_SPOT'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const canceller = coordinatorName || req.user?.name || 'Desk Admin';
      const cancelledRecord = await serverSheetsService.cancelRegistration(
        id,
        canceller
      );

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_CANCELLED',
          details: `Cancelled registration ${id}`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: cancelledRecord,
        message: `Record ${id} status set to CANCELLED.`
      });
    } catch (err: any) {
      console.error(`[API:Cancel] Error cancelling registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to cancel registration: ${err.message || 'Storage error'}`
      });
    }
  });

  // RESTORE: Set status back to 'ACTIVE' (ADMIN or ON_SPOT)
  app.post('/api/offline/registrations/:id/restore', requireRole('ADMIN', 'ON_SPOT'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const restorer = coordinatorName || req.user?.name || 'Desk Admin';
      const restoredRecord = await serverSheetsService.restoreRegistration(
        id,
        restorer
      );

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_RESTORED',
          details: `Restored registration ${id} to ACTIVE`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: restoredRecord,
        message: `Record ${id} restored to ACTIVE.`
      });
    } catch (err: any) {
      console.error(`[API:Restore] Error restoring registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to restore registration: ${err.message || 'Storage error'}`
      });
    }
  });

  // --- ONLINE REGISTRATIONS APIS ---

  // Get Online Google Sheet config
  app.get('/api/online/config', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      sheetId: serverSheetsService.getOnlineSheetId(),
      isGoogleAuthReady: serverSheetsService.isAuthConfigured()
    });
  });

  // Update Online Google Sheet config (ADMIN only)
  app.post('/api/online/config', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    const { sheetId } = req.body;
    if (typeof sheetId === 'string') {
      serverSheetsService.setOnlineSheetId(sheetId);
    }
    res.json({
      success: true,
      sheetId: serverSheetsService.getOnlineSheetId(),
      isGoogleAuthReady: serverSheetsService.isAuthConfigured()
    });
  });

  // Fetch Online registrations
  app.get('/api/online/registrations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSheetsService.fetchOnlineRegistrations();
      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.warn('[API:Online] Notice fetching online registrations:', err?.message || err);
      res.status(200).json({
        success: true,
        rows: [],
        headers: [],
        source: 'FALLBACK',
        count: 0,
        warning: err.message || 'Unable to fetch online registrations'
      });
    }
  });

  // Sync / Refresh Online registrations
  app.post('/api/online/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSheetsService.fetchOnlineRegistrations();
      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Synchronized ${result.count || 0} online registrations from Google Sheets.`,
          status: 'SUCCESS'
        });
      }
      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.warn('[API:OnlineSync] Notice syncing online registrations:', err?.message || err);
      res.status(200).json({
        success: true,
        rows: [],
        headers: [],
        source: 'FALLBACK',
        count: 0,
        warning: err.message || 'Unable to sync online registrations'
      });
    }
  });

  // --- Vite / Static Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AIROX'26 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

