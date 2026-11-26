"use client";

import React from "react";
import {
  ArrowLeft,
  Download,
  LayoutDashboard,
  LogOut,
  Radio,
  Trophy,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/app-1-utils/sidebar";

// ─── Types ─────────────────────────────────────────────────────────────────

interface App1SidebarProps {
  onDownloadCSV?: () => void;
  onLogout?: () => void;
}

// ─── Nav items ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "#overview" },
  { label: "Live control", icon: Radio, href: "#live" },
  { label: "Registrations", icon: Users, href: "#registrations" },
  { label: "Events", icon: Trophy, href: "#events" },
] as const;

// ─── Component ─────────────────────────────────────────────────────────────

export function App1Sidebar({ onDownloadCSV, onLogout }: App1SidebarProps) {
  const { setOpenMobile, isMobile } = useSidebar();

  function handleNav(href: string) {
    if (isMobile) setOpenMobile(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <Sidebar>
      {/* Header: Logo + title */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1">
          <img
            src="../Assets/Logo.png"
            alt="UDAAN 2026 logo"
            className="h-8 w-8 object-contain"
          />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-sidebar-foreground">
              UDAAN 2026
            </span>
            <span className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">
              Admin
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main nav */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton onClick={() => handleNav(item.href)}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onDownloadCSV}>
                  <Download className="h-4 w-4 shrink-0" />
                  <span>Download CSV</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Back to site + Log out */}
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="../index.html" className="flex items-center gap-2 w-full text-left">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Back to site</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
