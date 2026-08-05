export function sanitizeToolId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}
