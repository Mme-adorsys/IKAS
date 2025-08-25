'use client';

import React, { useEffect, useState } from 'react';
import { useIKASStore } from '@/store';
import { VoicePanel } from './VoicePanel';
import { SystemStatus } from './SystemStatus';
import { EventsPanel } from './EventsPanel';
import { UsersPanel } from './UsersPanel';
import { CompliancePanel } from './CompliancePanel';
import { AnalysisPanel } from './AnalysisPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { ChatPanel } from './ChatPanel';

export function IKASDashboard() {
  const {
    ui,
    system,
    voice,
    data,
    analysis,
    initializeServices,
    connectWebSocket,
    setActiveView,
    toggleSidebar,
    toggleDarkMode
  } = useIKASStore();

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing IKAS Dashboard...');
        
        // Initialize services
        await initializeServices();
        
        // Connect to WebSocket
        await connectWebSocket('dashboard-user', 'master');
        
        setIsInitialized(true);
        console.log('✅ IKAS Dashboard initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize IKAS Dashboard:', error);
        setIsInitialized(false);
      }
    };

    initializeApp();
  }, [initializeServices, connectWebSocket]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            IKAS wird gestartet...
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Verbindung zu den Services wird hergestellt
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${ui.darkMode ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  IKAS
                </h1>
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                  Intelligentes Keycloak Admin System
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* System Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  system.websocketConnected ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {system.websocketConnected ? 'Verbunden' : 'Getrennt'}
                </span>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                {ui.darkMode ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m7 0v1a3 3 0 01-6 0v-1" />
                  </svg>
                </button>
                {ui.notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-0 right-0 block h-4 w-4 bg-red-400 rounded-full text-xs text-white text-center leading-4">
                    {ui.notifications.filter(n => !n.read).length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          {ui.sidebarOpen && (
            <nav className="w-64 bg-white dark:bg-gray-800 shadow-sm h-screen overflow-y-auto">
              <div className="p-4">
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'dashboard'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                    Dashboard
                  </button>

                  <button
                    onClick={() => setActiveView('voice')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'voice'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Sprachsteuerung
                    {voice.isListening && (
                      <div className="ml-auto w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveView('users')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'users'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    Benutzer
                    <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                      {data.users.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveView('compliance')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'compliance'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Compliance
                    {data.complianceIssues.length > 0 && (
                      <span className="ml-auto text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded-full">
                        {data.complianceIssues.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveView('analysis')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'analysis'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Analyse
                    {analysis.activeAnalyses.size > 0 && (
                      <div className="ml-auto w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveView('chat')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'chat'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Chat Interface
                    {system.websocketConnected && (
                      <div className="ml-auto w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                  </button>
                </div>
              </div>
            </nav>
          )}

          {/* Main Content */}
          <main className={`flex-1 ${ui.activeView === 'chat' ? 'p-0' : 'p-6'}`}>
            {ui.activeView === 'dashboard' && <DashboardOverview />}
            {ui.activeView === 'voice' && <VoicePanel />}
            {ui.activeView === 'users' && <UsersPanel />}
            {ui.activeView === 'compliance' && <CompliancePanel />}
            {ui.activeView === 'analysis' && <AnalysisPanel />}
            {ui.activeView === 'chat' && (
              <div className="h-full">
                <ChatPanel />
              </div>
            )}
          </main>
        </div>

        {/* Floating Notifications */}
        <NotificationsPanel />
      </div>
    </div>
  );
}

// Dashboard Overview Component
function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Willkommen im IKAS Intelligenten Keycloak Admin System
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* System Status */}
        <SystemStatus />
        
        {/* Recent Events */}
        <EventsPanel />
        
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Schnellaktionen
          </h3>
          
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Benutzer anzeigen
                </span>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button className="w-full flex items-center justify-between p-3 text-left bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Compliance prüfen
                </span>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button className="w-full flex items-center justify-between p-3 text-left bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Sprachsteuerung
                </span>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}