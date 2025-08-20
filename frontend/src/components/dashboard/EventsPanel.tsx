'use client';

import React from 'react';
import { useIKASStore } from '@/store';
import { EventType } from '@/types/events';

export function EventsPanel() {
  const { events, markEventsAsRead, clearEvents } = useIKASStore();

  const getEventIcon = (eventType: EventType) => {
    switch (eventType) {
      case EventType.VOICE_COMMAND:
        return (
          <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        );
      case EventType.VOICE_RESPONSE:
        return (
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case EventType.USER_CREATED:
      case EventType.USER_UPDATED:
      case EventType.USER_DELETED:
        return (
          <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case EventType.COMPLIANCE_ALERT:
        return (
          <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case EventType.ANALYSIS_PROGRESS:
      case EventType.ANALYSIS_COMPLETED:
        return (
          <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case EventType.GRAPH_UPDATE:
        return (
          <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getEventTitle = (eventType: EventType) => {
    switch (eventType) {
      case EventType.VOICE_COMMAND: return 'Sprachbefehl';
      case EventType.VOICE_RESPONSE: return 'Sprachantwort';
      case EventType.USER_CREATED: return 'Benutzer erstellt';
      case EventType.USER_UPDATED: return 'Benutzer aktualisiert';
      case EventType.USER_DELETED: return 'Benutzer gelöscht';
      case EventType.COMPLIANCE_ALERT: return 'Compliance-Warnung';
      case EventType.ANALYSIS_PROGRESS: return 'Analyse läuft';
      case EventType.ANALYSIS_COMPLETED: return 'Analyse abgeschlossen';
      case EventType.GRAPH_UPDATE: return 'Graph aktualisiert';
      default: return 'System-Event';
    }
  };

  const formatEventPayload = (event: any) => {
    if (event.type === EventType.VOICE_COMMAND) {
      return `"${event.payload.command}"`;
    }
    if (event.type === EventType.VOICE_RESPONSE) {
      return event.payload.response?.substring(0, 50) + '...';
    }
    if (event.type === EventType.USER_CREATED || event.type === EventType.USER_UPDATED) {
      return `${event.payload.username} (${event.payload.email})`;
    }
    if (event.type === EventType.COMPLIANCE_ALERT) {
      return `${event.payload.rule}: ${event.payload.severity}`;
    }
    if (event.type === EventType.ANALYSIS_PROGRESS) {
      return `${event.payload.analysisType}: ${event.payload.progress}%`;
    }
    if (event.type === EventType.ANALYSIS_COMPLETED) {
      return `${event.payload.analysisType}: ${event.payload.status}`;
    }
    
    return 'Details verfügbar';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return 'gerade eben';
    } else if (diffMins < 60) {
      return `vor ${diffMins}m`;
    } else if (diffHours < 24) {
      return `vor ${diffHours}h`;
    } else {
      return date.toLocaleDateString('de-DE', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const recentEvents = events.events.slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Letzte Events
        </h3>
        <div className="flex items-center space-x-2">
          {events.unreadCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
              {events.unreadCount} neu
            </span>
          )}
          <button
            onClick={clearEvents}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Löschen
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {recentEvents.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
            </svg>
            <p className="text-sm">Keine Events verfügbar</p>
            <p className="text-xs mt-1">Events erscheinen hier in Echtzeit</p>
          </div>
        ) : (
          recentEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                {getEventIcon(event.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getEventTitle(event.type)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(event.timestamp)}
                  </p>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                  {formatEventPayload(event)}
                </p>
                
                {event.sessionId && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Session: {event.sessionId.substring(0, 8)}...
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {events.unreadCount > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={markEventsAsRead}
            className="w-full text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium"
          >
            Alle als gelesen markieren
          </button>
        </div>
      )}
    </div>
  );
}