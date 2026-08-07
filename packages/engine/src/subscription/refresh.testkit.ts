export function antigravityRefreshBlob(projectId: string): string {
  return JSON.stringify({
    access_token: 'old-access',
    refresh_token: 'shared-google-refresh',
    expired: '2020-01-01T00:00:00.000Z',
    project_id: projectId,
  });
}
