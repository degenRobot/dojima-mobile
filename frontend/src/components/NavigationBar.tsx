'use client';

import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { WalletSelector } from '@/components/WalletSelector';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavigationBar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  return (
    <nav className="border-b-2 border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:supports-[backdrop-filter]:bg-gray-900/85 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="text-2xl font-bold gradient-text transition-transform group-hover:scale-105">
                Dojima CLOB
              </div>
              <span className="text-2xl">⛩️</span>
            </Link>
            
            {/* Navigation Links - No dropdown for templates */}
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/portfolio"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/portfolio' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/portfolio' ? 'after:scale-x-100' : ''
                }`}
              >
                Portfolio
              </Link>
              <Link 
                href="/trade/WETH-USDC"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname.startsWith('/trade') 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname.startsWith('/trade') ? 'after:scale-x-100' : ''
                }`}
              >
                Trade
              </Link>
              <Link 
                href="/markets"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/markets' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/markets' ? 'after:scale-x-100' : ''
                }`}
              >
                Markets
              </Link>
              <Link 
                href="/leaderboard"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/leaderboard' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/leaderboard' ? 'after:scale-x-100' : ''
                }`}
              >
                Leaderboard
              </Link>
              <Link 
                href="/analytics"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/analytics' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/analytics' ? 'after:scale-x-100' : ''
                }`}
              >
                Analytics
              </Link>
              <Link 
                href="/debug"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/debug' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/debug' ? 'after:scale-x-100' : ''
                }`}
              >
                Debug
              </Link>
              <Link 
                href="/events"
                className={`text-sm font-medium transition-all duration-300 relative ${
                  pathname === '/events' 
                    ? 'text-[#2E5090] dark:text-[#92b5d4]' 
                    : 'text-gray-700 dark:text-gray-300 hover:text-[#2E5090] dark:hover:text-[#92b5d4]'
                } after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-[#E74C3C] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 ${
                  pathname === '/events' ? 'after:scale-x-100' : ''
                }`}
              >
                Events
              </Link>
            </nav>
          </div>

          {/* Right side items */}
          <div className="flex items-center gap-4">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-9 h-9"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                  />
                </svg>
              )}
            </Button>
            
            {/* Wallet Selector */}
            <WalletSelector />
          </div>
        </div>
      </div>
    </nav>
  );
}