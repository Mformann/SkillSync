import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useGrowthResource } from "./growth-ui";
import type { Reminder } from "./growth-contacts-panel";

export function CareerReminderBell() {
  const resource = useGrowthResource<{ items: Reminder[]; today: string }>("/growth/reminders");
  useEffect(() => { const timer = window.setInterval(resource.reload, 60000); return () => window.clearInterval(timer); }, [resource.reload]);
  const count = resource.data?.items.filter(item => item.due_date <= resource.data!.today).length || 0;
  return <Link to="/career/growth?tab=contacts" aria-label={resource.error ? "Reminder inbox (connection unavailable)" : `Reminder inbox, ${count} due`} className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Bell className="size-4" />{count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-xs leading-5 text-primary-foreground">{count > 9 ? "9+" : count}</span>}</Link>;
}
