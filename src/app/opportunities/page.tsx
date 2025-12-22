'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Opportunity } from '@/types/database.types'
import { Briefcase, ExternalLink, Filter, MapPin, Search } from 'lucide-react'

const supabase = createClient()

export default function OpportunitiesPage() {
  const { profile } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const isBoard = profile?.role === 'board_member'

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

  useEffect(() => {
    fetchOpportunities()
  }, [])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gradient flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" />
            Opportunities
          </h1>
          <p className="text-muted-foreground text-sm">
            Curated sports business internships and entry-level roles shared by the community.
          </p>
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
          {visibleOpportunities.map((item) => (
            <div key={item.id} className="card-glow p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
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
                {item.link && (
                  <Link
                    href={item.link}
                    target="_blank"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Apply
                  </Link>
                )}
              </div>

              {item.description && (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {item.source && <span>Source: {item.source}</span>}
                {item.created_at && <span>Posted {new Date(item.created_at).toLocaleDateString()}</span>}
                {isBoard && item.poster && (
                  <span>Posted by {item.poster.full_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
