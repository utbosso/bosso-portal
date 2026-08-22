'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Opportunity } from '@/types/database.types'
import { Briefcase, ExternalLink, MapPin, Search, BookmarkPlus, Check, Trash2 } from 'lucide-react'
import SectionPageHeader from '@/components/SectionPageHeader'

const supabase = createClient()

export default function OpportunitiesPage() {
  const { profile, user } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savedOpportunities, setSavedOpportunities] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const isBoard = profile?.role === 'board_member'
  const isUserAdmin = user?.email?.trim().toLowerCase() === 'internal@txbosso.com'

  const fetchOpportunities = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select(
          `
          id,
          title,
          company,
          location,
          opportunity_type,
          link,
          description,
          source,
          posted_by,
          created_at,
          poster:profiles!opportunities_posted_by_fkey(id, full_name, email)
        `
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = ((data as any[]) ?? []).map((row) => ({
        ...row,
        poster: Array.isArray(row.poster) ? row.poster[0] ?? null : row.poster ?? null,
      })) as Opportunity[]
      setOpportunities(rows)
    } catch (err: any) {
      console.error('Error loading opportunities', err)
      setError('Failed to load opportunities.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSavedOpportunities = async () => {
    if (!profile) return

    try {
      const { data, error } = await supabase
        .from('applications')
        .select('opportunity_id')
        .eq('user_id', profile.id)
        .not('opportunity_id', 'is', null)

      if (error) throw error

      const saved = new Set((data || []).map(app => app.opportunity_id).filter(Boolean) as string[])
      setSavedOpportunities(saved)
    } catch (err) {
      console.error('Error fetching saved opportunities', err)
    }
  }

  useEffect(() => {
    fetchOpportunities()
    fetchSavedOpportunities()
  }, [profile?.id])

  const visibleOpportunities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return opportunities.filter((item) => {
      return !query || `${item.title} ${item.company ?? ''} ${item.location ?? ''}`
        .toLowerCase()
        .includes(query)
    })
  }, [opportunities, search])

  const handleSaveOpportunity = async (opp: Opportunity) => {
    if (!profile) return

    setSavingId(opp.id)
    setError(null)

    try {
      const payload = {
        user_id: profile.id,
        opportunity_id: opp.id,
        title: opp.title,
        company: opp.company,
        link: opp.link,
        status: 'saved' as const,
      }

      const { error: insertError } = await supabase
        .from('applications')
        .insert(payload)

      if (insertError) throw insertError

      setSavedOpportunities(prev => new Set([...prev, opp.id]))
    } catch (err) {
      console.error('Error saving opportunity', err)
      setError('Failed to save opportunity to applications')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const confirmDelete = window.confirm('Delete this opportunity?')
    if (!confirmDelete) return

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchOpportunities()
    } catch (err: any) {
      console.error('Error deleting opportunity:', err)
      setError('Failed to delete opportunity.')
    }
  }

  const canManageOpportunity = (opp: Opportunity) => {
    if (!profile) return false
    if (isUserAdmin) return true
    return opp.posted_by === profile.id
  }

  return (
    <div className="portal-page space-y-7">
      <SectionPageHeader
        eyebrow="Career"
        title="Opportunities"
        description="Discover roles shared by the BOSSO community and move the right ones into your application pipeline."
        icon={Briefcase}
        actions={<Link href="/applications" className="portal-button-secondary">View my pipeline</Link>}
      />

      <div className="portal-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, or location"
            className="portal-input w-full pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground sm:whitespace-nowrap">{visibleOpportunities.length} shown · {savedOpportunities.size} saved</span>
      </div>

      <div className="portal-alert-info">
        Know of a role worth sharing? Add it to the <span className="font-semibold">#opportunities</span> Slack channel for the community.
      </div>

      {error && <div className="portal-alert-error">{error}</div>}
      {loading && <div className="portal-loading">Loading opportunities...</div>}

      {!loading && visibleOpportunities.length === 0 && (
        <div className="portal-empty">
          <Briefcase className="h-9 w-9" />
          <h3>No matching opportunities</h3>
          <p>Try a broader title, company, or location search.</p>
        </div>
      )}

      {!loading && visibleOpportunities.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleOpportunities.map((item) => {
            const isSaved = savedOpportunities.has(item.id)
            const isSaving = savingId === item.id

            return (
              <article key={item.id} className="portal-panel space-y-4 transition-colors hover:border-primary/40">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.company && <span>{item.company}</span>}
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.location}
                        </span>
                      )}
                      {item.opportunity_type && (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase tracking-wide text-[10px]">
                          {item.opportunity_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {isSaved ? (
                      <Link
                        href="/applications"
                        className="badge-success inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Saved
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleSaveOpportunity(item)}
                        disabled={isSaving}
                        className="portal-button-secondary small"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    {canManageOpportunity(item) && (
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="portal-icon-button text-destructive hover:text-destructive"
                        title="Delete opportunity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {item.link && (
                      <Link
                        href={item.link}
                        target="_blank"
                        className="portal-button small"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Apply
                      </Link>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {item.source && <span>Source: {item.source}</span>}
                  {item.created_at && <span>Posted {new Date(item.created_at).toLocaleDateString()}</span>}
                  {isBoard && item.poster && (
                    <span>Posted by {item.poster.full_name}</span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
