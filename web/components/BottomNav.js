"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/carpool", label: "Find Carpool", icon: CarpoolIcon },
  { href: "/parking", label: "Find Parking", icon: ParkingIcon },
  { href: "/profile", label: "Profile Settings", icon: ProfileIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto w-full max-w-md border-t border-white/10 bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <ul className="grid grid-cols-4 gap-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-center"
                >
                  <Icon active={active} />
                  <span
                    className={`text-[11px] leading-none ${
                      active ? "text-accent" : "text-muted"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function iconColor(active) {
  return active ? "#C41E3A" : "#6B7280";
}

function HomeIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5Z"
        stroke={iconColor(active)}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CarpoolIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 13h12l-1.5-4.5A2 2 0 0 0 14.6 7H9.4a2 2 0 0 0-1.9 1.5L6 13Z"
        stroke={iconColor(active)}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M5 13h14a1 1 0 0 1 1 1v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a1 1 0 0 1 1-1Z"
        stroke={iconColor(active)}
        strokeWidth="1.7"
      />
      <circle cx="8" cy="16" r="1" fill={iconColor(active)} />
      <circle cx="16" cy="16" r="1" fill={iconColor(active)} />
    </svg>
  );
}

function ParkingIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z"
        stroke={iconColor(active)}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.5" stroke={iconColor(active)} strokeWidth="1.7" />
    </svg>
  );
}

function ProfileIcon({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke={iconColor(active)} strokeWidth="1.7" />
      <path
        d="M5 20a7 7 0 0 1 14 0"
        stroke={iconColor(active)}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
