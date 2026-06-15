import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  LineChart,
  ShoppingBag,
  BarChart2,
  ClipboardList,
  Calculator,
  Bell,
  Trophy,
  User as UserIcon,
  BrainCircuit,
} from "lucide-react";

const navItems = [
  { href: "/",            icon: Home,         label: "Home"    },
  { href: "/analyze",     icon: LineChart,     label: "Analyze" },
  { href: "/coach",       icon: BrainCircuit,  label: "AI Coach"},
  { href: "/marketplace", icon: ShoppingBag,   label: "Market"  },
  { href: "/analytics",   icon: BarChart2,     label: "Stats"   },
  { href: "/history",     icon: ClipboardList, label: "History" },
  { href: "/risk",        icon: Calculator,    label: "Risk"    },
  { href: "/alerts",      icon: Bell,          label: "Alerts"  },
  { href: "/propfirm",    icon: Trophy,        label: "PropFirm"},
  { href: "/profile",     icon: UserIcon,      label: "Profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  const hidden = ["/admin", "/analyze", "/marketplace"];
  if (hidden.includes(location)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D1117]/95 backdrop-blur-xl border-t border-[#1E2736] pb-safe">
      {/* Scrollable row — snap-x so swiping feels natural */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex items-center h-[52px] min-w-max px-1 mx-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-[62px] h-full gap-[2px] shrink-0 ${
                  isActive
                    ? "text-[#F0B429]"
                    : "text-[#64748B] hover:text-[#94A3B8]"
                } transition-colors duration-200 active:scale-95`}
              >
                <item.icon
                  className={`w-[17px] h-[17px] ${isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"}`}
                />
                <span className="text-[8px] font-medium leading-none tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#080B14] text-[#F1F5F9] flex flex-col font-sans">
      <div className="flex-1 w-full max-w-[480px] mx-auto flex flex-col relative pb-[52px]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
