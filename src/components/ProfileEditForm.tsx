'use client'

import { useState } from 'react'
import { Profile } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, Save, X } from 'lucide-react'

interface ProfileEditFormProps {
  profile: Profile
  onSuccess: (updatedProfile: Profile) => void
  onCancel: () => void
}

export default function ProfileEditForm({ profile, onSuccess, onCancel }: ProfileEditFormProps) {
  const [formData, setFormData] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    ut_eid: profile.ut_eid || '',
    ut_email: profile.ut_email || '',
    phone_number: profile.phone_number || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Update profile in database
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          ut_eid: formData.ut_eid || null,
          ut_email: formData.ut_email || null,
          phone_number: formData.phone_number || null,
        })
        .eq('id', profile.id)
        .select()
        .single()

      if (updateError) throw updateError

      onSuccess(data)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* First Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="w-4 h-4" />
            First Name
          </label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            className="w-full px-4 py-3 bg-muted rounded-lg text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors"
            placeholder="Enter your first name"
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="w-4 h-4" />
            Last Name
          </label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            className="w-full px-4 py-3 bg-muted rounded-lg text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors"
            placeholder="Enter your last name"
          />
        </div>

        {/* UT EID */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="w-4 h-4" />
            UT EID
          </label>
          <input
            type="text"
            value={formData.ut_eid}
            onChange={(e) => setFormData({ ...formData, ut_eid: e.target.value })}
            className="w-full px-4 py-3 bg-muted rounded-lg text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors"
            placeholder="Enter your UT EID"
          />
        </div>

        {/* UT Email */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Mail className="w-4 h-4" />
            UT Email
          </label>
          <input
            type="email"
            value={formData.ut_email}
            onChange={(e) => setFormData({ ...formData, ut_email: e.target.value })}
            className="w-full px-4 py-3 bg-muted rounded-lg text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors"
            placeholder="youreid@utexas.edu"
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone_number}
            onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
            className="w-full px-4 py-3 bg-muted rounded-lg text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors"
            placeholder="(123) 456-7890"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </form>
  )
}
