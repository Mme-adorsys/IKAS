'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveLoginEvent } from '@/types/security';

interface LiveActivityTickerProps {
  events: LiveLoginEvent[];
  maxRows?: number;
}

export function LiveActivityTicker({ events, maxRows = 40 }: LiveActivityTickerProps) {
  const rows = useMemo(() => events.slice(0, maxRows), [events, maxRows]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col h-full min-h-[260px]">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wide">
            Live-Aktivitätsfeed
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
            {events.length} Events
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <AnimatePresence initial={false}>
          {rows.map(ev => {
            const colour = !ev.success
              ? 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10'
              : ev.ipClassification === 'tor' || ev.ipClassification === 'datacenter' || ev.ipClassification === 'known-bad'
                ? 'border-l-yellow-500 bg-yellow-50/40 dark:bg-yellow-900/10'
                : 'border-l-green-500 bg-green-50/40 dark:bg-green-900/10';
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -10, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`border-l-2 ${colour} px-3 py-2 mb-1 rounded-r-md`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-gray-500 dark:text-gray-400">
                    {new Date(ev.time).toLocaleTimeString('de-DE', { hour12: false })}
                  </span>
                  <span className={`uppercase font-semibold ${ev.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {ev.type}
                  </span>
                </div>
                <div className="text-sm text-gray-900 dark:text-white mt-0.5 truncate">
                  <span className="font-medium">{ev.username ?? 'unknown'}</span>
                  {' · '}
                  <span className="text-gray-600 dark:text-gray-400">{ev.ip}</span>
                  {' · '}
                  <span className="text-gray-500 dark:text-gray-400">{ev.city}, {ev.country}</span>
                </div>
                {ev.ipClassification !== 'normal' && (
                  <div className="mt-1">
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold">
                      {ev.ipClassification}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {rows.length === 0 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            Warte auf Events …
          </div>
        )}
      </div>
    </div>
  );
}
