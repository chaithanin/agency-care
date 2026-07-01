import React from 'react';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  hover = true,
  glass = false,
}) => {
  const baseClasses = `
    rounded-3xl p-6 backdrop-blur-2xl
    border border-white/20
    ${glass ? 'bg-white/70' : 'bg-white/95'}
    shadow-lg
    ${hover ? 'hover:shadow-2xl hover:scale-[1.02]' : ''}
    transition-all duration-300 ease-out
  `;

  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
};

interface GradientCardProps {
  children: React.ReactNode;
  className?: string;
  gradient?: 'purple' | 'pink' | 'blue' | 'mint' | 'sunset';
}

const gradients = {
  purple: 'from-purple-500/10 to-purple-500/5',
  pink: 'from-pink-500/10 to-pink-500/5',
  blue: 'from-blue-500/10 to-blue-500/5',
  mint: 'from-emerald-500/10 to-emerald-500/5',
  sunset: 'from-orange-500/10 via-pink-500/10 to-purple-500/5',
};

export const GradientCard: React.FC<GradientCardProps> = ({
  children,
  className = '',
  gradient = 'purple',
}) => {
  return (
    <div className={`
      bg-gradient-to-br ${gradients[gradient]}
      rounded-2xl p-6
      border border-white/30
      backdrop-blur-xl
      hover:border-white/50 transition-all duration-300
      ${className}
    `}>
      {children}
    </div>
  );
};

export const KPICard: React.FC<{
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down'; percentage: number };
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}> = ({ label, value, trend, icon, color = 'primary' }) => {
  const colorMap = {
    primary: 'text-purple-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  };

  return (
    <PremiumCard className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-gray-600 text-sm font-medium">{label}</p>
        {icon && <div className={`text-2xl ${colorMap[color]}`}>{icon}</div>}
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <div className={`text-xs font-medium ${trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage}% from last month
          </div>
        )}
      </div>
    </PremiumCard>
  );
};
