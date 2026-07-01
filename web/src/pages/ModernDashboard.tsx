import { useState } from 'react';
import { Settings, Search, Comment, DirectionsCar, DirectionsBus, DirectionsWalk } from '@mui/icons-material';
import { PremiumCard } from '../components/premium/PremiumCard';
import { PremiumButton } from '../components/premium/PremiumButton';

export default function ModernDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');

  const bulletins = [
    {
      id: 1,
      title: 'Bluestone lane now overtakes starbet',
      description: 'To calibrate company happy hours at husein yards and near by places',
      image: '🎨',
      author: 'Catherine Wassen',
      daysAgo: 2,
    },
    {
      id: 2,
      title: 'Bluestone lane is now opening at 1902 St',
      description: 'To celebrate company happy hours at husein yards and near by places',
      image: '🌆',
      author: 'Catherine Wassen',
      daysAgo: 2,
    },
  ];

  const teamMembers = [
    {
      id: 1,
      name: 'Jeff Block',
      role: 'Team member',
      time: '10:00 AM - 07:00 PM',
      location: 'Fifth Avenue Store',
      phone: '(+01) 978-835-7855',
      status: 'Active',
      avatar: '👨',
    },
    {
      id: 2,
      name: 'Celine Dian',
      role: 'Team member',
      time: '10:00 AM - 07:30 PM',
      location: 'Fifth Avenue Store',
      phone: '(+01) 814-656-5394',
      status: 'Waiting',
      avatar: '👩',
    },
    {
      id: 3,
      name: 'Amanda Korber',
      role: 'Team member',
      time: '10:00 AM - 07:00 PM',
      location: 'Fifth Avenue Store',
      phone: '(+01) 191-878-1564',
      status: 'Idle',
      avatar: '👩',
    },
    {
      id: 4,
      name: 'Samantha Dion',
      role: 'Team member',
      time: '10:00 AM - 08:00 PM',
      location: 'Fifth Avenue Store',
      phone: '(+01) 191-878-1564',
      status: 'Pending',
      avatar: '👩',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-500 bg-green-50';
      case 'Waiting':
        return 'text-yellow-500 bg-yellow-50';
      case 'Idle':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-56 bg-gradient-to-b from-blue-600 to-blue-700 text-white p-8 rounded-tr-3xl min-h-screen flex flex-col">
          {/* Profile Section */}
          <div className="mb-8">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 text-3xl">
              O
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl">
                👩
              </div>
              <div>
                <p className="font-semibold">Hello, Susie</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-3 flex-1">
            <div className="flex items-center gap-3 px-4 py-3 bg-white/20 rounded-xl font-semibold">
              <span>📊</span> Dashboard
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl cursor-pointer transition">
              <span>📅</span> Calendar
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl cursor-pointer transition">
              <span>🎫</span> Tickets
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl cursor-pointer transition">
              <span>👥</span> Contacts
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl cursor-pointer transition">
              <span>📖</span> Book
            </div>
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-xl cursor-pointer transition">
              <Settings sx={{ fontSize: 20 }} /> Settings
            </div>
          </nav>

          <div className="text-center text-white/60 text-sm pt-4 border-t border-white/20">
            Powered by Nest
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Middle - Bulletin Board */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Bulletin board</h1>
                <PremiumButton variant="primary" size="md">
                  + Add
                </PremiumButton>
              </div>

              <div className="space-y-6">
                {bulletins.map((bulletin) => (
                  <div
                    key={bulletin.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div className="flex gap-6 p-6">
                      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-red-400 via-orange-400 to-yellow-400 flex items-center justify-center text-6xl flex-shrink-0">
                        {bulletin.image}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {bulletin.title}
                        </h3>
                        <p className="text-gray-600 mb-4 text-sm">{bulletin.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-sm">
                            👤
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {bulletin.author}
                            </p>
                            <p className="text-xs text-gray-500">{bulletin.daysAgo} days ago</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Shift Monitor & Weather */}
            <div className="col-span-1 space-y-6">
              {/* Shift Monitor */}
              <PremiumCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Shift monitor</h2>
                  <div className="flex gap-2">
                    <Search sx={{ fontSize: 20, color: '#666' }} />
                    <Comment sx={{ fontSize: 20, color: '#666' }} />
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-3 font-medium text-sm transition-colors ${
                      activeTab === 'pending'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setActiveTab('confirmed')}
                    className={`pb-3 font-medium text-sm transition-colors ${
                      activeTab === 'confirmed'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500'
                    }`}
                  >
                    Confirmed
                  </button>
                </div>

                {/* Date */}
                <p className="text-right text-xs text-gray-500 mb-4">26 Jan, 2019</p>

                {/* Team Members List */}
                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="pb-4 border-b border-gray-100 last:border-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-sm">
                          {member.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.role}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 ml-11 mb-1">{member.time}</p>
                      <p className="text-xs text-gray-500 ml-11">{member.location}</p>
                      <div className="ml-11 mt-2 flex items-center justify-between">
                        <p className="text-xs text-gray-600">{member.phone}</p>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(
                            member.status
                          )}`}
                        >
                          {member.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </PremiumCard>

              {/* Travel Time */}
              <PremiumCard className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Travel Time</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition">
                    <DirectionsCar sx={{ fontSize: 20, color: '#60A5FA' }} />
                    <span className="text-sm font-medium text-gray-700">Car</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition">
                    <DirectionsBus sx={{ fontSize: 20, color: '#60A5FA' }} />
                    <span className="text-sm font-medium text-gray-700">Bus</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition">
                    <DirectionsWalk sx={{ fontSize: 20, color: '#60A5FA' }} />
                    <span className="text-sm font-medium text-gray-700">Walk</span>
                  </button>
                </div>

                <div className="mt-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                  <p className="text-xs text-gray-600 mb-1">Leave by</p>
                  <p className="text-4xl font-bold text-gray-900">08:34</p>
                  <p className="text-xs text-gray-600 mt-2">Estimated time: 11 mins</p>
                </div>
              </PremiumCard>

              {/* Weather */}
              <PremiumCard className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Today's weather</h3>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">New York</p>
                  <div className="text-6xl font-bold text-gray-900 mb-1">27°C</div>
                  <p className="text-sm text-gray-600">Clear</p>
                  <div className="mt-4 h-16 bg-gradient-to-r from-orange-300 to-pink-300 rounded-lg opacity-60"></div>
                </div>
              </PremiumCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
