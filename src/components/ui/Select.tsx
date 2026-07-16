import React, { useState, useRef, useEffect, useId, useLayoutEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string | number | null;
  name?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: "sm" | "md" | "lg" | "xs";
  /** Preferência de alinhamento do menu. "auto" vira para a esquerda se não couber. */
  align?: "start" | "end" | "auto";
}

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
};

export const Select: React.FC<SelectProps> = ({
  value,
  name,
  onChange,
  options,
  placeholder = "Selecionar...",
  disabled = false,
  className,
  buttonClassName,
  dropdownClassName,
  size = "md",
  align = "auto",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  const updateMenuPosition = () => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const measuredWidth = menuRef.current?.offsetWidth || 0;
    const minWidth = Math.max(rect.width, measuredWidth || 160);
    const estimatedHeight = menuRef.current?.offsetHeight || Math.min(240, options.length * 36 + 12);

    let preferredAlign = align;
    if (align === "auto") {
      preferredAlign =
        rect.left + minWidth > window.innerWidth - margin ? "end" : "start";
    }

    let left =
      preferredAlign === "end" ? rect.right - minWidth : rect.left;
    left = Math.min(
      Math.max(left, margin),
      Math.max(margin, window.innerWidth - minWidth - margin),
    );

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openAbove =
      spaceBelow < Math.min(estimatedHeight, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      openAbove ? spaceAbove - gap : spaceBelow - gap,
    );
    const top = openAbove
      ? Math.max(margin, rect.top - Math.min(estimatedHeight, maxHeight) - gap)
      : rect.bottom + gap;

    setMenuPosition({ top, left, minWidth, maxHeight });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [isOpen, options.length, align]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleReposition = () => updateMenuPosition();

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    // Remedeia após o DOM pintar a largura real do menu
    const raf = window.requestAnimationFrame(updateMenuPosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen, options.length, align]);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen((open) => {
      if (!open) {
        const selectedIndex = options.findIndex((option) => String(option.value) === String(value) && !option.disabled);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled));
      }
      return !open;
    });
  };

  const handleSelect = (option: SelectOption) => {
    if (!option.disabled) {
      onChange(option.value);
      setIsOpen(false);
    }
  };

  const moveActive = (direction: 1 | -1) => {
    if (!options.length) return;
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) {
        setActiveIndex(next);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!isOpen) toggleDropdown();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" && isOpen) {
      setActiveIndex(options.findIndex((option) => !option.disabled));
    } else if (event.key === "End" && isOpen) {
      for (let index = options.length - 1; index >= 0; index -= 1) {
        if (!options[index].disabled) { setActiveIndex(index); break; }
      }
    } else if ((event.key === "Enter" || event.key === " ") && isOpen && activeIndex >= 0) {
      handleSelect(options[activeIndex]);
    } else if ((event.key === "Enter" || event.key === " ") && !isOpen) {
      toggleDropdown();
    }
  };

  return (
    <div
      className={cn(
        "relative inline-block w-full text-left",
        isOpen && "z-[9999]",
        className,
      )}
      ref={containerRef}
    >
      {name && (
        <input
          type="hidden"
          name={name}
          value={value === null || value === undefined ? "" : String(value)}
        />
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-slate-300 bg-white text-slate-700 shadow-[0_1px_1px_rgba(15,23,42,0.02)] transition-all outline-none",
          "focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/25",
          "hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
          size === "xs" && "h-8 px-2 text-xs",
          size === "sm" && "h-9 px-2.5 py-1 text-xs",
          size === "md" && "h-10 px-3 py-1.5 text-[13px]",
          size === "lg" && "h-11 px-3.5 py-2 text-sm",
          buttonClassName,
        )}
      >
        <span className="truncate">
          {selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={size === "md" || size === "sm" || size === "xs" ? 14 : 16}
          className={cn(
            "text-slate-400 transition-transform flex-shrink-0 ml-2",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && menuPosition && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-[9999] bg-white border border-slate-200 rounded-md shadow-lg p-1 overflow-y-auto custom-scrollbar",
            "shadow-[0_12px_32px_rgba(15,23,42,0.14)]",
            dropdownClassName,
          )}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: menuPosition.minWidth,
            maxHeight: menuPosition.maxHeight,
          }}
          role="listbox"
          id={listboxId}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
              Nenhuma opção
            </div>
          ) : (
            options.map((option, index) => {
              const isSelected = String(option.value) === String(value);
              return (
                <div
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-[13px] transition-colors group",
                    isSelected
                      ? "bg-blue-50 text-blue-800 font-semibold ring-1 ring-inset ring-blue-200"
                      : index === activeIndex
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                    option.disabled &&
                      "opacity-50 cursor-not-allowed pointer-events-none",
                  )}
                >
                  <span className="truncate pr-4">{option.label}</span>
                  {isSelected && (
                    <Check size={14} className="flex-shrink-0 text-blue-600" />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
