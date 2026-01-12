import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Fetch all members with their profile data
    const { data: members, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Create CSV content
    const headers = [
      'First Name',
      'Last Name',
      'Full Name',
      'Email',
      'UT EID',
      'UT Email',
      'Phone Number',
      'Role',
      'Account Status',
      'Email Verified',
      'Member Since',
    ]

    const csvRows = [
      headers.join(','), // Header row
      ...members.map((member) => {
        return [
          escapeCsvValue(member.first_name || ''),
          escapeCsvValue(member.last_name || ''),
          escapeCsvValue(member.full_name || ''),
          escapeCsvValue(member.email || ''),
          escapeCsvValue(member.ut_eid || ''),
          escapeCsvValue(member.ut_email || ''),
          escapeCsvValue(member.phone_number || ''),
          escapeCsvValue(member.role?.replace('_', ' ') || ''),
          escapeCsvValue(member.account_status || ''),
          escapeCsvValue(member.email_verified ? 'Yes' : 'No'),
          escapeCsvValue(member.created_at ? new Date(member.created_at).toLocaleDateString() : ''),
        ].join(',')
      }),
    ]

    const csvContent = csvRows.join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bosso-members-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting members:', error)
    return NextResponse.json({ error: error.message || 'Failed to export members' }, { status: 500 })
  }
}

// Helper function to escape CSV values
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
