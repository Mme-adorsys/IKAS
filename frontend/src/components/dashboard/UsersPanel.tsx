'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useIKASStore } from '@/store';

type UserRow = {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  realm: string;
};

interface RiskGrade {
  letter: 'A' | 'B' | 'C' | 'D' | 'E';
  score: number;
  bg: string;
  text: string;
  label: string;
}

const GRADE_TABLE: Array<{ max: number; letter: RiskGrade['letter']; bg: string; text: string; label: string }> = [
  { max: 3,  letter: 'A', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300', label: 'Sicher' },
  { max: 8,  letter: 'B', bg: 'bg-lime-100 dark:bg-lime-900/30',       text: 'text-lime-800 dark:text-lime-300',       label: 'OK' },
  { max: 15, letter: 'C', bg: 'bg-yellow-100 dark:bg-yellow-900/30',   text: 'text-yellow-800 dark:text-yellow-300',   label: 'Auffällig' },
  { max: 25, letter: 'D', bg: 'bg-orange-100 dark:bg-orange-900/30',   text: 'text-orange-800 dark:text-orange-300',   label: 'Hoch' },
  { max: Infinity, letter: 'E', bg: 'bg-red-100 dark:bg-red-900/30',   text: 'text-red-800 dark:text-red-300',         label: 'Kritisch' }
];

function gradeForScore(score: number): RiskGrade {
  const row = GRADE_TABLE.find(r => score <= r.max) ?? GRADE_TABLE[GRADE_TABLE.length - 1];
  return { letter: row.letter, score, bg: row.bg, text: row.text, label: row.label };
}

export function UsersPanel() {
  const {
    data,
    security,
    loadKeycloakUsers,
    updateKeycloakUser,
    toggleKeycloakUserEnabled
  } = useIKASStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRealm, setSelectedRealm] = useState('all');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  // Auto-fetch on mount.
  useEffect(() => {
    if (data.users.length === 0) {
      void loadKeycloakUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const users = data.users;
  const realms = ['all', ...new Set(users.map(u => u.realm))];

  // Per-user risk score. Note: keycloak user-ids (UUIDs) differ from the IDs used by the
  // security engine (sha256 hash of "user|realm|username"), so we need a translation table.
  // The IdentityGraph stores a `username` on user-nodes which lets us bridge both spaces:
  //   engine.userId  ──┐
  //                    ├─► username ◄─ keycloak.user.username (1:1)
  //   graph.user.id ──┘
  const scoreByUserId = useMemo(() => {
    const SEVERITY_WEIGHT = { critical: 8, error: 4, warning: 2, info: 1 } as const;

    // Build engineId → username lookup using:
    //   1. affected[].name when it's already a username (USER_GOD_MODE sets it correctly)
    //   2. identityGraph.nodes (graph node id == engine id, and they have `username`)
    const engineIdToUsername = new Map<string, string>();
    for (const n of security.identityGraph?.nodes ?? []) {
      if (n.type === 'user' && n.username) engineIdToUsername.set(n.id, n.username);
    }
    for (const f of security.findings) {
      for (const a of f.affected) {
        if (a.type !== 'user' || !a.name) continue;
        // If the "name" already looks like a username (not a long hash) trust it.
        if (a.name.length < 64 && !engineIdToUsername.has(a.id)) {
          engineIdToUsername.set(a.id, a.name);
        }
      }
    }

    const scoreByUsername = new Map<string, number>();
    for (const f of security.findings) {
      if (f.status !== 'open') continue;
      const w = SEVERITY_WEIGHT[f.severity] ?? 0;
      for (const a of f.affected) {
        if (a.type !== 'user') continue;
        const username = engineIdToUsername.get(a.id)
          ?? (a.name && a.name.length < 64 ? a.name : undefined);
        if (!username) continue;
        scoreByUsername.set(username, (scoreByUsername.get(username) ?? 0) + w);
      }
    }

    const map = new Map<string, number>();
    for (const u of users) {
      let s = scoreByUsername.get(u.username) ?? 0;
      if (!u.enabled) s -= 5;          // disabled accounts pose lower risk
      if (s !== 0) map.set(u.id, s);
    }
    return map;
  }, [security.findings, security.identityGraph, users]);

  // Pre-compute duplicates by email + username (case-insensitive).
  const duplicates = useMemo(() => {
    const byEmail: Record<string, UserRow[]> = {};
    const byUsername: Record<string, UserRow[]> = {};
    for (const u of users) {
      if (u.email) (byEmail[u.email.toLowerCase()] ??= []).push(u);
      if (u.username) (byUsername[u.username.toLowerCase()] ??= []).push(u);
    }
    const emailGroups = Object.entries(byEmail).filter(([, list]) => list.length > 1);
    const usernameGroups = Object.entries(byUsername).filter(([, list]) => list.length > 1);
    return { emailGroups, usernameGroups };
  }, [users]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRealm = selectedRealm === 'all' || user.realm === selectedRealm;
    return matchesSearch && matchesRealm;
  });

  // Sort by descending risk so the table opens with the most critical users at the top.
  const sortedUsers = useMemo(
    () => [...filteredUsers].sort((a, b) => (scoreByUserId.get(b.id) ?? 0) - (scoreByUserId.get(a.id) ?? 0)),
    [filteredUsers, scoreByUserId]
  );

  const handleRefreshUsers = async () => {
    await loadKeycloakUsers();
  };

  const handleToggleEnabled = async (u: UserRow) => {
    const ok = await toggleKeycloakUserEnabled(u.realm, u.id, !u.enabled);
    if (!ok) await loadKeycloakUsers(); // Re-sync if backend rejected.
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Benutzer Verwaltung
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Überblick und Verwaltung der Keycloak Benutzer · Bewertung A–E basiert auf aktuellen Findings
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Benutzer suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={selectedRealm}
              onChange={(e) => setSelectedRealm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {realms.map((realm) => (
                <option key={realm} value={realm}>
                  {realm === 'all' ? 'All Realms' : realm}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleRefreshUsers}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <button
              onClick={() => setDuplicatesOpen(true)}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Find Duplicates
              {(duplicates.emailGroups.length + duplicates.usernameGroups.length) > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-white/20 rounded">
                  {duplicates.emailGroups.length + duplicates.usernameGroups.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total"    value={filteredUsers.length} bg="bg-blue-100 dark:bg-blue-900/20"  textColor="text-blue-600 dark:text-blue-400" />
        <StatCard label="Active"   value={filteredUsers.filter(u => u.enabled).length} bg="bg-green-100 dark:bg-green-900/20" textColor="text-green-600 dark:text-green-400" />
        <StatCard label="Disabled" value={filteredUsers.filter(u => !u.enabled).length} bg="bg-red-100 dark:bg-red-900/20"   textColor="text-red-600 dark:text-red-400" />
        <StatCard label="Realms"   value={realms.length - 1} bg="bg-purple-100 dark:bg-purple-900/20"  textColor="text-purple-600 dark:text-purple-400" />
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Realm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Risiko</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedUsers.map((user) => {
                const grade = gradeForScore(scoreByUserId.get(user.id) ?? 0);
                return (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {user.firstName?.charAt(0) || user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{user.email || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {user.realm}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {user.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-bold text-sm ${grade.bg} ${grade.text}`}
                          title={`${grade.label} · Score ${grade.score}`}
                        >
                          {grade.letter}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{grade.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(user)}
                        className={user.enabled
                          ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200'
                          : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200'}
                      >
                        {user.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedUsers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">No users found</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={async (fields) => {
            const ok = await updateKeycloakUser(editingUser.realm, editingUser.id, fields);
            if (ok) setEditingUser(null);
          }}
        />
      )}

      {/* Duplicates modal */}
      {duplicatesOpen && (
        <DuplicatesModal
          emailGroups={duplicates.emailGroups}
          usernameGroups={duplicates.usernameGroups}
          totalUsers={users.length}
          onClose={() => setDuplicatesOpen(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, bg, textColor }: { label: string; value: number; bg: string; textColor: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center">
        <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
          <svg className={`w-5 h-5 ${textColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }: {
  user: UserRow;
  onClose: () => void;
  onSave: (fields: { firstName?: string; lastName?: string; email?: string; emailVerified?: boolean }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ firstName, lastName, email, emailVerified });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">User editieren · {user.realm}</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{user.username}</h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4 text-sm">
          <Field label="Vorname" value={firstName} onChange={setFirstName} />
          <Field label="Nachname" value={lastName} onChange={setLastName} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
            <span>Email verifiziert</span>
          </label>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Änderungen werden direkt in Keycloak gespeichert (Realm: <code className="font-mono">{user.realm}</code>).
          </p>
        </div>

        <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white">
            {saving ? 'Speichere…' : 'Speichern'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  );
}

function DuplicatesModal({ emailGroups, usernameGroups, totalUsers, onClose }: {
  emailGroups: Array<[string, UserRow[]]>;
  usernameGroups: Array<[string, UserRow[]]>;
  totalUsers: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const total = emailGroups.length + usernameGroups.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Duplikat-Analyse</div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {total === 0 ? `Keine Duplikate in ${totalUsers} Accounts` : `${total} Duplikat-Gruppen gefunden`}
            </h3>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="overflow-y-auto p-5 space-y-4 text-sm">
          {emailGroups.length === 0 && usernameGroups.length === 0 && (
            <p className="text-gray-600 dark:text-gray-300">
              Alle {totalUsers} Accounts haben eindeutige Email-Adressen und Usernames — keine Konsolidierung nötig.
            </p>
          )}

          {emailGroups.length > 0 && (
            <section>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Gleiche Email ({emailGroups.length})
              </h4>
              <ul className="space-y-2">
                {emailGroups.map(([email, list]) => (
                  <li key={email} className="px-3 py-2 rounded border-l-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/15">
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{email}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {list.map(u => (
                        <span key={u.id} className="text-xs px-2 py-0.5 rounded bg-white dark:bg-gray-800">
                          {u.username} <span className="text-gray-500 dark:text-gray-400">({u.realm})</span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {usernameGroups.length > 0 && (
            <section>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Gleicher Username (case-insensitive · {usernameGroups.length})
              </h4>
              <ul className="space-y-2">
                {usernameGroups.map(([username, list]) => (
                  <li key={username} className="px-3 py-2 rounded border-l-2 border-orange-500 bg-orange-50 dark:bg-orange-900/15">
                    <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{username}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {list.map(u => (
                        <span key={u.id} className="text-xs px-2 py-0.5 rounded bg-white dark:bg-gray-800">
                          {u.email || '—'} <span className="text-gray-500 dark:text-gray-400">({u.realm})</span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white">Schließen</button>
        </footer>
      </div>
    </div>
  );
}
