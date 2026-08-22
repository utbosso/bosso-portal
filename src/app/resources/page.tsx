'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { LearningResource, ResourceType, ResourceCategory, UserRole, RoleScopeMode } from '@/types/database.types'
import { useState, useEffect } from 'react'
import {
  BookOpen,
  PlusCircle,
  Search,
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
import SectionPageHeader from '@/components/SectionPageHeader'
import {
  canAccessRoleScope,
  fromRoleScopePayload,
  getRoleScopeLabel,
  toRoleScopePayload,
  type RoleScopeOption,
} from '@/lib/role-scope'

const supabase = createClient()

export default function LearningHubPage() {
  const { profile, user, hasMinimumRole } = useAuth()
  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'
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
    role_scope_mode: null as RoleScopeMode | null,
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
    return canAccessRoleScope(profile?.role, resource.role_scope, resource.role_scope_mode)
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
        ...(formData.role_scope_mode ? { role_scope_mode: formData.role_scope_mode } : {}),
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
      role_scope_mode: resource.role_scope_mode ?? null,
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
      role_scope_mode: null,
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
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Career"
        title="Learning hub"
        description="Find practical guides, tools, courses, and templates shared by BOSSO members."
        icon={BookOpen}
        actions={<button
          onClick={() => setShowForm(true)}
          className="portal-button"
        >
          <PlusCircle className="w-4 h-4" />
          Add resource
        </button>}
      />

      {error && (
        <div className="portal-alert-error">{error}</div>
      )}

      {/* Search and Filters */}
      <div className="portal-panel">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px] md:items-end">
          <div className="relative">
            <label className="portal-label">Search the library</label>
            <Search className="absolute bottom-3 left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search titles, descriptions, or tags"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="portal-input w-full pl-10"
            />
          </div>
          <label><span className="portal-label">Category</span><select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as any)} className="portal-input w-full">{categories.map(cat => <option key={cat} value={cat}>{cat === 'all' ? 'All categories' : getCategoryLabel(cat)}</option>)}</select></label>
          <label><span className="portal-label">Format</span><select value={selectedType} onChange={(e) => setSelectedType(e.target.value as any)} className="portal-input w-full">{types.map(type => <option key={type} value={type}>{type === 'all' ? 'All formats' : getTypeLabel(type)}</option>)}</select></label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Showing {filteredResources.length} of {resources.length} resources</p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="portal-modal-backdrop" onMouseDown={handleCancelForm}>
          <div className="portal-modal max-w-3xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="portal-form-header"><div><p className="portal-eyebrow">Learning hub</p><h2>{editingResource ? 'Edit resource' : 'Share a resource'}</h2><p>Give members enough context to decide whether this resource is useful before opening it.</p></div><button type="button" onClick={handleCancelForm} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>1</span><div><h3>Resource</h3><p>Add the link and a short explanation of what members will get from it.</p></div></div>
                <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label><span className="portal-label">Title</span><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="portal-input w-full" required placeholder="Example: Intro to sports analytics" /></label><label><span className="portal-label">URL <span className="font-normal text-muted-foreground">(optional)</span></span><input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} className="portal-input w-full" placeholder="https://…" /></label></div><label><span className="portal-label">Why it is useful <span className="font-normal text-muted-foreground">(optional)</span></span><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="portal-input w-full resize-none" rows={4} placeholder="What will someone learn, and who is this best for?" /></label></div>
              </section>
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>2</span><div><h3>Organize it</h3><p>Category, format, and tags make the library easier to search.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><label><span className="portal-label">Category</span><select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ResourceCategory })} className="portal-input w-full" required><option value="sports_business">Sports Business</option><option value="analytics">Analytics</option><option value="consulting">Consulting</option><option value="marketing">Marketing</option><option value="finance">Finance</option><option value="career_development">Career Development</option><option value="technical_skills">Technical Skills</option><option value="other">Other</option></select></label><label><span className="portal-label">Format</span><select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as ResourceType })} className="portal-input w-full" required><option value="article">Article</option><option value="video">Video</option><option value="course">Course</option><option value="tool">Tool</option><option value="guide">Guide</option><option value="template">Template</option><option value="other">Other</option></select></label><label className="sm:col-span-2"><span className="portal-label">Search tags <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} className="portal-input w-full" placeholder="excel, data analysis, beginner" /><span className="mt-1.5 block text-xs text-muted-foreground">Separate tags with commas.</span></label></div>
              </section>
              <section className="portal-form-section"><div className="portal-form-section-heading"><span>3</span><div><h3>Visibility</h3><p>Choose the lowest position level that should see this resource.</p></div></div><label><span className="portal-label">Visible to</span><select value={fromRoleScopePayload(formData.role_scope, formData.role_scope_mode)} onChange={(e) => { const scopePayload = toRoleScopePayload(e.target.value as RoleScopeOption); setFormData({ ...formData, role_scope: scopePayload.roleScope, role_scope_mode: scopePayload.roleScopeMode }) }} className="portal-input w-full"><option value="all">All Members</option><option value="analyst">Analysts & Above</option><option value="analyst_only">Analysts Only</option><option value="project_manager">Project Managers & Above</option><option value="board_member">Board Members Only</option></select></label></section>
              <div className="portal-form-actions"><button type="button" onClick={handleCancelForm} className="portal-button-secondary justify-center">Cancel</button><button type="submit" className="portal-button justify-center"><BookOpen className="h-4 w-4" /> {editingResource ? 'Save changes' : 'Share resource'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Resources List */}
      {loading ? (
        <div className="portal-loading flex-col">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading resources...</p>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="portal-empty">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3>{searchQuery || selectedCategory !== 'all' || selectedType !== 'all' ? 'No matching resources' : 'No resources yet'}</h3>
          <p>
            {searchQuery || selectedCategory !== 'all' || selectedType !== 'all'
              ? 'Try a broader search or clear one of the filters.'
              : 'Be the first to share a useful guide, tool, or template.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredResources.map((resource) => (
            <article key={resource.id} className="portal-panel space-y-3 transition-colors hover:border-primary/40">
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
                      className="portal-icon-button"
                      title="Edit"
                      aria-label={`Edit ${resource.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(resource.id)}
                      className="portal-icon-button text-destructive hover:text-destructive"
                      title="Delete"
                      aria-label={`Delete ${resource.title}`}
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
                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
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
                      {getRoleScopeLabel(resource.role_scope, resource.role_scope_mode)}
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
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
