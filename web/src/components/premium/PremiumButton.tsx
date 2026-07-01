import React from 'react';

interface PremiumButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  onClick,
  disabled = false,
  loading = false,
}) => {
  const baseClasses = `
    font-medium font-sans
    rounded-xl
    transition-all duration-300
    flex items-center justify-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${loading ? 'opacity-50' : 'hover:scale-105'}
  `;

  const sizeMap = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantMap = {
    primary: `
      bg-gradient-to-r from-purple-600 to-purple-700
      text-white
      hover:shadow-lg hover:shadow-purple-500/30
      active:scale-95
    `,
    secondary: `
      bg-white/10 backdrop-blur-md
      text-gray-800
      border border-white/20
      hover:bg-white/20 hover:border-white/40
    `,
    ghost: `
      bg-transparent
      text-gray-700 hover:text-gray-900
      border-b-2 border-transparent
      hover:border-purple-500
    `,
    glass: `
      bg-white/70 backdrop-blur-xl
      text-gray-800
      border border-white/30
      hover:bg-white/80 hover:border-white/50
      shadow-md hover:shadow-lg
    `,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${sizeMap[size]}
        ${variantMap[variant]}
        ${className}
      `}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
};
