'use client'

import { useState } from 'react'
import { Profile, WorkExperience } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, Save, X, Briefcase, Plus, Trash2 } from 'lucide-react'

interface ProfileEditFormProps {
  profile: Profile
  onSuccess: (updatedProfile: Profile) => void
  onCancel: () => void
}

const emptyWorkExperience: Omit<WorkExperience, 'id'> = {
  company: '',
  title: '',
  start_date: '',
  end_date: null,
  is_current: false,
  description: null,
}

export default function ProfileEditForm({ profile, onSuccess, onCancel }: ProfileEditFormProps) {
  const [formData, setFormData] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    ut_eid: profile.ut_eid || '',
    ut_email: profile.ut_email || '',
    phone_number: profile.phone_number || '',
  })
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>(
    profile.work_experiences || []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addWorkExperience = () => {
    setWorkExperiences([
      ...workExperiences,
      { ...emptyWorkExperience, id: crypto.randomUUID() },
    ])
  }

  const removeWorkExperience = (id: string) => {
    setWorkExperiences(workExperiences.filter((exp) => exp.id !== id))
  }

  const updateWorkExperience = (id: string, field: keyof WorkExperience, value: any) => {
    setWorkExperiences(
      workExperiences.map((exp) =>
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Filter out incomplete work experiences (must have company and title)
      const validWorkExperiences = workExperiences.filter(
        (exp) => exp.company.trim() && exp.title.trim()
      )

      // Update profile in database
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name || null,
          last_name: formData.last_name || null,
          ut_eid: formData.ut_eid || null,
          ut_email: formData.ut_email || null,
          phone_number: formData.phone_number || null,
          work_experiences: validWorkExperiences.length > 0 ? validWorkExperiences : null,
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

      {/* Work Experience Section */}
      <div className="space-y-4 pt-4 border-t border-primary/20">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Work Experience
          </label>
          <button
            type="button"
            onClick={addWorkExperience}
            className="px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Experience
          </button>
        </div>

        {workExperiences.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No work experience added yet.</p>
        ) : (
          <div className="space-y-4">
            {workExperiences.map((exp, index) => (
              <div
                key={exp.id}
                className="p-4 bg-muted/50 rounded-lg border border-primary/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">
                    Experience {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeWorkExperience(exp.id)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Company *</label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => updateWorkExperience(exp.id, 'company', e.target.value)}
                      className="w-full px-3 py-2 bg-muted rounded-md text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Company name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Job Title *</label>
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) => updateWorkExperience(exp.id, 'title', e.target.value)}
                      className="w-full px-3 py-2 bg-muted rounded-md text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors text-sm"
                      placeholder="Your role"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <input
                      type="month"
                      value={exp.start_date}
                      onChange={(e) => updateWorkExperience(exp.id, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 bg-muted rounded-md text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">End Date</label>
                    <input
                      type="month"
                      value={exp.end_date || ''}
                      onChange={(e) => updateWorkExperience(exp.id, 'end_date', e.target.value || null)}
                      disabled={exp.is_current}
                      className="w-full px-3 py-2 bg-muted rounded-md text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors text-sm disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`current-${exp.id}`}
                    checked={exp.is_current || false}
                    onChange={(e) => {
                      updateWorkExperience(exp.id, 'is_current', e.target.checked)
                      if (e.target.checked) {
                        updateWorkExperience(exp.id, 'end_date', null)
                      }
                    }}
                    className="w-4 h-4 rounded border-primary/20 bg-muted text-primary focus:ring-primary/20"
                  />
                  <label htmlFor={`current-${exp.id}`} className="text-xs text-muted-foreground">
                    I currently work here
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Description (optional)</label>
                  <textarea
                    value={exp.description || ''}
                    onChange={(e) => updateWorkExperience(exp.id, 'description', e.target.value || null)}
                    rows={2}
                    className="w-full px-3 py-2 bg-muted rounded-md text-foreground border border-primary/20 focus:border-primary focus:outline-none transition-colors text-sm resize-none"
                    placeholder="Brief description of your role..."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
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
