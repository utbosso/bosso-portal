import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database.types'

const REVIEWER_ROLES: UserRole[] = ['project_manager', 'board_member', 'admin']

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await request.json()
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, title, assigned_to, assigned_by, status, assignee_status, point_value, points_category, points_awarded, auto_approve')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (!task.point_value || task.point_value <= 0) {
      return NextResponse.json({ success: true, status: 'no_points' })
    }

    if (task.points_awarded) {
      return NextResponse.json({ success: true, status: 'already_awarded' })
    }

    const isReviewer =
      task.assigned_by === user.id ||
      (actorProfile?.role ? REVIEWER_ROLES.includes(actorProfile.role) : false)

    const isAutoApproveAssignee =
      task.assigned_to === user.id &&
      !!task.auto_approve &&
      (task.assignee_status === 'completed' || task.status === 'completed')

    if (!isReviewer && !isAutoApproveAssignee) {
      return NextResponse.json({ error: 'Unauthorized to award task points' }, { status: 403 })
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({ points_awarded: true })
      .eq('id', taskId)
      .eq('points_awarded', false)
      .select('id')

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ success: true, status: 'already_awarded' })
    }

    const category = task.points_category || 'membership'
    const { error: insertError } = await supabaseAdmin
      .from('points_adjustments')
      .insert({
        user_id: task.assigned_to,
        adjusted_by: user.id,
        points: task.point_value,
        reason: `Task completion: ${task.title} (${category})`,
      })

    if (insertError) {
      await supabaseAdmin
        .from('tasks')
        .update({ points_awarded: false })
        .eq('id', taskId)

      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: 'awarded' })
  } catch (error) {
    console.error('Task point award error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
