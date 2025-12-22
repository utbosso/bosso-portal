'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { NetworkingContact, ContactRelationship, IndustryType } from '@/types/database.types'
import { useState, useEffect } from 'react'
import {
  Users,
  PlusCircle,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Linkedin,
  Building2,
  UserCheck,
  Edit2,
  Trash2,
  AlertCircle,
  ExternalLink,
  Tag,
  GraduationCap,
  TrendingUp,
  Lightbulb
} from 'lucide-react'

const supabase = createClient()

export default function NetworkingPage() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState<NetworkingContact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<NetworkingContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType | 'all'>('all')
  const [selectedRelationship, setSelectedRelationship] = useState<ContactRelationship | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState<NetworkingContact | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    company: '',
    industry: 'sports_team' as IndustryType,
    relationship: 'alumni' as ContactRelationship,
    email: '',
    linkedin_url: '',
    phone: '',
    location: '',
    notes: '',
    best_for: '',
    has_consent: false,
  })

  useEffect(() => {
    fetchContacts()
  }, [])

  useEffect(() => {
    filterContacts()
  }, [contacts, searchQuery, selectedIndustry, selectedRelationship])

  const fetchContacts = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('networking_contacts')
        .select(`
          *,
          contributor:profiles!networking_contacts_added_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setContacts(data || [])
    } catch (err) {
      console.error('Error fetching contacts:', err)
      setError('Failed to load networking contacts')
    } finally {
      setLoading(false)
    }
  }

  const filterContacts = () => {
    let filtered = [...contacts]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query) ||
        contact.title?.toLowerCase().includes(query) ||
        contact.location?.toLowerCase().includes(query) ||
        contact.best_for.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(contact => contact.industry === selectedIndustry)
    }

    if (selectedRelationship !== 'all') {
      filtered = filtered.filter(contact => contact.relationship === selectedRelationship)
    }

    setFilteredContacts(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (!formData.has_consent) {
      setError('You must confirm that this person has consented to being contacted')
      return
    }

    setError(null)
    try {
      const bestForArray = formData.best_for
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const payload = {
        name: formData.name,
        title: formData.title || null,
        company: formData.company || null,
        industry: formData.industry,
        relationship: formData.relationship,
        email: formData.email || null,
        linkedin_url: formData.linkedin_url || null,
        phone: formData.phone || null,
        location: formData.location || null,
        notes: formData.notes || null,
        best_for: bestForArray,
        has_consent: formData.has_consent,
        added_by: profile.id,
      }

      if (editingContact) {
        const { error: updateError } = await supabase
          .from('networking_contacts')
          .update(payload)
          .eq('id', editingContact.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('networking_contacts')
          .insert([payload])

        if (insertError) throw insertError
      }

      setShowForm(false)
      setEditingContact(null)
      resetForm()
      await fetchContacts()
    } catch (err) {
      console.error('Error saving contact:', err)
      setError('Failed to save contact')
    }
  }

  const handleEdit = (contact: NetworkingContact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      title: contact.title || '',
      company: contact.company || '',
      industry: contact.industry || 'sports_team',
      relationship: contact.relationship,
      email: contact.email || '',
      linkedin_url: contact.linkedin_url || '',
      phone: contact.phone || '',
      location: contact.location || '',
      notes: contact.notes || '',
      best_for: contact.best_for.join(', '),
      has_consent: contact.has_consent,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      const { error: deleteError } = await supabase
        .from('networking_contacts')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      await fetchContacts()
    } catch (err) {
      console.error('Error deleting contact:', err)
      setError('Failed to delete contact')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      company: '',
      industry: 'sports_team',
      relationship: 'alumni',
      email: '',
      linkedin_url: '',
      phone: '',
      location: '',
      notes: '',
      best_for: '',
      has_consent: false,
    })
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingContact(null)
    resetForm()
    setError(null)
  }

  const getRelationshipIcon = (relationship: ContactRelationship) => {
    switch (relationship) {
      case 'alumni':
        return <GraduationCap className="w-4 h-4" />
      case 'industry_professional':
        return <Briefcase className="w-4 h-4" />
      case 'recruiter':
        return <TrendingUp className="w-4 h-4" />
      case 'mentor':
        return <Lightbulb className="w-4 h-4" />
      default:
        return <UserCheck className="w-4 h-4" />
    }
  }

  const getRelationshipLabel = (relationship: ContactRelationship) => {
    return relationship.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getIndustryLabel = (industry: IndustryType | null) => {
    if (!industry) return 'Other'
    return industry.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  if (!profile) return null

  const industries: (IndustryType | 'all')[] = [
    'all',
    'sports_team',
    'league',
    'agency',
    'consulting',
    'analytics',
    'media',
    'tech',
    'finance',
    'marketing',
    'other'
  ]

  const relationships: (ContactRelationship | 'all')[] = [
    'all',
    'alumni',
    'industry_professional',
    'recruiter',
    'mentor',
    'other'
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Users className="w-7 h-7 text-primary" />
            Networking & Alumni Database
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Share external contacts with positive experiences. Help fellow members connect with industry professionals.
          </p>
          <div className="flex items-start gap-2 bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-primary">
              <strong>Important:</strong> Only add contacts who have explicitly consented to being contacted by BOSSO members.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Contact
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
              placeholder="Search by name, company, title, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-neon w-full pl-10"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Industry:</span>
          {industries.map(ind => (
            <button
              key={ind}
              onClick={() => setSelectedIndustry(ind)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                selectedIndustry === ind
                  ? 'bg-primary text-dark-300'
                  : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
              }`}
            >
              {ind === 'all' ? 'All' : getIndustryLabel(ind)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Relationship:</span>
          {relationships.map(rel => (
            <button
              key={rel}
              onClick={() => setSelectedRelationship(rel)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 ${
                selectedRelationship === rel
                  ? 'bg-primary text-dark-300'
                  : 'bg-dark-200 text-muted-foreground hover:bg-dark-100'
              }`}
            >
              {rel !== 'all' && getRelationshipIcon(rel)}
              {rel === 'all' ? 'All' : getRelationshipLabel(rel)}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card-glow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gradient">
            {editingContact ? 'Edit Contact' : 'Add New Contact'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-neon w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-neon w-full"
                  placeholder="e.g., Director of Analytics"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="input-neon w-full"
                  placeholder="e.g., Boston Red Sox"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value as IndustryType })}
                  className="input-neon w-full"
                >
                  <option value="sports_team">Sports Team</option>
                  <option value="league">League</option>
                  <option value="agency">Agency</option>
                  <option value="consulting">Consulting</option>
                  <option value="analytics">Analytics</option>
                  <option value="media">Media</option>
                  <option value="tech">Tech</option>
                  <option value="finance">Finance</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Relationship *</label>
                <select
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value as ContactRelationship })}
                  className="input-neon w-full"
                  required
                >
                  <option value="alumni">Alumni</option>
                  <option value="industry_professional">Industry Professional</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="mentor">Mentor</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-neon w-full"
                  placeholder="e.g., Boston, MA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-neon w-full"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  className="input-neon w-full"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-neon w-full"
                  placeholder="(123) 456-7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Best For (comma separated)</label>
                <input
                  type="text"
                  value={formData.best_for}
                  onChange={(e) => setFormData({ ...formData, best_for: e.target.value })}
                  className="input-neon w-full"
                  placeholder="analytics, career advice, internships"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-neon w-full"
                rows={3}
                placeholder="Any additional context about this contact or your experience with them..."
              />
            </div>

            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <input
                type="checkbox"
                id="consent"
                checked={formData.has_consent}
                onChange={(e) => setFormData({ ...formData, has_consent: e.target.checked })}
                className="mt-1 w-4 h-4 rounded border-primary/30 text-primary focus:ring-primary"
                required
              />
              <label htmlFor="consent" className="text-sm text-foreground">
                <strong className="text-primary">I confirm</strong> that this person has explicitly consented to being contacted by BOSSO members and is open to networking opportunities. *
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-dark-300 text-sm font-medium hover:opacity-90 transition"
              >
                {editingContact ? 'Update Contact' : 'Add Contact'}
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

      {/* Contacts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading contacts...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="card-glow p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {searchQuery || selectedIndustry !== 'all' || selectedRelationship !== 'all'
              ? 'No contacts match your filters'
              : 'No contacts yet. Be the first to add one!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="card-glow p-5 space-y-3 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1 text-primary">
                    {getRelationshipIcon(contact.relationship)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg">
                      {contact.name}
                    </h3>
                    {contact.title && (
                      <p className="text-sm text-muted-foreground">{contact.title}</p>
                    )}
                    {contact.company && (
                      <p className="text-sm text-primary flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {contact.company}
                      </p>
                    )}
                  </div>
                </div>
                {profile.id === contact.added_by && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="p-1 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-primary"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-1 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {contact.industry && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>{getIndustryLabel(contact.industry)}</span>
                  </div>
                )}
                {contact.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{contact.location}</span>
                  </div>
                )}
              </div>

              {contact.notes && (
                <p className="text-sm text-muted-foreground line-clamp-2 italic">
                  "{contact.notes}"
                </p>
              )}

              {contact.best_for.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {contact.best_for.map((tag, idx) => (
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

              <div className="flex items-center gap-2 pt-2 border-t border-dark-200">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="p-1.5 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-primary"
                    title="Email"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {contact.linkedin_url && (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-primary"
                    title="LinkedIn"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-1.5 rounded hover:bg-dark-100 transition text-muted-foreground hover:text-primary"
                    title="Phone"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                <div className="ml-auto text-xs text-muted-foreground">
                  {contact.contributor && (
                    <span>Added by {contact.contributor.full_name}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
