'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { usePermissions } from '@/lib/use-permissions';
import { useTranslation } from '@/lib/use-translation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Users, Shield, Trash2, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  userId: string;
  email: string;
  businessName: string | null;
  role: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, { da: string; en: string; color: string }> = {
  OWNER: { da: 'Ejer', en: 'Owner', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  ADMIN: { da: 'Administrator', en: 'Admin', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  ACCOUNTANT: { da: 'Bogholder', en: 'Accountant', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER: { da: 'Læser', en: 'Viewer', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
  AUDITOR: { da: 'Revisor', en: 'Auditor', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
};

export function TeamManagement() {
  const user = useAuthStore(state => state.user);
  const { canViewMembers, canInviteMembers, canRemoveMembers, canChangeRoles, isOwner, isAdmin } = usePermissions();
  const { language } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [inviteSending, setInviteSending] = useState(false);

  const companyId = user?.activeCompanyId;

  const fetchMembers = useCallback(async () => {
    if (!companyId || !canViewMembers) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // silently fail
    }
  }, [companyId, canViewMembers]);

  const fetchInvitations = useCallback(async () => {
    if (!companyId || !canViewMembers) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
      }
    } catch {
      // silently fail
    }
  }, [companyId, canViewMembers]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMembers(), fetchInvitations()]).finally(() => setLoading(false));
  }, [fetchMembers, fetchInvitations]);

  const handleInvite = async () => {
    if (!inviteEmail || !companyId) return;
    setInviteSending(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(language === 'da' ? 'Invitation sendt!' : 'Invitation sent!');
        setInviteEmail('');
        setInviteRole('VIEWER');
        setInviteOpen(false);
        fetchInvitations();
      } else {
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch {
      toast.error('Failed to send invitation');
    } finally {
      setInviteSending(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(language === 'da' ? 'Medlem fjernet' : 'Member removed');
        fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!companyId) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/members/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(language === 'da' ? 'Rolle opdateret' : 'Role updated');
        fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update role');
      }
    } catch {
      toast.error('Failed to update role');
    }
  };

  if (!canViewMembers) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center text-[#6b7c75]">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>{language === 'da' ? 'Kun administratorer kan se team-medlemmer' : 'Only admins can view team members'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#1a2e2a] dark:text-[#e2e8e6]">
            {language === 'da' ? 'Team & Medlemmer' : 'Team & Members'}
          </h3>
          <p className="text-sm text-[#6b7c75]">
            {language === 'da'
              ? 'Administrer hvem der har adgang til dette regnskab'
              : 'Manage who has access to this company'}
          </p>
        </div>
        {canInviteMembers && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#0d9488] hover:bg-[#0f766e]">
                <UserPlus className="h-4 w-4" />
                {language === 'da' ? 'Inviter' : 'Invite'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{language === 'da' ? 'Inviter teammedlem' : 'Invite team member'}</DialogTitle>
                <DialogDescription>
                  {language === 'da'
                    ? 'Send en invitation via e-mail. Modtageren skal oprette en konto for at acceptere.'
                    : 'Send an invitation via email. The recipient needs to create an account to accept.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {language === 'da' ? 'E-mail adresse' : 'Email address'}
                  </label>
                  <Input
                    type="email"
                    placeholder="name@company.dk"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {language === 'da' ? 'Rolle' : 'Role'}
                  </label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">{language === 'da' ? 'Administrator' : 'Admin'}</SelectItem>
                      <SelectItem value="ACCOUNTANT">{language === 'da' ? 'Bogholder' : 'Accountant'}</SelectItem>
                      <SelectItem value="VIEWER">{language === 'da' ? 'Læser' : 'Viewer'}</SelectItem>
                      <SelectItem value="AUDITOR">{language === 'da' ? 'Revisor' : 'Auditor'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail || inviteSending}
                  className="w-full bg-[#0d9488] hover:bg-[#0f766e]"
                >
                  {inviteSending
                    ? (language === 'da' ? 'Sender...' : 'Sending...')
                    : (language === 'da' ? 'Send invitation' : 'Send invitation')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-[#0d9488]" />
            {language === 'da' ? 'Medlemmer' : 'Members'} ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6 text-[#6b7c75]">
              {language === 'da' ? 'Indlæser...' : 'Loading...'}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-[#6b7c75]">
              {language === 'da' ? 'Ingen medlemmer fundet' : 'No members found'}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.map(member => {
                const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.VIEWER;
                const isCurrentUser = member.userId === user?.id;
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#f8faf9] dark:bg-[#1a2520] hover:bg-[#f0f5f2] dark:hover:bg-[#1e2b26] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#0d9488]">
                          {(member.businessName || member.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1a2e2a] dark:text-[#e2e8e6] truncate">
                          {member.businessName || member.email}
                          {isCurrentUser && (
                            <span className="text-[#6b7c75] ml-1">({language === 'da' ? 'dig' : 'you'})</span>
                          )}
                        </p>
                        <p className="text-xs text-[#6b7c75] truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canChangeRoles && !isCurrentUser && member.role !== 'OWNER' ? (
                        <Select
                          value={member.role}
                          onValueChange={(role) => handleChangeRole(member.userId, role)}
                        >
                          <SelectTrigger className="h-7 w-auto text-xs border-0 p-0 pr-6">
                            <Badge className={`text-[10px] px-2 py-0 ${roleInfo.color}`}>
                              {language === 'da' ? roleInfo.da : roleInfo.en}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">{language === 'da' ? 'Administrator' : 'Admin'}</SelectItem>
                            <SelectItem value="ACCOUNTANT">{language === 'da' ? 'Bogholder' : 'Accountant'}</SelectItem>
                            <SelectItem value="VIEWER">{language === 'da' ? 'Læser' : 'Viewer'}</SelectItem>
                            <SelectItem value="AUDITOR">{language === 'da' ? 'Revisor' : 'Auditor'}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`text-[10px] px-2 py-0 ${roleInfo.color}`}>
                          {language === 'da' ? roleInfo.da : roleInfo.en}
                        </Badge>
                      )}
                      {canRemoveMembers && !isCurrentUser && member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#6b7c75] hover:text-red-500"
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#0d9488]" />
              {language === 'da' ? 'Afventende invitationer' : 'Pending Invitations'} ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map(inv => {
                const roleInfo = ROLE_LABELS[inv.role] || ROLE_LABELS.VIEWER;
                const expiresDate = new Date(inv.expiresAt);
                const isExpired = expiresDate < new Date();
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#f8faf9] dark:bg-[#1a2520]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="h-4 w-4 text-[#6b7c75] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-[#1a2e2a] dark:text-[#e2e8e6] truncate">{inv.email}</p>
                        <p className="text-xs text-[#6b7c75] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isExpired
                            ? (language === 'da' ? 'Udløbet' : 'Expired')
                            : `${language === 'da' ? 'Udløber' : 'Expires'} ${expiresDate.toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] px-2 py-0 ${roleInfo.color}`}>
                      {language === 'da' ? roleInfo.da : roleInfo.en}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
