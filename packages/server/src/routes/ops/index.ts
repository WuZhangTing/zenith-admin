import { upgradeWebSocket } from '@hono/node-server';
import { defineRouteDomain } from '../_kit';
import dbAdminRoutes from './db-admin';
import dbBackupsRoutes from './db-backups';
import dockerRoutes from './docker';
import firewallRoutes from './firewall';
import logFilesRoutes from './log-files';
import logViewerRoutes from './log-viewer';
import maintenanceRoutes from './maintenance';
import networkDiagRoutes from './network-diag';
import nginxSitesRoutes from './nginx-sites';
import portsRoutes from './ports';
import processesRoutes from './processes';
import retentionRoutes from './retention';
import sshProfilesRoutes from './ssh-profiles';
import sshSftpRoutes from './ssh-sftp';
import sslCertificatesRoutes from './ssl-certificates';
import systemdRoutes from './systemd';
import terminalFilesRoutes from './terminal-files';
import terminalRecordingsRoutes from './terminal-recordings';
import terminalSessionsRoutes from './terminal-sessions';
import { createWsTerminalRoute, createWsTerminalMonitorRoute } from './ws-terminal';

export default defineRouteDomain({
  name: 'ops',
  mounts: () => [
    ['/api/maintenance', maintenanceRoutes],
    ['/api/ssl-certificates', sslCertificatesRoutes],
    ['/api/db-backups', dbBackupsRoutes],
    ['/api/db-admin', dbAdminRoutes],
    ['/api/ws/terminal', createWsTerminalRoute(upgradeWebSocket)],
    ['/api/ws/terminal-monitor', createWsTerminalMonitorRoute(upgradeWebSocket)],
    ['/api/processes', processesRoutes],
    ['/api/terminal-files', terminalFilesRoutes],
    ['/api/terminal-recordings', terminalRecordingsRoutes],
    ['/api/ssh-profiles', sshProfilesRoutes],
    ['/api/ssh-sftp', sshSftpRoutes],
    ['/api/terminal-sessions', terminalSessionsRoutes],
    ['/api/ports', portsRoutes],
    ['/api/firewall', firewallRoutes],
    ['/api/docker', dockerRoutes],
    ['/api/network-diag', networkDiagRoutes],
    ['/api/systemd', systemdRoutes],
    ['/api/log-viewer', logViewerRoutes],
    ['/api/nginx-sites', nginxSitesRoutes],
    ['/api/log-files', logFilesRoutes],
    ['/api/retention-policies', retentionRoutes],
  ],
});
