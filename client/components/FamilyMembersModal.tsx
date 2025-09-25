import { Customer } from '@shared/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface FamilyMembersModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

const RELATION_WORDS = [
  'self','wife','husband','son','daughter','father','mother','brother','sister','grandfather','grandmother','grandson','granddaughter','uncle','aunt','cousin','father-in-law','mother-in-law','son-in-law','daughter-in-law','sister-in-law','brother-in-law','partner','spouse'
];

function parseFamilyMembers(text: string | undefined) {
  let s = (text || '').trim();
  if (!s || /no\s*family/i.test(s)) return [] as { name: string; relation?: string }[];

  // Remove a leading "<number> members" prefix if present
  s = s.replace(/^\s*\d+\s*members?/i, '').trim();

  const parts = s.split(/[;|,\n]+/).map(p => p.trim()).filter(Boolean);
  const isRelation = (v: string) => RELATION_WORDS.some(w => new RegExp(`(^|\\b)${w}(\\b|$)`,`i`).test(v));

  return parts
    .map((p) => p.replace(/^\s*\d+\s*members?\s*/i, '').trim()) // also clean per-item
    .filter((p) => !/^\d+\s*members?$/i.test(p))
    .map((p) => {
      // name (relation)
      const paren = p.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (paren) return { name: paren[1].trim(), relation: paren[2].trim() };

      // name - relation OR relation - name
      const hyphen = p.split(/\s*-\s*|\s*:\s*/);
      if (hyphen.length === 2) {
        const [a,b] = hyphen;
        if (isRelation(a) && !isRelation(b)) return { name: b.trim(), relation: a.trim() };
        return { name: a.trim(), relation: b.trim() };
      }

      // relation: name (already covered) fallback
      const colon = p.match(/^([^:]+):\s*(.+)$/);
      if (colon) {
        const rel = colon[1].trim();
        const nm = colon[2].trim();
        return isRelation(rel) ? { name: nm, relation: rel } : { name: rel, relation: nm };
      }

      return { name: p };
    });
}

function getMemberCountText(text: string | undefined, fallback: number) {
  const m = (text || '').match(/(\d+)\s*members?/i);
  const n = m ? parseInt(m[1], 10) : fallback;
  return Number.isFinite(n) ? n : fallback;
}

export default function FamilyMembersModal({ customer, isOpen, onClose }: FamilyMembersModalProps) {
  if (!customer) return null;
  const members = parseFamilyMembers(customer.familyMembers);
  const count = getMemberCountText(customer.familyMembers, members.length);

  return (
    <Dialog open={isOpen} onOpenChange={(open)=>{ if (!open) onClose(); }}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Family Members</DialogTitle>
              <DialogDescription>
                {customer.name} • Reg ID: {customer.regId}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs border-gray-200 text-gray-700">
              {count} member{count === 1 ? '' : 's'}
            </Badge>
          </div>
        </DialogHeader>
        <div className="space-y-4">
          {members.length > 0 ? (
            <ul className="divide-y divide-gray-200 border rounded-md">
              {members.map((m, idx) => (
                <li key={idx} className="p-3 flex items-center justify-between">
                  <span className="text-sm text-gray-900">{m.name}</span>
                  {m.relation && (
                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-800">
                      {m.relation}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">No individual names provided. Details: {customer.familyMembers || 'N/A'}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
