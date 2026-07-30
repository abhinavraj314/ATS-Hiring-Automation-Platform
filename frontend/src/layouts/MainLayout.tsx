import React from "react";
import Sidebar from "../components/Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
