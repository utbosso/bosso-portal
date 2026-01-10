'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { LearningResource, ResourceType, ResourceCategory, UserRole } from '@/types/database.types'
import { useState, useEffect } from 'react'
import {
  BookOpen,
  PlusCircle,
  Search,
  Filter,
  ExternalLink,
  Video,
  FileText,
  BookMarked,
  Wrench,
  MapPin,
  FilePlus2,
  Tag,
  X,
  Edit2,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { isAdmin } from '@/lib/admin'

const supabase = createClient()

export default function LearningHubPage() {
  const { profile, hasMinimumRole } = useAuth()
  const isUserAdmin = isAdmin(profile?.role)
  const [resources, setResources] = useState<LearningResource[]>([])
  const [filteredResources, setFilteredResources] = useState<LearningResource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all')
  const [selectedType, setSelectedType] = useState<ResourceType | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'sports_business' as ResourceCategory,
    type: 'article' as ResourceType,
    url: '',
    tags: '',
    role_scope: null as UserRole | null,
  })

  useEffect(() => {
    fetchResources()
  }, [profile?.role])

  useEffect(() => {
    filterResources()
  }, [resources, searchQuery, selectedCategory, selectedType])

  const fetchResources = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('learning_resources')
        .select(`
          *,
          contributor:profiles!learning_resources_created_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const visibleResources = (data || []).filter(canViewResource)
      setResources(visibleResources)
    } catch (err) {
      console.error('Error fetching resources:', err)
      setError('Failed to load learning resources')
    } finally {
      setLoading(false)
    }
  }

  const canViewResource = (resource: LearningResource) => {
    if (!resource.role_scope) return true
    if (!profile) return false

    const roleHierarchy: Record<UserRole, number> = {
      general_member: 1,
      analyst: 2,
      project_manager: 3,
      board_member: 4,
      admin: 5
    }

    return roleHierarchy[profile.role] >= roleHierarchy[resource.role_scope]
  }

  const canManageResource = (resource: LearningResource) => {
    if (!profile) return false
    if (isUserAdmin) return true
    return resource.created_by === profile.id
  }

  const filterResources = () => {
    let filtered = [...resources]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(resource =>
        resource.title.toLowerCase().includes(query) ||
        resource.description?.toLowerCase().includes(query) ||
        resource.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(resource => resource.category === selectedCategory)
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(resource => resource.type === selectedType)
    }

    setFilteredResources(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setError(null)
    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const payload = {
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        type: formData.type,
        url: formData.url || null,
        tags: tagsArray,
        role_scope: formData.role_scope,
        created_by: profile.id,
      }

      if (editingResource) {
        const { error: updateError } = await supabase
          .from('learning_resources')
          .update(payload)
          .eq('id', editingResource.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('learning_resources')
          .insert([payload])

        if (insertError) throw insertError
      }

      setShowForm(false)
      setEditingResource(null)
      resetForm()
      await fetchResources()
    } catch (err) {
      console.error('Error saving resource:', err)
      setError('Failed to save resource')
    }
  }

  const handleEdit = (resource: LearningResource) => {
    setEditingResource(resource)
    setFormData({
      title: resource.title,
      description: resource.description || '',
      category: resource.category,
      type: resource.type,
      url: resource.url || '',
      tags: resource.tags.join(', '),
      role_scope: resource.role_scope,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return

    try {
      const { error: deleteError } = await supabase
        .from('learning_resources')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      await fetchResources()
    } catch (err) {
      console.error('Error deleting resource:', err)
      setError('Failed to delete resource')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'sports_business',
      type: 'article',
      url: '',
      tags: '',
      role_scope: null,
    })
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingResource(null)
    resetForm()
  }

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />
      case 'course':
        return <BookMarked className="w-4 h-4" />
      case 'tool':
        return <Wrench className="w-4 h-4" />
      case 'guide':
        return <MapPin className="w-4 h-4" />
      case 'template':
        return <FilePlus2 className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getCategoryLabel = (category: ResourceCategory) => {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getTypeLabel = (type: ResourceType) => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  if (!profile) return null

  const categories: (ResourceCategory | 'all')[] = [
    'all',
    'sports_business',
    'analytics',
    'consulting',
    'marketing',
    'finance',
    'career_development',
    'technical_skills',
    'other'
  ]

  const types: (ResourceType | 'all')[] = [
    'all',
    'article',
    'video',
    'course',
    'tool',
    'guide',
    'template',
    'other'
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Learning Hub
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Resource
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="card-glow p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-neon w-full !pl-10"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Category:</span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                selectedCategory === cat
                  ? 'bg-primary text-dark-300'
                  : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
              }`}
            >
              {cat === 'all' ? 'All' : getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        <div className="hidden md:flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Type:</span>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                selectedType === type
                  ? 'bg-primary text-dark-300'
                  : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
              }`}
            >
              {type !== 'all' && getTypeIcon(type)}
              {type === 'all' ? 'All' : getTypeLabel(type)}
            </button>
          ))}
        </div>

        {/* Mobile dropdowns */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="input-neon w-full text-sm py-2"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All' : getCategoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="input-neon w-full text-sm py-2"
            >
              {types.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All' : getTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card-glow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gradient">
            {editingResource ? 'Edit Resource' : 'Add New Resource'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-neon w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input-neon w-full"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ResourceCategory })}
                  className="input-neon w-full"
                  required
                >
                  <option value="sports_business">Sports Business</option>
                  <option value="analytics">Analytics</option>
                  <option value="consulting">Consulting</option>
                  <option value="marketing">Marketing</option>
                  <option value="finance">Finance</option>
                  <option value="career_development">Career Development</option>
                  <option value="technical_skills">Technical Skills</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ResourceType })}
                  className="input-neon w-full"
                  required
                >
                  <option value="article">Article</option>
                  <option value="video">Video</option>
                  <option value="course">Course</option>
                  <option value="tool">Tool</option>
                  <option value="guide">Guide</option>
                  <option value="template">Template</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Visibility</label>
                <select
                  value={formData.role_scope || ''}
                  onChange={(e) => setFormData({ ...formData, role_scope: e.target.value as UserRole | null || null })}
                  className="input-neon w-full"
                >
                  <option value="">All Members</option>
                  <option value="analyst">Analysts & Above</option>
                  <option value="project_manager">Project Managers & Above</option>
                  <option value="board_member">Board Members Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="input-neon w-full"
                  placeholder="excel, data analysis, beginner"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-neon w-full"
                rows={3}
                placeholder="Brief description of the resource..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
              >
                {editingResource ? 'Update Resource' : 'Add Resource'}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 rounded-lg bg-dark-200 text-foreground text-sm font-medium hover:bg-dark-100 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resources List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading resources...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="card-glow p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery || selectedCategory !== 'all' || selectedType !== 'all'
              ? 'No resources match your filters'
              : 'No resources yet. Be the first to add one!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource) => (
            <div key={resource.id} className="card-glow p-4 space-y-3 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="mt-1 text-primary">
                    {getTypeIcon(resource.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground line-clamp-2">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getCategoryLabel(resource.category)}
                    </p>
                  </div>
                </div>
                {canManageResource(resource) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(resource)}
                      className="p-1 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-primary"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="p-1 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {resource.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {resource.description}
                </p>
              )}

              {resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resource.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-full bg-dark-200 text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-dark-200">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {resource.contributor && (
                    <span>{resource.contributor.full_name}</span>
                  )}
                  {resource.role_scope && (
                    <span className="flex items-center gap-1 text-primary">
                      <EyeOff className="w-3 h-3" />
                      {resource.role_scope === 'analyst' ? 'Analysts+' :
                       resource.role_scope === 'project_manager' ? 'PMs+' :
                       'Board Only'}
                    </span>
                  )}
                </div>
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-accent transition flex items-center gap-1 text-sm font-medium"
                  >
                    View
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
