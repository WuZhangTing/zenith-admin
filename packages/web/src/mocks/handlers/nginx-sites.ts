import { http } from 'msw';
import { ok, notFound } from '@/mocks/utils/handlers';
import { mockDateTime } from '../utils/date';

const mockInfo = {
  installed: true,
  version: '1.24.0',
  configPath: '/etc/nginx/nginx.conf',
  sitesAvailable: '/etc/nginx/sites-available',
  sitesEnabled: '/etc/nginx/sites-enabled',
  runningStatus: 'running',
};

interface MockNginxSite {
  name: string;
  enabled: boolean;
  configPath: string;
  serverName: string | null;
  listenPort: number | null;
  root: string | null;
  sslEnabled: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

const mockSites: MockNginxSite[] = [
  { name: 'default', enabled: true, configPath: '/etc/nginx/sites-available/default', serverName: '_', listenPort: 80, root: '/var/www/html', sslEnabled: false, createdAt: '2024-01-01 00:00:00', updatedAt: '2024-01-01 00:00:00' },
  { name: 'example.com', enabled: true, configPath: '/etc/nginx/sites-available/example.com', serverName: 'example.com www.example.com', listenPort: 443, root: '/var/www/example.com', sslEnabled: true, createdAt: '2024-03-15 10:00:00', updatedAt: '2024-03-15 10:00:00' },
  { name: 'api.example.com', enabled: false, configPath: '/etc/nginx/sites-available/api.example.com', serverName: 'api.example.com', listenPort: 80, root: null, sslEnabled: false, createdAt: '2024-05-01 08:00:00', updatedAt: '2024-05-01 08:00:00' },
];

const mockConfig = `server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

export const nginxSitesHandlers = [
  http.get('/api/nginx-sites/info', () => ok(mockInfo)),
  http.get('/api/nginx-sites', () => ok(mockSites)),
  http.get('/api/nginx-sites/:name', ({ params }) => {
    const site = mockSites.find((s) => s.name === params.name);
    if (!site) return notFound('站点不存在', { status: 404 });
    return ok({ ...site, content: mockConfig });
  }),
  http.post('/api/nginx-sites', async ({ request }) => {
    const body = await request.json() as { name: string; serverName: string; listenPort?: number; root?: string; sslEnabled?: boolean };
    mockSites.push({
      name: body.name,
      enabled: false,
      configPath: `/etc/nginx/sites-available/${body.name}`,
      serverName: body.serverName,
      listenPort: body.listenPort ?? 80,
      root: body.root ?? null,
      sslEnabled: !!body.sslEnabled,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    });
    return ok(null, '站点已创建');
  }),
  http.put('/api/nginx-sites/:name', () => ok(null, '配置已保存')),
  http.delete('/api/nginx-sites/:name', ({ params }) => {
    const idx = mockSites.findIndex((s) => s.name === params.name);
    if (idx !== -1) mockSites.splice(idx, 1);
    return ok(null, '站点已删除');
  }),
  http.post('/api/nginx-sites/:name/enable', ({ params }) => {
    const site = mockSites.find((s) => s.name === params.name);
    if (site) site.enabled = true;
    return ok(null, '站点已启用');
  }),
  http.post('/api/nginx-sites/:name/disable', ({ params }) => {
    const site = mockSites.find((s) => s.name === params.name);
    if (site) site.enabled = false;
    return ok(null, '站点已禁用');
  }),
  http.post('/api/nginx-sites/test', () => ok({ success: true, output: 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful' })),
  http.post('/api/nginx-sites/reload', () => ok(null, 'Nginx 已重载')),
];
