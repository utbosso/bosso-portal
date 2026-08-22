'use client'

import { useEffect, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'

export default function SemesterRolloverGuide() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="portal-icon-button"
        aria-label="How does a semester reset work?"
        title="How does a semester reset work?"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-6 sm:p-8 sm:pb-6">
              <div>
                <p className="portal-eyebrow">Read this before you reset</p>
                <h2 className="mt-1 text-xl font-semibold">How a semester reset actually works</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="portal-icon-button shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 sm:p-8 sm:pt-6">
              <p className="text-sm leading-6 text-muted-foreground">
                A reset never deletes accounts, points, or history — it archives the outgoing
                semester's shared content and opens a fresh access period. Follow these three
                phases in order. Do not skip ahead to Activate before finishing Before.
              </p>

              <div className="mt-6 space-y-6 text-sm leading-6">
                <section>
                  <h3 className="font-semibold text-foreground">1. Before the reset (this term is still current)</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                    <li>
                      <span className="text-foreground">Step 1 — Prepare the next term.</span> Fill in the
                      upcoming term's name, dates, and academic year. Leave point minimums at 0 while the
                      board decides. Saving generates one position code per role.
                    </li>
                    <li>
                      <span className="font-medium text-amber-700">Copy every generated code immediately</span> —
                      only a secure hash is stored, so the plain code cannot be recovered after you leave
                      the page.
                    </li>
                    <li>
                      Save these codes until later — codes only work once this term is activated, so
                      don't hand them out yet. Submitting early will show as invalid.
                    </li>
                    <li>Confirm a verified database backup exists, and schedule a short maintenance window.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground">2. The reset itself</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                    <li>
                      <span className="text-foreground">Step 4 — Activate term.</span> One click, one atomic
                      database transaction: archives the outgoing term's announcements, events, documents,
                      feedback, and team tasks; deactivates its old position codes; makes the new term
                      current; keeps your admin access; and records an audit entry.
                    </li>
                    <li>
                      Accounts, profiles, dues history, and the point ledger are never touched by this step.
                    </li>
                    <li>If activation ever reports an error, it already rolled back automatically — diagnose before retrying, do not click Activate repeatedly.</li>
                  </ol>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground">3. After the reset (new term is now current)</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                    <li>Position codes now work. Members sign in, see the renewal screen, and enter their code.</li>
                    <li>
                      <span className="text-foreground">Step 2 — Review renewals.</span> For each member:
                      confirm their position, record dues (semester or full-year), then approve or decline.
                      A full-year payment automatically covers the linked spring term too.
                    </li>
                    <li>
                      <span className="text-foreground">Step 3 — Build semester groups.</span> Recreate teams
                      like a PM and their analysts — groups do not carry over automatically.
                    </li>
                    <li>
                      Once the board finalizes minimums, switch the point system panel from Draft to
                      <span className="text-foreground"> Publish requirements</span> — that is what members
                      actually see everywhere in the portal.
                    </li>
                    <li>
                      Whenever convenient, run Step 1 again to prepare the term after this one — do this
                      before recording any full-year dues payment, since that payment needs both term IDs
                      to link against.
                    </li>
                  </ol>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
