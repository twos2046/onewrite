import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, FileText, Video, Users } from 'lucide-react';
import { NAV_SHORT_LABELS } from '@/config/brand';

const BottomNav: React.FC = () => {
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      label: NAV_SHORT_LABELS.create,
      icon: BookOpen,
    },
    {
      path: '/script',
      label: NAV_SHORT_LABELS.script,
      icon: FileText,
    },
    {
      path: '/filming',
      label: NAV_SHORT_LABELS.filming,
      icon: Video,
    },
    {
      path: '/community',
      label: NAV_SHORT_LABELS.community,
      icon: Users,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/community') {
      return location.pathname === '/community' || location.pathname.startsWith('/community/');
    }
    return location.pathname === path;
  };

  return (
    <nav className="max-[729px]:block hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active
                  ? 'text-[#FF5724]'
                  : 'text-gray-600 hover:text-[#FF5724]'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className={`text-xs ${active ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
