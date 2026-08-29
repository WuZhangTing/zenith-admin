import { http, HttpResponse } from 'msw';
import { mockDateTime } from '@/mocks/utils/date';
import { badRequest, ok, notFound } from '@/mocks/utils/handlers';

const API = import.meta.env.VITE_API_BASE_URL || '';
const HOME = '/home/ops';

type Entry = {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  permissions: string;
  content?: string;
};

const entriesByHost = new Map<string, Entry[]>();

function hostEntries(hostId: string): Entry[] {
  let entries = entriesByHost.get(hostId);
  if (!entries) {
    entries = [
      { name: 'logs', path: `${HOME}/logs`, type: 'dir', size: 0, mtime: mockDateTime(), permissions: 'rwxr-xr-x' },
      { name: 'deploy.sh', path: `${HOME}/deploy.sh`, type: 'file', size: 34, mtime: mockDateTime(), permissions: 'rwxr-xr-x', content: `#!/bin/sh\necho "demo deploy on host ${hostId}"\n` },
      { name: 'app.log', path: `${HOME}/logs/app.log`, type: 'file', size: 26, mtime: mockDateTime(), permissions: 'rw-r--r--', content: `INFO demo host ${hostId} is healthy\n` },
    ];
    entriesByHost.set(hostId, entries);
  }
  return entries;
}

function parent(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

export const hostFileHandlers = [
  http.get(`${API}/api/host-files/:hostId/home`, () => ok({ home: HOME })),
  http.get(`${API}/api/host-files/:hostId/list`, ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const path = new URL(request.url).searchParams.get('path') || HOME;
    const list = entries.filter((entry) => parent(entry.path) === path).map(({ content: _content, ...entry }) => entry);
    return ok({ path, parent: path === '/' ? null : parent(path), entries: list });
  }),
  http.get(`${API}/api/host-files/:hostId/content`, ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const entry = entries.find((item) => item.path === path && item.type === 'file');
    return entry
      ? ok({ path, content: entry.content ?? '', size: entry.size, etag: `demo-${entry.mtime}-${entry.size}` })
      : notFound('文件不存在', { status: 404 });
  }),
  http.put(`${API}/api/host-files/:hostId/content`, async ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const body = await request.json() as { path: string; content: string };
    const entry = entries.find((item) => item.path === body.path);
    if (!entry) return notFound('文件不存在', { status: 404 });
    entry.content = body.content;
    entry.size = new TextEncoder().encode(body.content).length;
    entry.mtime = mockDateTime();
    return ok(entry);
  }),
  http.post(`${API}/api/host-files/:hostId/create`, async ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const body = await request.json() as { path: string; type: 'file' | 'dir' };
    const entry: Entry = {
      name: body.path.split('/').pop() ?? body.path,
      path: body.path,
      type: body.type,
      size: 0,
      mtime: mockDateTime(),
      permissions: body.type === 'dir' ? 'rwxr-xr-x' : 'rw-r--r--',
      ...(body.type === 'file' ? { content: '' } : {}),
    };
    entries.push(entry);
    return ok(entry);
  }),
  http.post(`${API}/api/host-files/:hostId/rename`, async ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const body = await request.json() as { from: string; to: string };
    const entry = entries.find((item) => item.path === body.from);
    if (!entry) return notFound('文件不存在', { status: 404 });
    entry.path = body.to;
    entry.name = body.to.split('/').pop() ?? body.to;
    return ok(entry);
  }),
  http.post(`${API}/api/host-files/:hostId/chmod`, () => ok(null)),
  http.get(`${API}/api/host-files/:hostId/download`, ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const entry = entries.find((item) => item.path === path && item.type === 'file');
    return entry
      ? new HttpResponse(entry.content ?? '', {
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      : notFound('文件不存在', { status: 404 });
  }),
  http.post(`${API}/api/host-files/:hostId/upload`, async ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const form = await request.formData();
    const dir = String(form.get('path') ?? HOME);
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('未选择文件');
    const entry: Entry = {
      name: file.name,
      path: `${dir.replace(/\/+$/, '')}/${file.name}`,
      type: 'file',
      size: file.size,
      mtime: mockDateTime(),
      permissions: 'rw-r--r--',
      content: await file.text(),
    };
    entries.push(entry);
    return ok(entry);
  }),
  http.delete(`${API}/api/host-files/:hostId/entry`, ({ params, request }) => {
    const entries = hostEntries(String(params.hostId));
    const path = new URL(request.url).searchParams.get('path') ?? '';
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].path === path || entries[index].path.startsWith(`${path}/`)) entries.splice(index, 1);
    }
    return ok(null);
  }),
];
