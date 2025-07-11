import React from 'react';
import { ChatStats } from '../types';
import { MessageSquare, Zap, Clock, RefreshCw } from 'lucide-react';

interface DashboardProps {
  stats: ChatStats | null;
  onResetStats: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onResetStats }) => {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    return seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds.toFixed(2)}s`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-600">Real-time chat analytics</p>
        </div>
        <button
          onClick={onResetStats}
          className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={16} />
          <span>Reset Stats</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Chats</p>
              <p className="text-3xl font-bold text-blue-600">{stats.total_chats}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tokens</p>
              <p className="text-3xl font-bold text-green-600">{stats.total_tokens}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-3xl font-bold text-purple-600">
                {formatTime(stats.average_response_time)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Conversations</h3>
        </div>
        <div className="p-6">
          {stats.recent_conversations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No conversations yet</p>
          ) : (
            <div className="space-y-4">
              {stats.recent_conversations.map((conv, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-600">User:</span>
                    <p className="text-sm text-gray-800 mt-1">{conv.user_message}</p>
                  </div>
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-600">Assistant:</span>
                    <p className="text-sm text-gray-800 mt-1 line-clamp-2">{conv.assistant_response}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(conv.timestamp).toLocaleString()}</span>
                    <div className="flex items-center space-x-4">
                      <span>{conv.tokens} tokens</span>
                      <span>{formatTime(conv.response_time)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;