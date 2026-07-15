import React from "react";
import { cn } from "../../lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo = ({ size = 20, className }: LogoProps) => {
  return (
    <img
      src="/logo.png"
      alt="Gestifique"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      // Caso a imagem não exista ainda na pasta public, um fallback em CSS (SVG) pode ser carregado
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        // Fallback visual temporário para evitar quebrar o layout se o arquivo não estiver presente
        target.style.display = "none";
        if (target.nextElementSibling) {
          (target.nextElementSibling as HTMLElement).style.display = "flex";
        }
      }}
    />
  );
};

export const FallbackLogo = ({ size = 20, className }: LogoProps) => (
  <div
    className={cn(
      "flex flex-shrink-0 items-center justify-center bg-[#0052FF] text-white rounded-lg",
      className,
    )}
    style={{ width: size, height: size }}
  >
    <svg
      width={size * 0.6}
      height={size * 0.6}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  </div>
);

export const AppLogo = ({ size = 20, className }: LogoProps) => {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center shrink-0",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/logo.png"
        alt="Gestifique Logo"
        width={size}
        height={size}
        className="object-contain z-10 w-full h-full"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.opacity = "0"; // esconde o img que falhou
        }}
        onLoad={(e) => {
          const target = e.target as HTMLImageElement;
          if (target.nextElementSibling) {
            (target.nextElementSibling as HTMLElement).style.display = "none";
          }
        }}
      />
      {/* Fallback mostrado apenas se a imagem falhar/ainda não carregar */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <FallbackLogo size={size} className={className} />
      </div>
    </div>
  );
};
