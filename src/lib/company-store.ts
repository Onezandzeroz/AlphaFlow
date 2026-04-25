/**
 * Company Store — Zustand store for company management operations.
 *
 * Separates company-specific state from auth state:
 *   - Company info CRUD (fetch, create, update)
 *   - Member management (list, role change, remove)
 *   - Invitation management (list, send, revoke, accept, verify)
 *
 * Auth-related company state (activeCompanyId, companies list, switchCompany)
 * remains in auth-store.ts.
 */

import { create } from 'zustand';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────

export interface CompanyInfo {
  id: string;
  logo: string | null;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  cvrNumber: string;
  companyType: string | null;
  invoicePrefix: string;
  bankName: string;
  bankAccount: string;
  bankRegistration: string;
  bankIban: string | null;
  bankStreet: string | null;
  bankCity: string | null;
  bankCountry: string | null;
  invoiceTerms: string | null;
  invoiceNotesTemplate: string | null;
  nextInvoiceSequence: number;
  currentYear: number;
  isDemo: boolean;
}

export interface Member {
  userId: string;
  email: string;
  businessName: string | null;
  role: string;
  joinedAt: string;
  invitedBy: string | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationVerifyResult {
  valid: boolean;
  invitation?: {
    id: string;
    email: string;
    role: string;
    companyName: string;
    companyId: string;
    expiresAt: string;
  };
  error?: string;
}

// ─── Store Interface ────────────────────────────────────────────────

interface CompanyState {
  // Company info
  companyInfo: CompanyInfo | null;
  companyLoading: boolean;

  // Members
  members: Member[];
  membersLoading: boolean;

  // Invitations
  invitations: Invitation[];
  invitationsLoading: boolean;

  // Actions — Company
  fetchCompanyInfo: () => Promise<CompanyInfo | null>;
  createCompany: (data: Partial<CompanyInfo>) => Promise<CompanyInfo | null>;
  updateCompany: (data: Partial<CompanyInfo>) => Promise<CompanyInfo | null>;

  // Actions — Members
  fetchMembers: (companyId: string) => Promise<Member[]>;
  changeMemberRole: (companyId: string, userId: string, role: string) => Promise<boolean>;
  removeMember: (companyId: string, userId: string) => Promise<boolean>;

  // Actions — Invitations
  fetchInvitations: (companyId: string) => Promise<Invitation[]>;
  sendInvitation: (companyId: string, email: string, role: string) => Promise<boolean>;
  revokeInvitation: (companyId: string, inviteId: string) => Promise<boolean>;
  verifyInvitation: (token: string) => Promise<InvitationVerifyResult>;
  acceptInvitation: (token: string) => Promise<{ companyId: string; companyName: string; role: string } | null>;
}

// ─── Store ──────────────────────────────────────────────────────────

export const useCompanyStore = create<CompanyState>()((set, get) => ({
  // Initial state
  companyInfo: null,
  companyLoading: false,
  members: [],
  membersLoading: false,
  invitations: [],
  invitationsLoading: false,

  // ── Company CRUD ───────────────────────────────────────────────────

  fetchCompanyInfo: async () => {
    set({ companyLoading: true });
    try {
      const res = await fetch('/api/company');
      if (res.ok) {
        const data = await res.json();
        const info = data.companyInfo ?? null;
        set({ companyInfo: info, companyLoading: false });
        return info;
      }
      set({ companyLoading: false });
      return null;
    } catch (error) {
      logger.error('Failed to fetch company info:', error);
      set({ companyLoading: false });
      return null;
    }
  },

  createCompany: async (data) => {
    try {
      const res = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        const info = result.companyInfo ?? null;
        set({ companyInfo: info });
        return info;
      }
      return null;
    } catch (error) {
      logger.error('Failed to create company:', error);
      return null;
    }
  },

  updateCompany: async (data) => {
    try {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        const info = result.companyInfo ?? null;
        set({ companyInfo: info });
        return info;
      }
      return null;
    } catch (error) {
      logger.error('Failed to update company:', error);
      return null;
    }
  },

  // ── Members ────────────────────────────────────────────────────────

  fetchMembers: async (companyId) => {
    set({ membersLoading: true });
    try {
      const res = await fetch(`/api/companies/${companyId}/members`);
      if (res.ok) {
        const data = await res.json();
        const members = data.members ?? [];
        set({ members, membersLoading: false });
        return members;
      }
      set({ membersLoading: false });
      return [];
    } catch (error) {
      logger.error('Failed to fetch members:', error);
      set({ membersLoading: false });
      return [];
    }
  },

  changeMemberRole: async (companyId, userId, role) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        // Update the member in the local state
        set((state) => ({
          members: state.members.map((m) =>
            m.userId === userId ? { ...m, role } : m
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to change member role:', error);
      return false;
    }
  },

  removeMember: async (companyId, userId) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        set((state) => ({
          members: state.members.filter((m) => m.userId !== userId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to remove member:', error);
      return false;
    }
  },

  // ── Invitations ────────────────────────────────────────────────────

  fetchInvitations: async (companyId) => {
    set({ invitationsLoading: true });
    try {
      const res = await fetch(`/api/companies/${companyId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        const invitations = data.invitations ?? [];
        set({ invitations, invitationsLoading: false });
        return invitations;
      }
      set({ invitationsLoading: false });
      return [];
    } catch (error) {
      logger.error('Failed to fetch invitations:', error);
      set({ invitationsLoading: false });
      return [];
    }
  },

  sendInvitation: async (companyId, email, role) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        const data = await res.json();
        // Add the new invitation to local state
        if (data.invitation) {
          set((state) => ({
            invitations: [...state.invitations, data.invitation],
          }));
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to send invitation:', error);
      return false;
    }
  },

  revokeInvitation: async (companyId, inviteId) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/invitations/${inviteId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        set((state) => ({
          invitations: state.invitations.filter((inv) => inv.id !== inviteId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to revoke invitation:', error);
      return false;
    }
  },

  verifyInvitation: async (token) => {
    try {
      const res = await fetch(`/api/invitations/verify?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      return data as InvitationVerifyResult;
    } catch (error) {
      logger.error('Failed to verify invitation:', error);
      return { valid: false, error: 'Network error' };
    }
  },

  acceptInvitation: async (token) => {
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          companyId: data.companyId,
          companyName: data.companyName,
          role: data.role,
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to accept invitation:', error);
      return null;
    }
  },
}));
