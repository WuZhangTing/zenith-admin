import { describe, expect, it } from 'vitest';
import { hasPageComponent, lazyPageComponent } from './page-registry';

describe('page registry', () => {
  it('reuses the same lazy component identity across parent rerenders', () => {
    const first = lazyPageComponent('users/UsersPage');
    const second = lazyPageComponent('/users/UsersPage.tsx');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('returns null for unknown page components', () => {
    expect(hasPageComponent('missing/UnknownPage')).toBe(false);
    expect(lazyPageComponent('missing/UnknownPage')).toBeNull();
  });

  it('registers only the new alert center page paths', () => {
    expect(hasPageComponent('alerts/rules/AlertRulesPage')).toBe(true);
    expect(hasPageComponent('alerts/events/AlertEventsPage')).toBe(true);
    expect(hasPageComponent('system/monitor-alerts/MonitorAlertsPage')).toBe(false);
    expect(hasPageComponent('system/monitor-alert-events/MonitorAlertEventsPage')).toBe(false);
  });

  it('excludes tests and loading skeletons', () => {
    expect(hasPageComponent('analytics/AnalyticsDebugTab.test')).toBe(false);
    expect(hasPageComponent('workflow/designer/components/FormDesigner.test')).toBe(false);
    expect(hasPageComponent('dashboard/DashboardSkeleton')).toBe(false);
  });
});
