/**
 * Determine project status based on start/end dates
 * Returns: 'upcoming' | 'active' | 'completed' | null (no dates set)
 */
export function getProjectStatus(project) {
  if (!project.startDate && !project.endDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (project.startDate) {
    const start = new Date(project.startDate);
    start.setHours(0, 0, 0, 0);
    if (now < start) return 'upcoming';
  }

  if (project.endDate) {
    const end = new Date(project.endDate);
    end.setHours(0, 0, 0, 0);
    if (now > end) return 'completed';
  }

  return 'active';
}

/**
 * Calculate days remaining or elapsed
 */
export function getProjectTimeInfo(project) {
  if (!project.endDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(project.endDate);
  end.setHours(0, 0, 0, 0);

  const diffMs = end - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return { type: 'remaining', days: diffDays };
  if (diffDays === 0) return { type: 'today', days: 0 };
  return { type: 'elapsed', days: Math.abs(diffDays) };
}

/**
 * Calculate project timeline progress percentage
 */
export function getProjectProgress(project) {
  if (!project.startDate || !project.endDate) return null;

  const now = new Date();
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);

  const total = end - start;
  if (total <= 0) return 100;

  const elapsed = now - start;
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(100, pct));
}
