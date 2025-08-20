'use client';

import React, { useState } from 'react';
import { useIKASStore } from '@/store';

export function AnalysisPanel() {
  const { analysis, startAnalysis } = useIKASStore();
  const [selectedAnalysisType, setSelectedAnalysisType] = useState('duplicate-users');
  const [analysisParams, setAnalysisParams] = useState({
    realm: 'all',
    includeDisabled: false,
    threshold: 80
  });

  const analysisTypes = [
    {
      id: 'duplicate-users',
      name: 'Doppelte Benutzer finden',
      description: 'Identifiziert Benutzer mit identischen oder ähnlichen Eigenschaften',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: 'inactive-users',
      name: 'Inaktive Benutzer',
      description: 'Analysiert Benutzeraktivität und identifiziert inaktive Konten',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'role-analysis',
      name: 'Rollen-Analyse',
      description: 'Überprüft Rollenzuweisungen und identifiziert Anomalien',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'security-audit',
      name: 'Sicherheits-Audit',
      description: 'Umfassende Sicherheitsprüfung aller Konfigurationen',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      id: 'usage-patterns',
      name: 'Nutzungsmuster',
      description: 'Analysiert Benutzerverhalten und Zugriffsmuster',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'compliance-check',
      name: 'Compliance-Prüfung',
      description: 'Überprüft Einhaltung von Sicherheitsrichtlinien',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  const handleStartAnalysis = async () => {
    await startAnalysis(selectedAnalysisType, analysisParams);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'started': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400';
      case 'running': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'completed': return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDuration = (startTime: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - startTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs % 60}s`;
    }
    return `${diffSecs}s`;
  };

  const activeAnalysesArray = Array.from(analysis.activeAnalyses.entries()).map(([mapId, { id: _dataId, ...data }]) => ({
    id: mapId,
    ...data
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Datenanalyse
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          KI-gestützte Analysen für Keycloak-Daten und Sicherheitsprüfungen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Neue Analyse starten
          </h3>

          <div className="space-y-4">
            {/* Analysis Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analyse-Typ
              </label>
              <div className="space-y-2">
                {analysisTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAnalysisType === type.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedAnalysisType(type.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 ${
                        selectedAnalysisType === type.id
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400'
                      }`}>
                        {type.icon}
                      </div>
                      <div>
                        <h4 className={`text-sm font-medium ${
                          selectedAnalysisType === type.id
                            ? 'text-blue-900 dark:text-blue-200'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {type.name}
                        </h4>
                        <p className={`text-xs mt-1 ${
                          selectedAnalysisType === type.id
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {type.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analysis Parameters */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Parameter
              </label>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Realm
                </label>
                <select
                  value={analysisParams.realm}
                  onChange={(e) => setAnalysisParams(prev => ({ ...prev, realm: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="all">Alle Realms</option>
                  <option value="master">Master</option>
                  <option value="company-realm">Company Realm</option>
                </select>
              </div>

              {selectedAnalysisType === 'duplicate-users' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Ähnlichkeitsschwelle (%)
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={analysisParams.threshold}
                    onChange={(e) => setAnalysisParams(prev => ({ ...prev, threshold: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>50%</span>
                    <span className="font-medium">{analysisParams.threshold}%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analysisParams.includeDisabled}
                    onChange={(e) => setAnalysisParams(prev => ({ ...prev, includeDisabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                    Deaktivierte Benutzer einschließen
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={activeAnalysesArray.length >= 3}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analyse starten
            </button>
          </div>
        </div>

        {/* Active Analyses */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Laufende Analysen ({activeAnalysesArray.length})
          </h3>

          <div className="space-y-4">
            {activeAnalysesArray.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm">Keine laufenden Analysen</p>
                <p className="text-xs mt-1">Starte eine neue Analyse</p>
              </div>
            ) : (
              activeAnalysesArray.map((analysis) => (
                <div key={analysis.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {analysisTypes.find(t => t.id === analysis.type)?.name || analysis.type}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(analysis.status)}`}>
                      {analysis.status === 'started' ? 'Gestartet' :
                       analysis.status === 'running' ? 'Läuft' :
                       analysis.status === 'completed' ? 'Abgeschlossen' :
                       analysis.status === 'failed' ? 'Fehler' : analysis.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>Fortschritt</span>
                      <span>{analysis.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          analysis.status === 'completed' ? 'bg-green-600' :
                          analysis.status === 'failed' ? 'bg-red-600' :
                          'bg-blue-600'
                        }`}
                        style={{ width: `${analysis.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Laufzeit: {formatDuration(analysis.startTime)}</span>
                    {analysis.status === 'running' && (
                      <div className="flex items-center">
                        <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
                        <span>Verarbeitung...</span>
                      </div>
                    )}
                  </div>

                  {analysis.error && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-200">
                      Fehler: {analysis.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Analysis History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Analyse-Verlauf ({analysis.analysisHistory.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {analysis.analysisHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Noch keine abgeschlossenen Analysen</p>
            </div>
          ) : (
            analysis.analysisHistory.slice(0, 10).map((item, index) => (
              <div key={`${item.id}-${index}`} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      item.success ? 'bg-green-400' : 'bg-red-400'
                    }`}></div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {analysisTypes.find(t => t.id === item.type)?.name || item.type}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.completedAt.toLocaleDateString('de-DE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(item.duration / 1000)}s
                    </span>
                    <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 font-medium">
                      Ergebnisse anzeigen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}