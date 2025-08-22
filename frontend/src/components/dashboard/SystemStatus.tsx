'use client';

import React, { useEffect, useState } from 'react';
import { useIKASStore } from '@/store';

export function SystemStatus() {
  const { 
    system, 
    voice, 
    reconnectWebSocket, 
    checkServiceHealth,
    addNotification 
  } = useIKASStore();
  
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  // Auto health check every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      await checkServiceHealth();
      setLastHealthCheck(new Date());
    }, 30000);

    // Initial health check
    checkServiceHealth().then(() => setLastHealthCheck(new Date()));

    return () => clearInterval(interval);
  }, [checkServiceHealth]);

  // Manual reconnection handler
  const handleReconnect = async () => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    try {
      await reconnectWebSocket();
      addNotification({
        type: 'success',
        title: 'Reconnected',
        message: 'Successfully reconnected to WebSocket server'
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Reconnection Failed',
        message: 'Failed to reconnect. Please check server status.'
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  // Manual health check handler
  const handleHealthCheck = async () => {
    await checkServiceHealth();
    setLastHealthCheck(new Date());
    addNotification({
      type: 'info',
      title: 'Health Check',
      message: 'Service health status updated'
    });
  };

  const services = [
    {
      name: 'WebSocket Server',
      status: system.services.websocket,
      description: 'Real-time Communication Hub',
      connected: system.websocketConnected,
      port: '3001'
    },
    {
      name: 'AI Gateway',
      status: system.services.aiGateway,
      description: 'LLM Orchestration Service',
      port: '8005'
    },
    {
      name: 'Keycloak MCP',
      status: system.services.keycloakMcp,
      description: 'User Management Service',
      port: '8001'
    },
    {
      name: 'Neo4j MCP',
      status: system.services.neo4jMcp,
      description: 'Graph Database Service',
      port: '8002'
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

  const isOverallHealthy = services.every(s => s.status === 'healthy') && 
                         system.websocketConnected && 
                         voice.voiceSupported;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          System Status
        </h3>
        <div className="flex items-center space-x-3">
          {lastHealthCheck && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last check: {lastHealthCheck.toLocaleTimeString()}
            </span>
          )}
          <div className={`w-3 h-3 rounded-full ${
            isOverallHealthy ? 'bg-green-400' : 
            system.websocketConnected ? 'bg-yellow-400' : 'bg-red-400'
          } ${system.websocketConnected ? 'animate-pulse' : ''}`}></div>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={handleHealthCheck}
          className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md transition-colors"
        >
          ⚡ Health Check
        </button>
        {!system.websocketConnected && (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className="px-3 py-1 text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 text-orange-800 dark:text-orange-200 rounded-md transition-colors disabled:opacity-50"
          >
            {isReconnecting ? '🔄 Reconnecting...' : '🔌 Reconnect'}
          </button>
        )}
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
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            IKAS Services
          </p>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {service.name}
                    </p>
                    {'connected' in service && (
                      <div className={`w-2 h-2 rounded-full ${
                        service.connected ? 'bg-green-400' : 'bg-red-400'
                      }`} title={service.connected ? 'Connected' : 'Disconnected'}></div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {service.description}
                    </p>
                    {service.port && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        :{service.port}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(service.status)}`}>
                    {service.status === 'healthy' ? '✅ Gesund' : 
                     service.status === 'unhealthy' ? '❌ Fehler' : '❓ Unbekannt'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overall status summary */}
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Overall System Health
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isOverallHealthy ? 'All systems operational' : 
                 system.websocketConnected ? 'Some services have issues' : 
                 'Critical: WebSocket disconnected'}
              </p>
              {system.sessionId && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Session: {system.sessionId.slice(0, 8)}...
                </p>
              )}
            </div>
            <div className={`px-3 py-2 text-sm rounded-lg font-medium ${
              isOverallHealthy 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : system.websocketConnected
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {isOverallHealthy ? '🟢 Optimal' : 
               system.websocketConnected ? '🟡 Degraded' : '🔴 Critical'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}