import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  ShieldCheck, 
  User, 
  Mail, 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  Key
} from 'lucide-react'
import { k8sApi } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import type { User } from '../types'

export function Users() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: k8sApi.getUsers,
    refetchInterval: 30000
  })

  const deleteUserMutation = useMutation({
    mutationFn: k8sApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesStatus && matchesRole
  })

  const getStatusBadge = (status: User['status']) => {
    const statusConfig = {
      active: { class: 'badge-success', icon: CheckCircle },
      inactive: { class: 'badge-error', icon: XCircle },
      pending: { class: 'badge-warning', icon: AlertCircle }
    }
    return statusConfig[status]
  }

  const getRoleBadge = (role: User['role']) => {
    const roleConfig = {
      admin: { class: 'bg-red-100 text-red-800', icon: ShieldCheck },
      developer: { class: 'bg-blue-100 text-blue-800', icon: Shield },
      viewer: { class: 'bg-gray-100 text-gray-800', icon: User }
    }
    return roleConfig[role]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage user accounts and permissions across the platform.
          </p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900">{users?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users?.filter(u => u.status === 'active').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <ShieldCheck className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Admins</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users?.filter(u => u.role === 'admin').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Developers</p>
              <p className="text-2xl font-semibold text-gray-900">
                {users?.filter(u => u.role === 'developer').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                filteredUsers?.map((user) => (
                  <UserRow 
                    key={user.id} 
                    user={user}
                    onDelete={() => deleteUserMutation.mutate(user.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredUsers?.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' || roleFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating a new user account.'
            }
          </p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

function UserRow({ 
  user, 
  onDelete 
}: { 
  user: User
  onDelete: () => void 
}) {
  const [showActions, setShowActions] = useState(false)
  const statusConfig = {
    active: { class: 'badge-success', icon: CheckCircle },
    inactive: { class: 'badge-error', icon: XCircle },
    pending: { class: 'badge-warning', icon: AlertCircle }
  }
  const roleConfig = {
    admin: { class: 'bg-red-100 text-red-800', icon: ShieldCheck },
    developer: { class: 'bg-blue-100 text-blue-800', icon: Shield },
    viewer: { class: 'bg-gray-100 text-gray-800', icon: User }
  }

  const StatusIcon = statusConfig[user.status].icon
  const RoleIcon = roleConfig[user.role].icon

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
            <div className="text-xs text-gray-400 font-mono">@{user.username}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleConfig[user.role].class}`}>
          <RoleIcon className="h-3 w-3 mr-1" />
          {user.role}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`badge ${statusConfig[user.status].class}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {user.status}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {user.lastLoginAt ? (
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-gray-400 mr-1" />
            {formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}
          </div>
        ) : (
          <span className="text-gray-400">Never</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <div className="flex items-center">
          <Calendar className="h-4 w-4 text-gray-400 mr-1" />
          {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1 rounded-md hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showActions && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="py-1">
                <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit User
                </button>
                <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </button>
                <button 
                  onClick={onDelete}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    displayName: '',
    role: 'developer' as User['role'],
    password: ''
  })

  const queryClient = useQueryClient()

  const createUserMutation = useMutation({
    mutationFn: k8sApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createUserMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                className="input"
              >
                <option value="viewer">Viewer</option>
                <option value="developer">Developer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={createUserMutation.isPending}
                className="btn-primary flex-1"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}