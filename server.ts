import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { serverSheetsService } from './server/sheetsService';
import { serverSupabaseService } from './server/supabaseService';
import { serverAuthService, AppUser, UserRole } from './server/authService';
import { serverCertificateService } from './server/certificateService';
import { serverEventRegistryService } from './server/eventRegistryService';

// Extend Express Request type to include authenticated user
interface AuthenticatedRequest extends Request {
  user?: AppUser | null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing with error safety
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
        error: 'Unauthorized: Authentication required. Please sign in.'
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

      // Check primary role and additionalRoles
      const userRoles = [req.user.role, ...(req.user.additionalRoles || [])];
      const hasPermission = allowedRoles.some(r => userRoles.includes(r));

      if (!hasPermission) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'ACCESS_DENIED',
          details: `Attempted access to resource requiring [${allowedRoles.join(', ')}]`,
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
      offlineSheetConfigured: Boolean(serverSheetsService.getSheetId()),
      onlineSheetConfigured: Boolean(serverSheetsService.getOnlineSheetId()),
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

  // Staff Credentials Login (Username/Email + Password)
  app.post('/api/auth/staff-login', (req: Request, res: Response) => {
    try {
      const { username, identifier, password } = req.body;
      const idToUse = username || identifier;

      if (!idToUse || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username/Email and Password are required.'
        });
      }

      const { user, mustChangePassword } = serverAuthService.authenticateWithCredentials(idToUse, password);

      res.json({
        success: true,
        user,
        mustChangePassword
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || 'Invalid username or password.'
      });
    }
  });

  // General Login handler (supports both credentials & Google auth)
  app.post('/api/auth/login', (req: AuthenticatedRequest, res: Response) => {
    try {
      const { username, identifier, password, email, name, picture } = req.body;

      // If password provided -> use credentials auth
      if (password && (username || identifier || email)) {
        const idToUse = username || identifier || email;
        const { user, mustChangePassword } = serverAuthService.authenticateWithCredentials(idToUse, password);
        return res.json({
          success: true,
          user,
          mustChangePassword
        });
      }

      // Google OAuth fallback
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email or credentials are required for authentication.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = serverAuthService.getUserByEmail(normalizedEmail);

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
          error: 'Access Denied: Your account is not authorized to access this symposium portal. Please sign in with your staff username and password.'
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
        user,
        mustChangePassword: Boolean(user.mustChangePassword)
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || 'Login failed.'
      });
    }
  });

  // Change Password Endpoint (First login or self-service)
  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 4 characters long.'
        });
      }

      const updatedUser = serverAuthService.changePassword(req.user!.id, newPassword);

      res.json({
        success: true,
        user: updatedUser,
        message: 'Password updated successfully.'
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to change password.'
      });
    }
  });

  // Admin: Reset user password to default
  app.post('/api/auth/users/:id/reset-password', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = serverAuthService.resetPasswordToDefault(id, req.user!);
      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message || 'Failed to reset password.'
      });
    }
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
      const { name, username, email, role, additionalRoles, status, assignedEvents, initialPassword } = req.body;
      if (!name || !role) {
        return res.status(400).json({ success: false, error: 'Name and role are required.' });
      }

      const newUser = serverAuthService.createUser(
        { name, username, email, role, additionalRoles, status, assignedEvents, initialPassword },
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
      const { name, role, additionalRoles, status, assignedEvents } = req.body;

      const updatedUser = serverAuthService.updateUser(
        id,
        { name, role, additionalRoles, status, assignedEvents },
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

  // Post Audit Log Entry
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

  // Get all certificate records (Public/Read access for Certificate Desk)
  app.get('/api/certificates', (req: AuthenticatedRequest, res: Response) => {
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

  // Bulk update certificate statuses
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

  // --- UNIFIED PARTICIPANTS & ROSTERS APIS ---

  // Online Participants Endpoint
  app.get('/api/online/participants', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const participants = await serverSheetsService.fetchOnlineRegistrations();
      res.json({
        success: true,
        total: participants.length,
        participants
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Unified Combined Participants (Online + Offline) with RBAC Scoping
  app.get('/api/combined/participants', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      let participants = await serverSheetsService.getCombinedParticipants();

      // If Event Coordinator -> restrict to their assigned events only!
      if (req.user?.role === 'EVENT_COORDINATOR') {
        const assigned = req.user.assignedEvents || [];
        const normAssigned = assigned.map(e => e.toLowerCase().replace(/[^a-z0-9]/g, ''));

        participants = participants.filter(p => {
          return p.allEvents.some(ev => {
            const normEv = ev.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normAssigned.some(a => normEv === a || normEv.includes(a) || a.includes(normEv));
          });
        });
      }

      res.json({
        success: true,
        total: participants.length,
        participants
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- SYMPOSIUM EVENTS & TRACKS REGISTRY APIS ---

  // Get active symposium events registry (Public/Read across all authenticated users)
  app.get('/api/events/registry', (req: Request, res: Response) => {
    try {
      const data = serverEventRegistryService.getRegistry();
      res.json({
        success: true,
        registry: data.registry,
        totalEvents: data.totalEvents,
        lastUpdated: data.lastUpdated
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update symposium events & tracks (ADMIN Only - broadcasts to all users)
  app.put('/api/events/registry', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const { registry } = req.body;
      if (!registry || typeof registry !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid "registry" configuration map.'
        });
      }

      const updated = serverEventRegistryService.updateRegistry(registry);

      serverAuthService.logAudit({
        userEmail: req.user?.email || 'admin',
        userName: req.user?.name || 'Administrator',
        role: req.user?.role || 'ADMIN',
        action: 'EVENT_REGISTRY_UPDATED',
        details: `Updated symposium event tracks: ${updated.totalEvents} total events configured.`,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        registry: updated.registry,
        totalEvents: updated.totalEvents,
        lastUpdated: updated.lastUpdated,
        message: 'Symposium events & tracks updated successfully across the entire portal.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset symposium events to default (ADMIN Only)
  app.post('/api/events/registry/reset', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const resetData = serverEventRegistryService.resetToDefault();

      serverAuthService.logAudit({
        userEmail: req.user?.email || 'admin',
        userName: req.user?.name || 'Administrator',
        role: req.user?.role || 'ADMIN',
        action: 'EVENT_REGISTRY_UPDATED',
        details: `Reset symposium events registry to default configuration (${resetData.totalEvents} events).`,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        registry: resetData.registry,
        totalEvents: resetData.totalEvents,
        lastUpdated: resetData.lastUpdated,
        message: 'Symposium events reset to default AIROX configuration.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

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

  // --- OFFLINE REGISTRATIONS APIS (SUPABASE & PERSISTENT DATABASE) ---

  // Diagnostics Endpoint
  app.get('/api/offline/diagnostics', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const diag = await serverSupabaseService.runDiagnostics();
      res.json(diag);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Supabase diagnostic execution failed',
        details: err
      });
    }
  });

  // Get Supabase configuration
  app.get('/api/offline/config', (req, res) => {
    res.json(serverSupabaseService.getConfig());
  });

  // Update Supabase configuration (Admin only)
  app.post('/api/offline/config', requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
    const { supabaseUrl, supabaseAnonKey, tableName } = req.body;
    if (typeof supabaseUrl === 'string' && typeof supabaseAnonKey === 'string') {
      serverSupabaseService.setConfig(supabaseUrl, supabaseAnonKey, tableName);
    }
    res.json({
      success: true,
      config: serverSupabaseService.getConfig()
    });
  });

  // Get SQL Migration Schema
  app.get('/api/offline/sql-schema', (req, res) => {
    res.json({
      sql: serverSupabaseService.getSqlMigrationSchema()
    });
  });

  // READ: Fetch all offline registrations directly from Supabase / persistent store
  app.get('/api/offline/registrations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSupabaseService.fetchRegistrations();
      res.json({
        success: true,
        records: result.records,
        source: result.source,
        message: result.message
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Unable to fetch registrations: ${err.message}`,
        details: err.message
      });
    }
  });

  // SYNC: Force fresh sync from Supabase
  app.post('/api/offline/sync', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSupabaseService.fetchRegistrations();

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Synchronized ${result.records.length} registrations from Supabase.`,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        records: result.records,
        source: result.source,
        message: `Synchronized ${result.records.length} registrations successfully.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Unable to sync: ${err.message}`
      });
    }
  });

  // PUSH SYNC: Write all local database records to Supabase
  app.post(['/api/offline/sync-to-supabase', '/api/offline/sync-to-sheet'], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSupabaseService.syncAllLocalToSupabase();

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'DATA_SYNCED',
          details: `Pushed ${result.syncedCount} offline registrations to Supabase.`,
          status: 'SUCCESS'
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Failed to push sync to Supabase: ${err.message}`
      });
    }
  });

  // CREATE: Append new offline registration (ADMIN, ON_SPOT, REGISTRATION, DATABASE)
  app.post('/api/offline/registrations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && !['ADMIN', 'ON_SPOT', 'REGISTRATION', 'DATABASE'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Creating offline registrations is restricted to Registration desk and Admin team members.'
        });
      }

      const bodyData = req.body.formData || req.body || {};
      const coordinatorName = req.body.coordinatorName || bodyData.registeredBy;

      const fullName = bodyData.fullName || bodyData.name;
      const mobile = bodyData.mobile || bodyData.phone;

      if (!fullName || !mobile) {
        return res.status(400).json({
          success: false,
          error: 'Full Name and Mobile Number are required.'
        });
      }

      const eventString = Array.isArray(bodyData.selectedEvents)
        ? bodyData.selectedEvents.join(', ')
        : String(bodyData.event || bodyData.selectedEvents || '');

      const registeredBy = bodyData.registeredBy || coordinatorName || req.user?.name || 'On Spot Desk';

      const newRecord = await serverSupabaseService.appendRegistration({
        offlineRegistrationId: bodyData.offlineRegistrationId || '',
        fullName: String(fullName).trim(),
        email: bodyData.email || '',
        mobile: String(mobile).trim(),
        college: bodyData.college || '',
        department: bodyData.department || '',
        yearSection: bodyData.yearSection || '',
        event: eventString,
        teamName: bodyData.teamName || '',
        verificationStatus: bodyData.verificationStatus || 'Verified',
        registeredAt: bodyData.registeredAt || '',
        registeredBy,
        updatedAt: '',
        updatedBy: registeredBy,
        status: bodyData.status || 'ACTIVE'
      });

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_CREATED',
          details: `Created offline registration for ${newRecord.fullName} (${newRecord.offlineRegistrationId})`,
          targetId: newRecord.offlineRegistrationId,
          status: 'SUCCESS'
        });
      }

      res.status(201).json({
        success: true,
        record: newRecord,
        message: `Offline registration ${newRecord.offlineRegistrationId} saved successfully!`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Failed to save offline registration: ${err.message}`,
        details: err.message
      });
    }
  });

  // UPDATE: Edit offline registration
  app.put('/api/offline/registrations/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && !['ADMIN', 'ON_SPOT', 'REGISTRATION', 'DATABASE'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Updating offline registrations is restricted to Registration desk and Admin team members.'
        });
      }

      const { id } = req.params;
      const updates = req.body.updates || req.body || {};
      const { coordinatorName } = req.body;
      const actorEmail = coordinatorName || req.user?.email || 'Desk Admin';

      const updatedRecord = await serverSupabaseService.updateRegistration(id, updates, actorEmail);

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_UPDATED',
          details: `Updated offline registration ${id}`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: updatedRecord,
        message: `Registration ${id} updated successfully.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Failed to update registration: ${err.message}`
      });
    }
  });

  // CANCEL: Soft delete offline registration
  app.post('/api/offline/registrations/:id/cancel', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && !['ADMIN', 'ON_SPOT', 'REGISTRATION', 'DATABASE'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Cancelling registrations is restricted to Registration desk and Admin team members.'
        });
      }

      const { id } = req.params;
      const { coordinatorName } = req.body;
      const actorEmail = coordinatorName || req.user?.email || 'Desk Admin';

      const cancelledRecord = await serverSupabaseService.cancelRegistration(id, actorEmail);

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_UPDATED',
          details: `Cancelled offline registration ${id}`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: cancelledRecord,
        message: `Registration ${id} marked as CANCELLED.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Failed to cancel registration: ${err.message}`
      });
    }
  });

  // RESTORE: Restore cancelled offline registration
  app.post('/api/offline/registrations/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user && !['ADMIN', 'ON_SPOT', 'REGISTRATION', 'DATABASE'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Restoring registrations is restricted to Registration desk and Admin team members.'
        });
      }

      const { id } = req.params;
      const { coordinatorName } = req.body;
      const actorEmail = coordinatorName || req.user?.email || 'Desk Admin';

      const restoredRecord = await serverSupabaseService.updateRegistration(
        id,
        { status: 'ACTIVE', verificationStatus: 'Verified' },
        actorEmail
      );

      if (req.user) {
        serverAuthService.logAudit({
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: 'OFFLINE_REGISTRATION_UPDATED',
          details: `Restored offline registration ${id}`,
          targetId: id,
          status: 'SUCCESS'
        });
      }

      res.json({
        success: true,
        record: restoredRecord,
        message: `Registration ${id} restored to ACTIVE.`
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Failed to restore registration: ${err.message}`
      });
    }
  });

  // TEST WRITE: Diagnostic test write
  app.post('/api/offline/test-write', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await serverSupabaseService.executeTestWrite();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `Test write failed: ${err.message}`
      });
    }
  });

  // 404 handler for unknown /api/* routes (ALWAYS JSON)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API endpoint ${req.method} ${req.path} was not found.`
    });
  });

  // Global Error Handler for API (ALWAYS JSON)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[API Server Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });

  // Vite middleware for client frontend
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
    console.log(`AIROX'26 Server running on port ${PORT}`);
  });
}

startServer();
