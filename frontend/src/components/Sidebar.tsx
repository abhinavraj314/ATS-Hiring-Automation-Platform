import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Briefcase, Users, CheckCircle, Settings, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const SidebarItem = ({ icon: Icon, label, href, active }: { icon: any, label: string, href: string, active: boolean }) => (
  <Link
    to={href}
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted",
      active ? "bg-muted text-foreground" : "text-muted-foreground"
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </Link>
);

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const items = [
    { icon: Briefcase, label: "Jobs", href: "/jobs" },
    { icon: Users, label: "Candidates", href: "/candidates" },
    { icon: CheckCircle, label: "Shortlisted", href: "/shortlisted" },
    { icon: UserCog, label: "Panel", href: "/panel" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-6">
        <span className="text-lg font-bold tracking-tight text-foreground">ATS Platform</span>
      </div>
      <div className="flex-1 space-y-1 p-4">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            href={item.href}
            active={location.pathname.startsWith(item.href)}
          />
        ))}
      </div>
      <div className="border-t border-border p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
