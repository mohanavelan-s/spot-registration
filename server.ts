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
      if (!allowedRoles.includes(req.user.role)) {
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

  // Login handler
  app.post('/api/auth/login', (req: AuthenticatedRequest, res: Response) => {
    const { email, name, picture } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required for authentication.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = serverAuthService.getUserByEmail(normalizedEmail);

    // If matches primary admin email, ensure admin entry
    if (!user && (normalizedEmail === 'mohanavelandev@gmail.com' || normalizedEmail === process.env.ADMIN_EMAIL?.toLowerCase())) {
      user = serverAuthService.resolveUserFromHeaders({ 'x-user-email': normalizedEmail });
    }

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
    user.lastLoginAt = new Date().toISOString();
    if (picture) user.picture = picture;

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
      user
    });
  });

  // Logout handler
  app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
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
      const { name, email, role, status, assignedEvents } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ success: false, error: 'Name, email, and role are required.' });
      }

      const newUser = serverAuthService.createUser(
        { name, email, role, status, assignedEvents },
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
      const { name, role, status, assignedEvents } = req.body;

      const updatedUser = serverAuthService.updateUser(
        id,
        { name, role, status, assignedEvents },
        req.user!
      );

      res.json({ success: true, user: updatedUser });
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

  // Comprehensive Diagnostics Endpoint
  app.get('/api/offline/diagnostics', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const diag = await serverSheetsService.runDiagnostics(authHeader);
      res.json(diag);
    } catch (err: any) {
      console.error('[API:Diagnostics] Error:', err);
      res.status(500).json({
        error: err.message || 'Diagnostic execution failed',
        details: err
      });
    }
  });

  // Diagnostic Test-Write (TEST-AIROX26)
  app.post('/api/offline/test-write', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await serverSheetsService.executeTestWrite(authHeader);
      if (!result.success) {
        return res.status(500).json(result);
      }
      res.json(result);
    } catch (err: any) {
      console.error('[API:TestWrite] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Test write failed',
        message: 'Unable to write test record to Google Sheets.'
      });
    }
  });

  // Get configuration (Admin only for full config)
  app.get('/api/offline/config', (req, res) => {
    res.json({
      sheetId: serverSheetsService.getSheetId(),
      isGoogleAuthReady: serverSheetsService.isAuthConfigured(),
      authMethod: serverSheetsService.getAuthMethod(),
      serviceAccountEmail: serverSheetsService.getServiceAccountEmail()
    });
  });

  // Update configuration (Admin only)
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

  // READ: Fetch all offline registrations directly from Google Sheets
  app.get('/api/offline/registrations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await serverSheetsService.fetchRegistrations(authHeader);
      res.json({
        success: true,
        records: result.records,
        headers: result.headers,
        source: result.source,
        sheetId: serverSheetsService.getSheetId()
      });
    } catch (err: any) {
      console.error('[API:Read] Error fetching offline registrations from Google Sheets:', err);
      res.status(500).json({
        success: false,
        error: `Unable to fetch registrations from Google Sheets: ${err.message || 'Check spreadsheet permissions and API status.'}`,
        details: err.message
      });
    }
  });

  // SYNC: Force fresh sync from Google Sheets
  app.post('/api/offline/sync', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const result = await serverSheetsService.fetchRegistrations(authHeader);

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Synchronized ${result.records.length} registrations from Google Sheets.`,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        records: result.records,
        headers: result.headers,
        source: result.source,
        message: `Synchronized ${result.records.length} registrations with Google Sheets successfully.`
      });
    } catch (err: any) {
      console.error('[API:Sync] Error syncing with Google Sheets:', err);
      res.status(500).json({
        success: false,
        error: `Unable to sync with Google Sheets: ${err.message || 'Check spreadsheet permissions and API status.'}`
      });
    }
  });

  // CREATE: Append new registration to Google Sheets (Requires ADMIN or ON_SPOT)
  app.post('/api/offline/registrations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Permission check: ADMIN or ON_SPOT
      if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'ON_SPOT') {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'ACCESS_DENIED',
          details: 'Unauthorized attempt to create offline registration.',
          status: 'DENIED'
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Creating offline registrations is restricted to ADMIN and ON_SPOT team members.'
        });
      }

      const authHeader = req.headers.authorization;
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
        registeredBy,
        authHeader
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
        message: `Offline Registration ${newRecord.offlineRegistrationId} saved to Google Sheets successfully.`
      });
    } catch (err: any) {
      console.error('[API:Create] Error creating offline registration in Google Sheets:', err);
      res.status(500).json({
        success: false,
        error: `Unable to save registration to Google Sheets: ${err.message || 'API error'}`,
        details: err.message
      });
    }
  });

  // UPDATE: Edit existing registration row in Google Sheets (ADMIN or ON_SPOT)
  app.put('/api/offline/registrations/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'ON_SPOT') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Modifying offline registrations is restricted to ADMIN and ON_SPOT team members.'
        });
      }

      const authHeader = req.headers.authorization;
      const { id } = req.params;
      const { updates, coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const updater = coordinatorName || req.user?.name || 'Desk Admin';
      const updatedRecord = await serverSheetsService.updateRegistration(
        id,
        updates,
        updater,
        authHeader
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
        message: `Record ${id} updated in Google Sheets successfully.`
      });
    } catch (err: any) {
      console.error(`[API:Update] Error updating registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to update registration in Google Sheets: ${err.message || 'API error'}`
      });
    }
  });

  // CANCEL: Soft delete registration in Google Sheets (ADMIN or ON_SPOT)
  app.post('/api/offline/registrations/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'ON_SPOT') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cancelling registrations is restricted to ADMIN and ON_SPOT team members.'
        });
      }

      const authHeader = req.headers.authorization;
      const { id } = req.params;
      const { coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const canceller = coordinatorName || req.user?.name || 'Desk Admin';
      const cancelledRecord = await serverSheetsService.cancelRegistration(
        id,
        canceller,
        authHeader
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
        message: `Record ${id} status set to CANCELLED in Google Sheets.`
      });
    } catch (err: any) {
      console.error(`[API:Cancel] Error cancelling registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to cancel registration in Google Sheets: ${err.message || 'API error'}`
      });
    }
  });

  // RESTORE: Set status back to 'ACTIVE' in Google Sheets
  app.post('/api/offline/registrations/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'ON_SPOT') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Restoring registrations is restricted to ADMIN and ON_SPOT team members.'
        });
      }

      const authHeader = req.headers.authorization;
      const { id } = req.params;
      const { coordinatorName } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Registration ID is required.' });
      }

      const restorer = coordinatorName || req.user?.name || 'Desk Admin';
      const restoredRecord = await serverSheetsService.restoreRegistration(
        id,
        restorer,
        authHeader
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
        message: `Record ${id} restored to ACTIVE in Google Sheets.`
      });
    } catch (err: any) {
      console.error(`[API:Restore] Error restoring registration ${req.params.id}:`, err);
      res.status(500).json({
        success: false,
        error: `Unable to restore registration in Google Sheets: ${err.message || 'API error'}`
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

