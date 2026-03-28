import { useState } from "react";
import type { ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Menu, MessageSquare, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useDataset } from "@/shared/data/DataContext";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { dataset, clearDataset } = useDataset();

  const isActive = (path: string) => location.pathname === path;

  const handleClearDataset = async () => {
    if (window.confirm("Are you sure you want to delete the current dataset?")) {
      await clearDataset();
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } flex flex-col border-r border-border bg-card transition-all duration-300`}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">InsightFlow</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="rounded-lg p-1 transition-colors hover:bg-muted"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          <NavLink
            icon={Home}
            label="Dashboard"
            active={isActive("/")}
            collapsed={!sidebarOpen}
            onClick={() => navigate("/")}
          />
          <NavLink
            icon={Upload}
            label="Upload"
            active={isActive("/upload")}
            collapsed={!sidebarOpen}
            onClick={() => navigate("/upload")}
          />
          <NavLink
            icon={MessageSquare}
            label="Chat"
            active={isActive("/chat")}
            collapsed={!sidebarOpen}
            disabled={!dataset}
            onClick={() => navigate("/chat")}
          />
        </nav>

        {dataset && (
          <div className="space-y-3 border-t border-border p-4">
            <div className="text-xs text-muted-foreground">
              <p className="truncate">
                <strong>File:</strong> {dataset.fileName}
              </p>
              <p>
                <strong>Rows:</strong> {dataset.totalRows}
              </p>
            </div>
            <button
              onClick={handleClearDataset}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
              {sidebarOpen && "Clear Dataset"}
            </button>
          </div>
        )}
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

interface NavLinkProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  collapsed: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function NavLink({ icon: Icon, label, active, collapsed, disabled, onClick }: NavLinkProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}
