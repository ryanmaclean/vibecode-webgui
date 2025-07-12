import { formatDistanceToNow } from 'date-fns'
import { 
  Server, 
  Bot, 
  Users, 
  Settings, 
  AlertCircle, 
  CheckCircle,
  Clock
} from 'lucide-react'

interface Activity {
  id: string
  type: 'workspace' | 'model' | 'user' | 'system' | 'alert'
  title: string
  description: string
  timestamp: string
  status?: 'success' | 'warning' | 'error'
  user?: string
}

// Mock recent activity data
const recentActivities: Activity[] = [
  {
    id: '1',
    type: 'workspace',
    title: 'Workspace Created',
    description: 'admin-workspace provisioned successfully',
    timestamp: '2025-07-11T02:30:00Z',
    status: 'success',
    user: 'admin'
  },
  {
    id: '2',
    type: 'model',
    title: 'Model Registry Updated',
    description: '127 AI models synchronized from OpenRouter',
    timestamp: '2025-07-11T02:15:00Z',
    status: 'success'
  },
  {
    id: '3',
    type: 'user',
    title: 'User Login',
    description: 'developer@vibecode.dev authenticated via Authelia',
    timestamp: '2025-07-11T02:10:00Z',
    status: 'success',
    user: 'developer'
  },
  {
    id: '4',
    type: 'system',
    title: 'Cache Cleared',
    description: 'AI response cache cleared (245 keys removed)',
    timestamp: '2025-07-11T02:05:00Z',
    status: 'success',
    user: 'admin'
  },
  {
    id: '5',
    type: 'alert',
    title: 'High Memory Usage',
    description: 'Worker node memory usage at 89%',
    timestamp: '2025-07-11T01:55:00Z',
    status: 'warning'
  },
  {
    id: '6',
    type: 'workspace',
    title: 'Workspace Stopped',
    description: 'user-workspace stopped due to inactivity',
    timestamp: '2025-07-11T01:45:00Z',
    status: 'success',
    user: 'user'
  }
]

export function RecentActivity() {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        <button className="text-sm text-primary-600 hover:text-primary-700">
          View all
        </button>
      </div>
      
      <div className="flow-root">
        <ul className="-mb-8">
          {recentActivities.map((activity, index) => (
            <li key={activity.id}>
              <div className="relative pb-8">
                {index !== recentActivities.length - 1 && (
                  <span 
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" 
                    aria-hidden="true" 
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <ActivityIcon type={activity.type} status={activity.status} />
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                        {activity.user && (
                          <span className="text-gray-500 font-normal"> by {activity.user}</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                    </div>
                    <div className="whitespace-nowrap text-right text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ActivityIcon({ 
  type, 
  status 
}: { 
  type: Activity['type']
  status?: Activity['status'] 
}) {
  const getIconAndColor = () => {
    if (status === 'error') {
      return { icon: AlertCircle, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
    }
    if (status === 'warning') {
      return { icon: AlertCircle, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600' }
    }

    switch (type) {
      case 'workspace':
        return { icon: Server, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' }
      case 'model':
        return { icon: Bot, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' }
      case 'user':
        return { icon: Users, bgColor: 'bg-green-100', iconColor: 'text-green-600' }
      case 'system':
        return { icon: Settings, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' }
      case 'alert':
        return { icon: AlertCircle, bgColor: 'bg-red-100', iconColor: 'text-red-600' }
      default:
        return { icon: CheckCircle, bgColor: 'bg-gray-100', iconColor: 'text-gray-600' }
    }
  }

  const { icon: Icon, bgColor, iconColor } = getIconAndColor()

  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white ${bgColor}`}>
      <Icon className={`h-4 w-4 ${iconColor}`} />
    </span>
  )
}