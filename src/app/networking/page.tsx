'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { NetworkingContact, ContactRelationship, IndustryType } from '@/types/database.types'
import { useState, useEffect } from 'react'
import {
  Users,
  PlusCircle,
  Search,
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
  Lightbulb,
  X,
} from 'lucide-react'
import SectionPageHeader from '@/components/SectionPageHeader'

const supabase = createClient()

export default function NetworkingPage() {
  const { profile, user } = useAuth()
  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'
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

  const canManageContact = (contact: NetworkingContact) => {
    if (!profile) return false
    if (isUserAdmin) return true
    return contact.added_by === profile.id
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
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Career"
        title="Networking & alumni"
        icon={Users}
        actions={<button
          onClick={() => setShowForm(true)}
          className="portal-button"
        >
          <PlusCircle className="w-4 h-4" />
          Add contact
        </button>}
      />

      <div className="portal-alert-info flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p><strong>Consent required:</strong> only add contacts who explicitly agreed to be contacted by BOSSO members.</p>
      </div>

      {error && (
        <div className="portal-alert-error">{error}</div>
      )}

      {/* Search and Filters */}
      <div className="portal-panel">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-end">
          <div className="relative">
            <label className="portal-label">Search the directory</label>
            <Search className="absolute bottom-3 left-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, company, title, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="portal-input w-full pl-10"
            />
          </div>
          <label><span className="portal-label">Industry</span><select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value as any)} className="portal-input w-full">{industries.map(ind => <option key={ind} value={ind}>{ind === 'all' ? 'All industries' : getIndustryLabel(ind)}</option>)}</select></label>
          <label><span className="portal-label">Relationship</span><select value={selectedRelationship} onChange={(e) => setSelectedRelationship(e.target.value as any)} className="portal-input w-full">{relationships.map(rel => <option key={rel} value={rel}>{rel === 'all' ? 'All relationships' : getRelationshipLabel(rel)}</option>)}</select></label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Showing {filteredContacts.length} of {contacts.length} contacts</p>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="portal-modal-backdrop" onMouseDown={handleCancelForm}>
          <div className="portal-modal max-w-4xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="portal-form-header"><div><p className="portal-eyebrow">Networking directory</p><h2>{editingContact ? 'Edit contact' : 'Add a contact'}</h2><p>Capture enough context so members know who this person is and how they can help.</p></div><button type="button" onClick={handleCancelForm} className="portal-icon-button"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>1</span><div><h3>Who they are</h3><p>Basic professional information members can scan quickly.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><label><span className="portal-label">Name</span><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="portal-input w-full" required /></label><label><span className="portal-label">Title <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="portal-input w-full" placeholder="Director of Analytics" /></label><label><span className="portal-label">Company <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="portal-input w-full" placeholder="Boston Red Sox" /></label><label><span className="portal-label">Location <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="portal-input w-full" placeholder="Boston, MA" /></label><label><span className="portal-label">Industry</span><select value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value as IndustryType })} className="portal-input w-full"><option value="sports_team">Sports Team</option><option value="league">League</option><option value="agency">Agency</option><option value="consulting">Consulting</option><option value="analytics">Analytics</option><option value="media">Media</option><option value="tech">Tech</option><option value="finance">Finance</option><option value="marketing">Marketing</option><option value="other">Other</option></select></label><label><span className="portal-label">Relationship</span><select value={formData.relationship} onChange={(e) => setFormData({ ...formData, relationship: e.target.value as ContactRelationship })} className="portal-input w-full" required><option value="alumni">Alumni</option><option value="industry_professional">Industry Professional</option><option value="recruiter">Recruiter</option><option value="mentor">Mentor</option><option value="other">Other</option></select></label></div>
              </section>
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>2</span><div><h3>How to connect</h3><p>Add only the contact methods they agreed to share.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-3"><label><span className="portal-label">Email <span className="font-normal text-muted-foreground">(optional)</span></span><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="portal-input w-full" placeholder="contact@example.com" /></label><label><span className="portal-label">LinkedIn <span className="font-normal text-muted-foreground">(optional)</span></span><input type="url" value={formData.linkedin_url} onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })} className="portal-input w-full" placeholder="https://linkedin.com/in/…" /></label><label><span className="portal-label">Phone <span className="font-normal text-muted-foreground">(optional)</span></span><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="portal-input w-full" placeholder="(123) 456-7890" /></label></div>
              </section>
              <section className="portal-form-section">
                <div className="portal-form-section-heading"><span>3</span><div><h3>Member context</h3><p>Explain what they are open to discussing and anything members should know.</p></div></div>
                <div className="space-y-4"><label><span className="portal-label">Best for <span className="font-normal text-muted-foreground">(optional)</span></span><input type="text" value={formData.best_for} onChange={(e) => setFormData({ ...formData, best_for: e.target.value })} className="portal-input w-full" placeholder="analytics, career advice, internships" /><span className="mt-1.5 block text-xs text-muted-foreground">Separate topics with commas.</span></label><label><span className="portal-label">Notes <span className="font-normal text-muted-foreground">(optional)</span></span><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="portal-input w-full resize-none" rows={3} placeholder="How BOSSO knows them, preferred outreach, or helpful background." /></label></div>
              </section>
              <label className="portal-alert-info flex cursor-pointer items-start gap-3"><input type="checkbox" id="consent" checked={formData.has_consent} onChange={(e) => setFormData({ ...formData, has_consent: e.target.checked })} className="mt-1 h-4 w-4 rounded border-primary/30 text-primary focus:ring-primary" required /><span className="text-sm"><strong>Consent confirmed.</strong> This person explicitly agreed to be contacted by BOSSO members using the information above.</span></label>
              <div className="portal-form-actions"><button type="button" onClick={handleCancelForm} className="portal-button-secondary justify-center">Cancel</button><button type="submit" className="portal-button justify-center"><Users className="h-4 w-4" /> {editingContact ? 'Save changes' : 'Add contact'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Contacts List */}
      {loading ? (
        <div className="portal-loading flex-col">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground">Loading contacts...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="portal-empty">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3>{searchQuery || selectedIndustry !== 'all' || selectedRelationship !== 'all' ? 'No matching contacts' : 'No contacts yet'}</h3>
          <p>
            {searchQuery || selectedIndustry !== 'all' || selectedRelationship !== 'all'
              ? 'Try a broader search or clear one of the filters.'
              : 'Add the first consented alumni or industry connection.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="portal-panel space-y-3 transition-colors hover:border-primary/40">
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
                {canManageContact(contact) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="portal-icon-button"
                      title="Edit"
                      aria-label={`Edit ${contact.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="portal-icon-button text-destructive hover:text-destructive"
                      title="Delete"
                      aria-label={`Delete ${contact.name}`}
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
                      className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-border pt-2">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="portal-icon-button"
                    title="Email"
                    aria-label={`Email ${contact.name}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                {contact.linkedin_url && (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-icon-button"
                    title="LinkedIn"
                    aria-label={`Open ${contact.name}'s LinkedIn`}
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="portal-icon-button"
                    title="Phone"
                    aria-label={`Call ${contact.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {isUserAdmin && (
                  <div className="ml-auto text-xs text-muted-foreground">
                    {contact.contributor && (
                      <span>Added by {contact.contributor.full_name}</span>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
