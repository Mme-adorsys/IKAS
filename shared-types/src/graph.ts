/**
 * Graph Visualization Types
 * Defines interfaces for Neo4j data visualization with D3.js
 */

export interface GraphNode {
  id: string;
  label: string;
  type: 'User' | 'Role' | 'Group' | 'Client' | 'Realm' | 'Policy' | 'Violation';
  properties: Record<string, any>;
  x?: number;
  y?: number;
  fx?: number; // Fixed x position
  fy?: number; // Fixed y position
  color?: string;
  size?: number;
  highlighted?: boolean;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  strength?: number;
  color?: string;
  width?: number;
  animated?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  metadata: {
    timestamp: string;
    nodeCount: number;
    linkCount: number;
    source: 'keycloak' | 'neo4j' | 'synthetic';
  };
}

export interface GraphVisualizationConfig {
  width: number;
  height: number;
  nodeRadius: number;
  linkDistance: number;
  chargeStrength: number;
  enablePhysics: boolean;
  showLabels: boolean;
  colorScheme: 'default' | 'dark' | 'high-contrast';
  filters: {
    nodeTypes: string[];
    relationshipTypes: string[];
    hideIsolatedNodes: boolean;
  };
}

export interface GraphAnalysisResult {
  duplicateUsers?: Array<{
    users: GraphNode[];
    similarity: number;
    reason: string;
  }>;
  complianceViolations?: Array<{
    user: GraphNode;
    violation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }>;
  communityDetection?: Array<{
    community: string;
    nodes: GraphNode[];
    score: number;
  }>;
  centralityAnalysis?: Array<{
    node: GraphNode;
    betweennessCentrality: number;
    degreeCentrality: number;
    pageRank: number;
  }>;
}

export interface GraphUpdateAnimation {
  type: 'add' | 'remove' | 'update' | 'highlight';
  elements: Array<{
    id: string;
    elementType: 'node' | 'link';
    duration: number;
    delay?: number;
  }>;
}