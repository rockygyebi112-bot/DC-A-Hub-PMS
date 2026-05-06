export type NotificationKind = "overdue" | "due_soon" | "update";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  /** ISO string used both for sort order and unread comparison. */
  timestamp: string;
}

export interface NotificationsBucket {
  overdue: NotificationItem[];
  dueSoon: NotificationItem[];
  recentUpdates: NotificationItem[];
}
