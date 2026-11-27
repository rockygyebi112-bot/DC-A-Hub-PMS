export const unescoDashboardSlugs = ["youth-in-work", "participant-trajectory"] as const;
export type UnescoDashboardSlug = (typeof unescoDashboardSlugs)[number];

export const unescoDashboards = {
  "youth-in-work": { title: "Youth in Work", filename: "UNESCO_Youth_in_Work.html" },
  "participant-trajectory": { title: "Participant Trajectory", filename: "UNESCO_Participant_Trajectory.html" },
} satisfies Record<UnescoDashboardSlug, { title: string; filename: string }>;

export function isUnescoDashboardSlug(value: string): value is UnescoDashboardSlug {
  return unescoDashboardSlugs.some((slug) => slug === value);
}

export function unescoDashboardPath(slug?: UnescoDashboardSlug) {
  const base = "/portal/projects/unesco/dashboards";
  return slug ? `${base}/${slug}` : base;
}

export function isDashboardPagePath(path: string) {
  return /^\/portal\/projects\/(?:unesco|[\da-f-]+)\/dashboards(?:\/(?:youth-in-work|participant-trajectory))?$/i.test(path);
}
