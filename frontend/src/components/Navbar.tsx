"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  interface NavLinkProps {
    href: string;
    text: string;
  }

  const NavLink: React.FC<NavLinkProps> = ({ href, text }) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        pathname === href
          ? "text-orange-500 font-semibold"
          : "text-gray-700 hover:text-gray-900"
      }`}
    >
      {text}
    </Link>
  );

  return (
    <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm w-full mb-3 top-0 z-50 fixed">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <span className="text-orange-500 font-bold text-2xl">Leet</span>
              <span className="text-gray-900 font-bold text-2xl">Stats</span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            <NavLink href="/leaderboard" text="Leaderboard" />
            <NavLink href="/analysis" text="Analysis" />
            <NavLink href="/about" text="About Us" />
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isOpen && (
          <div className="md:hidden mt-2 space-y-2 flex flex-col items-center bg-white shadow-md py-3 rounded-md">
            <NavLink href="/leaderboard" text="Leaderboard" />
            <NavLink href="/analysis" text="Analysis" />
            <NavLink href="/about" text="About Us" />
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
