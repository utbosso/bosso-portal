'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Opportunity } from '@/types/database.types'
import { Briefcase, ExternalLink, Filter, MapPin, Search, BookmarkPlus, Check, Trash2 } from 'lucide-react'
import { isAdmin } from '@/lib/admin'

const supabase = createClient()

export default function OpportunitiesPage() {
  const { profile } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [savedOpportunities, setSavedOpportunities] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const isBoard = profile?.role === 'board_member'
  const isUserAdmin = isAdmin(profile?.role)

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
      const matchesSearch = !query || `${item.title} ${item.company ?? ''} ${item.location ?? ''}`
        .toLowerCase()
        .includes(query)
      const matchesType = typeFilter === 'all' || (item.opportunity_type ?? '').toLowerCase() === typeFilter
      return matchesSearch && matchesType
    })
  }, [opportunities, search, typeFilter])

  const types = Array.from(
    new Set(opportunities.map((item) => (item.opportunity_type ?? '').toLowerCase()).filter(Boolean))
  )

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            Opportunities
          </h1>
        </div>
      </div>

      <div className="card-glow p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, company, or location"
            className="w-full md:w-80 bg-transparent text-sm text-foreground focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-md bg-dark-100 border border-primary/20 text-sm text-foreground"
          >
            <option value="all">All types</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-glow p-4 text-sm text-muted-foreground">
        If you know of opportunities, please share them in the <span className="text-primary">#opportunities</span> Slack channel.
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading opportunities...</p>}

      {!loading && visibleOpportunities.length === 0 && (
        <div className="card-glow p-4 text-sm text-muted-foreground">
          No opportunities found.
        </div>
      )}

      {!loading && visibleOpportunities.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleOpportunities.map((item) => {
            const isSaved = savedOpportunities.has(item.id)
            const isSaving = savingId === item.id

            return (
              <div key={item.id} className="card-glow p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSaved ? (
                      <Link
                        href="/applications"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium hover:bg-green-500/30 transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Saved
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleSaveOpportunity(item)}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-dark-200 text-foreground border border-primary/20 text-xs font-medium hover:bg-dark-100 hover:border-primary/40 transition disabled:opacity-50"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    )}
                    {canManageOpportunity(item) && (
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 rounded-md bg-dark-200 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition"
                        title="Delete opportunity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {item.link && (
                      <Link
                        href={item.link}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-dark-300 text-xs font-medium hover:opacity-90 transition"
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
