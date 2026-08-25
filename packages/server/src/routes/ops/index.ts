import { upgradeWebSocket } from '@hono/node-server';
import { defineRouteDomain } from '../_kit';
import appReleasesRoutes from './app-releases';
import publicAppReleasesRoutes from './public-app-releases';
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
    ['/api/ssl-certificates', sslCertificatesRoutes, { feature: 'ops' }],
    ['/api/db-backups', dbBackupsRoutes, { feature: 'ops' }],
    ['/api/db-admin', dbAdminRoutes, { feature: 'ops' }],
    ['/api/ws/terminal', createWsTerminalRoute(upgradeWebSocket), { feature: 'ops' }],
    ['/api/ws/terminal-monitor', createWsTerminalMonitorRoute(upgradeWebSocket), { feature: 'ops' }],
    ['/api/processes', processesRoutes, { feature: 'ops' }],
    ['/api/terminal-files', terminalFilesRoutes, { feature: 'ops' }],
    ['/api/terminal-recordings', terminalRecordingsRoutes, { feature: 'ops' }],
    ['/api/ssh-profiles', sshProfilesRoutes, { feature: 'ops' }],
    ['/api/ssh-sftp', sshSftpRoutes, { feature: 'ops' }],
    ['/api/terminal-sessions', terminalSessionsRoutes, { feature: 'ops' }],
    ['/api/ports', portsRoutes, { feature: 'ops' }],
    ['/api/firewall', firewallRoutes, { feature: 'ops' }],
    ['/api/docker', dockerRoutes, { feature: 'ops' }],
    ['/api/network-diag', networkDiagRoutes, { feature: 'ops' }],
    ['/api/systemd', systemdRoutes, { feature: 'ops' }],
    ['/api/log-viewer', logViewerRoutes, { feature: 'ops' }],
    ['/api/nginx-sites', nginxSitesRoutes, { feature: 'ops' }],
    ['/api/log-files', logFilesRoutes, { feature: 'ops' }],
    ['/api/retention-policies', retentionRoutes, { feature: 'ops' }],
    ['/api/app-releases', appReleasesRoutes],
    // 公开面（客户端检查更新 / 制品分发）不声明 feature：在网客户端必须始终可达
    ['/api/public/app-releases', publicAppReleasesRoutes],
  ],
});
