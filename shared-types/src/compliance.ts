/**
 * Compliance and Security Types
 * Defines interfaces for compliance checking and security analysis
 */

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: 'password' | 'mfa' | 'user_management' | 'session' | 'audit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  query: string; // Cypher query for Neo4j
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedResource: {
    type: 'user' | 'role' | 'client' | 'realm';
    id: string;
    name: string;
  };
  detectedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface ComplianceReport {
  id: string;
  generatedAt: string;
  realm: string;
  overallScore: number; // 0-100
  totalRules: number;
  passedRules: number;
  failedRules: number;
  violations: ComplianceViolation[];
  categories: Array<{
    category: string;
    score: number;
    rulesCount: number;
    violationsCount: number;
  }>;
  trends: Array<{
    date: string;
    score: number;
    violationsCount: number;
  }>;
}

export interface SecurityMetrics {
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    usersWithMfa: number;
    usersWithWeakPasswords: number;
    inactiveUsers: number;
  };
  sessionMetrics: {
    activeSessions: number;
    averageSessionDuration: number;
    suspiciousSessions: number;
    loginFailures: number;
  };
  auditMetrics: {
    totalEvents: number;
    adminActions: number;
    failedActions: number;
    suspiciousActivities: number;
  };
}

export interface SecurityAlert {
  id: string;
  type: 'suspicious_login' | 'privilege_escalation' | 'bulk_operation' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedUser?: string;
  sourceIp?: string;
  timestamp: string;
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolutionNotes?: string;
}