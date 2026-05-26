'use client';

import React, { useEffect, useState } from 'react';
import { useIKASStore } from '@/store';
import { ChatPanel } from './ChatPanel';
import { SystemStatus } from './SystemStatus';
import { EventsPanel } from './EventsPanel';
import { UsersPanel } from './UsersPanel';
import { CompliancePanel } from './CompliancePanel';
import { AnalysisPanel } from './AnalysisPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { QuickActions } from './QuickActions';
import { SecurityPanel } from './SecurityPanel';
import { FixesPanel } from './FixesPanel';
import { PromptManagementView } from '@/components/prompts/PromptManagementView';

export function IKASDashboard() {
  const {
    ui,
    system,
    data,
    analysis,
    prompts,
    initializeServices,
    connectWebSocket,
    setActiveView,
    toggleSidebar,
    toggleDarkMode
  } = useIKASStore();
  const openFixCount = useIKASStore(s => s.security.findings.filter(f => f.status === 'open').length);

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

              {/* Cost-Locked Model Badge — always visible during the demo so the
                  speaker (and the audience) sees that only the cheap model runs. */}
              <div
                className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700"
                title="Kosten-gesperrt: nur Claude Haiku 4.5 ist aktiviert"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  Haiku 4.5
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
                    Chat
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
                    onClick={() => setActiveView('security')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'security'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Sicherheit
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
                    onClick={() => setActiveView('fixes')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'fixes'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                    </svg>
                    Fixes
                    {openFixCount > 0 && (
                      <span className="ml-auto text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-1 rounded-full">
                        {openFixCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveView('prompts')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      ui.activeView === 'prompts'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <svg className="mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Prompts
                    <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                      {prompts.prompts.length}
                    </span>
                  </button>
                </div>
              </div>
            </nav>
          )}

          {/* Main Content */}
          <main className="flex-1 p-6">
            {ui.activeView === 'dashboard' && <DashboardOverview />}
            {ui.activeView === 'chat' && <ChatPanel />}
            {ui.activeView === 'users' && <UsersPanel />}
            {ui.activeView === 'compliance' && <CompliancePanel />}
            {ui.activeView === 'security' && <SecurityPanel />}
            {ui.activeView === 'analysis' && <AnalysisPanel />}
            {ui.activeView === 'fixes' && <FixesPanel />}
            {ui.activeView === 'prompts' && <PromptManagementView />}
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
        <QuickActions />
      </div>
    </div>
  );
}