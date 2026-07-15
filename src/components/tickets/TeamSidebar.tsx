import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { User } from '../../types';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';

interface TeamSidebarProps {
  currentUser: User;
  devCompanyId?: string;
}

export const TeamSidebar = ({ currentUser, devCompanyId }: TeamSidebarProps) => {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        // Passar um parâmetro para trazer as contagens de tickets?
        // Vamos criar um endpoint ou usar o /users com uma query
        const endpoint = devCompanyId ? `/users/team?empresa_id=${devCompanyId}` : `/users/team`;
        const data = await api.get<any[]>(endpoint);
        setTeam(data);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar equipe');
      } finally {
        setLoading(false);
      }
    };
    if (!!currentUser.desenvolvedor && !devCompanyId) {
       setTeam([]);
       setLoading(false);
       return;
    }
    fetchTeam();
  }, [devCompanyId, !!currentUser.desenvolvedor]);

  if (!currentUser.empresa_id && !currentUser.desenvolvedor) return null;

  return (
    <Card className="w-full shrink-0 p-3 bg-white border border-slate-200 shadow-sm overflow-hidden rounded-lg">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Users size={14} className="text-slate-500" />
        <h3 className="text-xs font-semibold text-slate-700">Equipe</h3>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-red-600 text-xs text-center border p-2 rounded bg-red-50">{error}</div>
      ) : team.length === 0 ? (
        <div className="text-slate-400 text-xs text-center border border-dashed py-3 rounded-lg">Sem Membros</div>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {team.map((member) => (
             <div key={member.id} className="flex items-center justify-between p-2 rounded-md border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors group">
               <div className="min-w-0 pr-2">
                 <p className="text-xs font-medium text-slate-900 truncate leading-tight">{member.nome}</p>
                 <p className="text-[10px] text-slate-500 truncate mt-0.5">{member.cargo || 'Agente'}</p>
               </div>
               <div className="flex flex-col items-end shrink-0 bg-white border border-slate-100 px-2 py-1 rounded">
                 <div className="text-xs font-semibold text-blue-600 leading-none">
                   {member.ticket_count || 0}
                 </div>
                 <div className="text-[9px] font-medium text-slate-400 leading-none mt-0.5">Chamados</div>
               </div>
             </div>
          ))}
        </div>
      )}
    </Card>
  );
};
