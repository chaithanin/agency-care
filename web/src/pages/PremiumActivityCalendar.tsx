import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User, Download, Filter } from 'lucide-react';
import { PremiumCard, GradientCard, KPICard } from '../components/premium/PremiumCard';
import { PremiumButton } from '../components/premium/PremiumButton';

export default function PremiumActivityCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 5, 30));
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: 'field', label: '🚗 Field Visit', color: 'from-green-500 to-emerald-500' },
    { id: 'showroom', label: '🏢 Showroom', color: 'from-blue-500 to-cyan-500' },
    { id: 'training', label: '🎓 Training', color: 'from-orange-500 to-yellow-500' },
    { id: 'contract', label: '📝 Contract', color: 'from-red-500 to-pink-500' },
    { id: 'marketing', label: '📣 Marketing', color: 'from-purple-500 to-pink-500' },
    { id: 'followup', label: '🔄 Follow-up', color: 'from-orange-600 to-red-500' },
  ];

  const mockEvents = [
    { date: 15, agency: 'Property Group Co.', type: 'showroom', sales: 'John Doe', time: '09:00' },
    { date: 16, agency: 'Real Estate Services', type: 'field', sales: 'Jane Smith', time: '14:30' },
    { date: 18, agency: 'Urban Development', type: 'contract', sales: 'Mike Johnson', time: '10:00' },
    { date: 20, agency: 'Housing Solutions', type: 'training', sales: 'Sarah Lee', time: '11:00' },
    { date: 22, agency: 'Property Excellence', type: 'followup', sales: 'Tom Wilson', time: '15:30' },
  ];

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Activity Calendar</h1>
            <p className="text-gray-600">Track and manage all your appointments and activities</p>
          </div>
          <PremiumButton variant="primary" size="lg" icon={<Download size={20} />}>
            Export Calendar
          </PremiumButton>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            label="Total Appointments"
            value="24"
            trend={{ direction: 'up', percentage: 12 }}
            icon="📅"
            color="primary"
          />
          <KPICard
            label="This Month"
            value="18"
            trend={{ direction: 'up', percentage: 8 }}
            icon="📆"
            color="success"
          />
          <KPICard
            label="Completed"
            value="14"
            trend={{ direction: 'down', percentage: 3 }}
            icon="✅"
            color="success"
          />
          <KPICard
            label="Pending"
            value="4"
            trend={{ direction: 'up', percentage: 5 }}
            icon="⏳"
            color="warning"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Controls */}
        <PremiumCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Calendar View</h2>
              <div className="flex gap-2">
                <PremiumButton
                  variant={viewMode === 'month' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Month
                </PremiumButton>
                <PremiumButton
                  variant={viewMode === 'week' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Week
                </PremiumButton>
                <PremiumButton
                  variant={viewMode === 'day' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                >
                  Day
                </PremiumButton>
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Filter size={16} /> Filter by Category
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium
                      transition-all duration-300
                      ${selectedCategory === cat.id
                        ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                        : 'bg-white/50 text-gray-700 border border-white/30 hover:bg-white/70'
                      }
                    `}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Calendar Grid */}
        <PremiumCard className="p-8">
          <div className="space-y-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={24} className="text-purple-600" />
              </button>
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <ChevronRight size={24} className="text-purple-600" />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center py-2">
                  <p className="text-sm font-semibold text-gray-600">{day}</p>
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {Array(firstDay)
                .fill(null)
                .map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

              {days.map((day) => {
                const dayEvents = mockEvents.filter((e) => e.date === day);
                const isToday = day === 30;

                return (
                  <GradientCard
                    key={day}
                    gradient={isToday ? 'purple' : 'blue'}
                    className={`
                      min-h-24 cursor-pointer group
                      ${isToday ? 'ring-2 ring-purple-500 ring-offset-2' : ''}
                      hover:scale-105 transform
                    `}
                  >
                    <div className="h-full flex flex-col">
                      <p className={`text-sm font-semibold ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>
                        {day}
                      </p>
                      <div className="mt-1 space-y-1 flex-1">
                        {dayEvents.slice(0, 2).map((event, idx) => (
                          <div
                            key={idx}
                            className={`
                              text-xs px-2 py-1 rounded
                              bg-gradient-to-r ${
                                categories.find((c) => c.id === event.type)?.color || 'from-gray-400 to-gray-500'
                              }
                              text-white font-medium truncate
                            `}
                          >
                            {event.type === 'field' && '🚗'}
                            {event.type === 'showroom' && '🏢'}
                            {event.type === 'training' && '🎓'}
                            {event.type === 'contract' && '📝'}
                            {event.type === 'marketing' && '📣'}
                            {event.type === 'followup' && '🔄'}
                            {' '}{event.agency.split(' ')[0]}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-xs text-gray-500 px-2">+{dayEvents.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  </GradientCard>
                );
              })}
            </div>
          </div>
        </PremiumCard>

        {/* Upcoming Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PremiumCard>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                {mockEvents.slice(0, 4).map((event, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {event.date}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{event.agency}</p>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock size={14} /> {event.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={14} /> {event.sales}
                        </span>
                      </div>
                    </div>
                    <div className="text-2xl">{event.type === 'field' ? '🚗' : event.type === 'showroom' ? '🏢' : event.type === 'training' ? '🎓' : event.type === 'contract' ? '📝' : event.type === 'marketing' ? '📣' : '🔄'}</div>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </div>

          {/* Statistics */}
          <PremiumCard>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{cat.label}</span>
                    <span className="font-semibold text-gray-900">5</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${cat.color}`}
                      style={{ width: '60%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  );
}
