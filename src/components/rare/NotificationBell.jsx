import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Bell, CheckCheck, Trash2, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  subscribeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearAllNotifications
} from '../../lib/notifications';
import { useTypedDocMotion } from '../../lib/motion';
import { cn } from '../../lib/utils';

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationBell({ onSelectDoc, className }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const { reduce, spring } = useTypedDocMotion();

  useEffect(() => {
    const unsubscribe = subscribeNotifications(setNotifications);
    return unsubscribe;
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleItemClick = (n) => {
    markNotificationAsRead(n.id);
    if (n.docId && onSelectDoc) {
      onSelectDoc(n.docId);
      setIsOpen(false);
    }
  };

  return (
    <div className={cn("relative inline-block", className)} ref={popoverRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        className={cn(
          "relative p-2.5 rounded-2xl bg-white/80 border border-[#E8DFD0] hover:bg-white transition-all shadow-xs text-[#3D2E1C]",
          isOpen && "ring-2 ring-[#8B5E3C]/20 border-[#8B5E3C]/40"
        )}
      >
        <Bell className="w-4 h-4 text-[#8B5E3C]" />

        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#8B5E3C] text-white text-[10px] font-bold flex items-center justify-center shadow-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={!reduce ? { opacity: 0, y: 8, scale: 0.96 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={!reduce ? { opacity: 0, y: 8, scale: 0.96 } : false}
            transition={spring}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#FFFBF5] border border-[#E8DFD0] shadow-xl z-50 overflow-hidden font-sans text-xs"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-[#E8DFD0] bg-white/60">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#3D2E1C] text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#8B5E3C]/10 text-[#8B5E3C] font-mono text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    title="Mark all as read"
                    className="p-1 rounded-lg text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8] transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    title="Clear all"
                    className="p-1 rounded-lg text-[#8C7B6B] hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-[#8C7B6B] hover:text-[#3D2E1C] hover:bg-[#F5F0E8] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E8DFD0]/60">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-[#8C7B6B]">
                  <p className="font-medium">No recent notifications</p>
                  <p className="text-[11px] mt-1 opacity-75">OCR events and PDF downloads will appear here.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const Icon = n.type === 'success'
                    ? CheckCircle2
                    : n.type === 'error'
                      ? AlertTriangle
                      : n.type === 'warning'
                        ? AlertTriangle
                        : Info;

                  const colorClass = n.type === 'success'
                    ? 'text-emerald-600'
                    : n.type === 'error'
                      ? 'text-red-600'
                      : n.type === 'warning'
                        ? 'text-amber-600'
                        : 'text-[#8B5E3C]';

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "p-3 transition-colors flex items-start gap-2.5 cursor-pointer",
                        n.read ? "bg-transparent hover:bg-white/60" : "bg-white hover:bg-white/90"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        <Icon className={cn("w-4 h-4", colorClass)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={cn("font-bold text-[12px] truncate", n.read ? "text-[#6B5D4F]" : "text-[#3D2E1C]")}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-[#8C7B6B] font-mono shrink-0">
                            {formatRelativeTime(n.timestamp)}
                          </span>
                        </div>
                        {n.message && (
                          <p className="text-[11px] text-[#8C7B6B] line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        )}
                      </div>

                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#8B5E3C] shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

NotificationBell.propTypes = {
  onSelectDoc: PropTypes.func,
  className: PropTypes.string
};
