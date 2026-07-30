import { defineRouteDomain } from '../_kit';
import asyncTasksRoutes from './async-tasks';
import cronJobsRoutes from './cron-jobs';
import exportJobsRoutes from './export-jobs';
import systemSchedulerRoutes from './system-scheduler';
import taskDemoRoutes from './task-demo';

export default defineRouteDomain({
  name: 'tasks',
  mounts: () => [
    ['/api/export-jobs', exportJobsRoutes],
    ['/api/async-tasks', asyncTasksRoutes],
    ['/api/system-scheduler', systemSchedulerRoutes],
    ['/api/cron-jobs', cronJobsRoutes],
    ['/api/task-demo', taskDemoRoutes],
  ],
});
