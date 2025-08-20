'use client';

import React from 'react';
import { useIKASStore } from '@/store';

export function SystemStatus() {
  const { system, voice } = useIKASStore();

  const services = [
    {
      name: 'AI Gateway',
      status: system.services.aiGateway,
      description: 'LLM Orchestration Service'
    },
    {
      name: 'WebSocket',
      status: system.services.websocket,
      description: 'Real-time Communication'
    },
    {
      name: 'Keycloak MCP',
      status: system.services.keycloakMcp,
      description: 'User Management Service'
    },
    {
      name: 'Neo4j MCP',
      status: system.services.neo4jMcp,
      description: 'Graph Database Service'
    }
  ];

  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'healthy': return 'text-green-400';
  //     case 'unhealthy': return 'text-red-400';
  //     default: return 'text-gray-400';
  //   }
  // };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'unhealthy': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          System Status
        </h3>
        <div className={`w-3 h-3 rounded-full ${
          system.websocketConnected ? 'bg-green-400' : 'bg-red-400'
        } animate-pulse`}></div>
      </div>

      <div className="space-y-3">
        {/* WebSocket Connection */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              WebSocket Verbindung
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Session: {system.sessionId || 'Nicht verbunden'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full ${
            system.websocketConnected ? 'bg-green-400' : 'bg-red-400'
          }`}></div>
        </div>

        {/* Voice Recognition */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Spracherkennung
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {voice.voiceSupported ? 'Verfügbar' : 'Nicht verfügbar'}
              {voice.hotwordMode && ' • Hotword aktiv'}
              {voice.isListening && ' • Hörend'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full ${
            voice.voiceSupported ? 'bg-green-400' : 'bg-gray-400'
          }`}></div>
        </div>

        {/* Services Status */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            MCP Services
          </p>
          <div className="space-y-2">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {service.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {service.description}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(service.status)}`}>
                  {service.status === 'healthy' ? 'Gesund' : 
                   service.status === 'unhealthy' ? 'Fehler' : 'Unbekannt'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}