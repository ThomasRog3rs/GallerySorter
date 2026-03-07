"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, ChevronRight, Menu, Settings, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useGallery } from "./GalleryContext";

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

function formatMonth(month: string): string {
  const index = Number(month);
  if (!Number.isInteger(index) || index < 1 || index > 12) return month;
  return monthFormatter.format(new Date(2000, index - 1, 1));
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const {
    configured,
    siteName,
    years,
    months,
    selectedYear,
    selectedMonth,
    loadingYears,
    loadingMonths,
    selectYear,
    selectMonth,
  } = useGallery();

  const onSettings = pathname === "/settings";
  const onUpload = pathname === "/upload";

  return (
    <>
      <Link href="/" className="sidebarHeader" onClick={onNavigate}>
        <Camera className="sidebarLogo" />
        <span className="sidebarTitle">{siteName}</span>
      </Link>

      <nav className="sidebarNav" aria-label="Gallery navigation">
        {!configured && (
          <p className="sidebarEmpty">
            Set your photo directory in Settings to get started.
          </p>
        )}

        {configured && loadingYears && (
          <p className="sidebarLoading">Loading years…</p>
        )}

        {configured && !loadingYears && years.length === 0 && (
          <p className="sidebarEmpty">No years found.</p>
        )}

        {configured &&
          years.map((year) => {
            const isExpanded = selectedYear === year;
            return (
              <div key={year}>
                <button
                  type="button"
                  className={`yearItem${isExpanded ? " yearItemActive" : ""}`}
                  onClick={() => selectYear(isExpanded ? null : year)}
                  aria-expanded={isExpanded}
                >
                  <ChevronRight
                    className={`yearChevron${isExpanded ? " yearChevronOpen" : ""}`}
                  />
                  {year}
                </button>

                {isExpanded && (
                  <ul className="monthList" role="group" aria-label={`Months in ${year}`}>
                    {loadingMonths && (
                      <li className="sidebarLoading" style={{ paddingLeft: "2.75rem" }}>
                        Loading…
                      </li>
                    )}
                    {!loadingMonths &&
                      months.map((month) => {
                        const isActive = selectedMonth === month;
                        return (
                          <li key={month}>
                            <button
                              type="button"
                              className={`monthItem${isActive ? " monthItemActive" : ""}`}
                              onClick={() => {
                                selectMonth(month);
                                onNavigate?.();
                              }}
                              aria-current={isActive ? "true" : undefined}
                            >
                              {formatMonth(month)}
                            </button>
                          </li>
                        );
                      })}
                    {!loadingMonths && months.length === 0 && (
                      <li
                        className="sidebarEmpty"
                        style={{ paddingLeft: "2.75rem", fontSize: "0.8125rem" }}
                      >
                        No months found.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
      </nav>

      <div className="sidebarFooter">
        <Link
          href="/upload"
          className="settingsLink"
          aria-current={onUpload ? "page" : undefined}
          onClick={onNavigate}
        >
          <Upload className="settingsLinkIcon" />
          Upload
        </Link>
        <Link
          href="/settings"
          className="settingsLink"
          aria-current={onSettings ? "page" : undefined}
          onClick={onNavigate}
        >
          <Settings className="settingsLinkIcon" />
          Settings
        </Link>
      </div>
    </>
  );
}

export default function Sidebar() {
  const { siteName } = useGallery();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen, closeMobile]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="mobileHeader">
        <button
          type="button"
          className="mobileMenuButton"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="mobileTitle">
          <Camera size={20} />
          <span>{siteName}</span>
        </Link>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebarOverlay" onClick={closeMobile}>
          <aside
            className="sidebar sidebarMobile"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="mobileCloseButton"
              onClick={closeMobile}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={closeMobile} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar sidebarDesktop">
        <SidebarContent />
      </aside>
    </>
  );
}
