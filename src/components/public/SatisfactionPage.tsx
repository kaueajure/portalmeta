import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AppLogo } from '../ui/Logo';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface SatisfactionPageProps {
  token: string;
}

export function SatisfactionPage({ token }: SatisfactionPageProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<any>(null);

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    api.get(`/satisfaction/${token}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Pesquisa inválida ou expirada.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/satisfaction/${token}`, { nota: rating, comentario: comment });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px]"
      >
        <div className="text-center mb-6">
           <AppLogo size={48} className="mb-3 mx-auto" />
           <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Pesquisa de Satisfação</h2>
           <p className="text-sm text-slate-500">Sua opinião é muito importante para nós.</p>
        </div>

        <Card className="p-6">
           {error && !success ? (
             <div className="text-center space-y-3">
               <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                 <AlertCircle className="w-6 h-6 text-red-600" />
               </div>
               <h3 className="text-base font-medium text-slate-900">Ops!</h3>
               <p className="text-sm text-slate-600">{error}</p>
             </div>
           ) : success || data?.respondido_em ? (
             <div className="text-center space-y-3">
               <motion.div 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center"
               >
                 <CheckCircle className="w-6 h-6 text-emerald-600" />
               </motion.div>
               <h3 className="text-base font-medium text-slate-900">Obrigado!</h3>
               <p className="text-sm text-slate-600">Sua avaliação foi registrada com sucesso.</p>
             </div>
           ) : (
             <form onSubmit={handleSubmit} className="space-y-5">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 mb-3">Como você avalia o atendimento recebido?</p>
                  <div className="flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star 
                          className={`w-8 h-8 ${
                            star <= (hoverRating || rating) 
                              ? 'text-yellow-400 fill-yellow-400' 
                              : 'text-slate-300'
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    {rating === 1 && 'Muito ruim'}
                    {rating === 2 && 'Ruim'}
                    {rating === 3 && 'Regular'}
                    {rating === 4 && 'Bom'}
                    {rating === 5 && 'Excelente'}
                    {rating === 0 && 'Selecione uma nota'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700 block text-left">
                    Comentário (opcional)
                  </label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none resize-none"
                    rows={3}
                    placeholder="Deixe um comentário sobre o atendimento..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <Button 
                  type="submit" 
                  size="sm"
                  disabled={rating === 0 || submitting} 
                  className="w-full h-9 text-sm"
                >
                  {submitting ? 'Enviando...' : 'Enviar Avaliação'}
                </Button>
             </form>
           )}
        </Card>
      </motion.div>
    </div>
  );
}
