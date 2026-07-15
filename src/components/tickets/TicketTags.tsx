import React, { useState } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

interface TicketTagsProps {
  tags: string[];
  onAdd?: (tag: string) => void;
  onRemove?: (tag: string) => void;
  readOnly?: boolean;
  className?: string;
}

export const TicketTags = ({ tags, onAdd, onRemove, readOnly, className }: TicketTagsProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && onAdd) {
      onAdd(newTag.trim());
      setNewTag('');
      setIsAdding(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5 items-center", className)}>
      <Tag size={12} className="text-slate-400 mr-1" />
      
      {tags.map((tag) => (
        <div key={tag}>
          <Badge 
            variant="slate" 
            className="text-[10px] py-0 px-1.5 h-5 flex items-center gap-1 group bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {tag}
            {!readOnly && onRemove && (
              <button 
                onClick={() => onRemove(tag)}
                className="text-slate-400 hover:text-red-500 transition-colors focus:outline-none"
              >
                <X size={10} />
              </button>
            )}
          </Badge>
        </div>
      ))}

      {!readOnly && onAdd && (
        <div className="flex items-center">
          {isAdding ? (
            <form onSubmit={handleSubmit} className="flex items-center">
              <input
                autoFocus
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onBlur={() => !newTag && setIsAdding(false)}
                className="h-5 w-20 text-[10px] px-1.5 border border-blue-200 rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="tag..."
              />
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="h-5 w-5 flex items-center justify-center rounded border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95"
            >
              <Plus size={10} />
            </button>
          )}
        </div>
      )}

      {!isAdding && tags.length === 0 && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Sem tags</span>
      )}
    </div>
  );
};
