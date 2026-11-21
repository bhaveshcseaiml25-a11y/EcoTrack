'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, ImageIcon, MapPinned, MessageSquareWarning, Search, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useNow, useStore } from '@/lib/store'
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, formatDateTime, timeAgo } from '@/lib/domain'
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Drawer, EmptyState, Field, Input, KeyValue, PageHeader, Select, Textarea } from '../primitives'
import { ComplaintStatusBadge } from '../badges'
import { StatCard } from '../stat-card'
import { CityMap } from '../city-map'
import { ComplaintTimeline } from './complaint-timeline'

function ComplaintDrawer({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const { state, updateComplaint } = useStore()
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status)
  const [assignee, setAssignee] = useState(complaint.assignedTo ?? '')
  const [note, setNote] = useState('')
  const dirty = status !== complaint.status || assignee !== (complaint.assignedTo ?? '') || note.trim() !== ''
  const assignError = status === 'Assigned' && !assignee ? 'Select a worker to assign this complaint.' : undefined

  return (
    <Drawer
      open
      onClose={onClose}
      title={complaint.id}
      description={complaint.category}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1"
            disabled={!dirty || !!assignError}
            onClick={() => {
              updateComplaint(complaint.id, { status, assignedTo: assignee || undefined, note: note.trim() || undefined })
              setNote('')
              toast.success(`${complaint.id} updated`, { description: `Status: ${status}${assignee ? ` · ${assignee}` : ''}` })
            }}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <ComplaintStatusBadge status={complaint.status} />
          <span className="text-xs text-muted-foreground">Filed {formatDateTime(complaint.createdAt)}</span>
        </div>
        <p className="text-sm text-pretty">{complaint.description}</p>
        {complaint.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={complaint.image} alt={`Photo attached to complaint ${complaint.id}`} className="max-h-56 w-full rounded-lg border object-cover" />
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" aria-hidden /> No photo attached
          </p>
        )}
        <dl className="grid grid-cols-2 gap-4">
          <KeyValue label="Reported by" value={complaint.name} />
          <KeyValue label="Contact" value={complaint.contact} />
          <KeyValue label="Area" value={complaint.area} />
          <KeyValue label="Address" value={complaint.address} />
        </dl>
        <CityMap className="h-44" complaints={[complaint]} legend={false} label={`Location of ${complaint.id}`} />

        <div className="flex flex-col gap-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Update complaint</p>
          <Field label="Status" htmlFor="c-status">
            <Select id="c-status" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
              {COMPLAINT_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned worker" htmlFor="c-worker" error={assignError}>
            <Select id="c-worker" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-invalid={!!assignError}>
              <option value="">Unassigned</option>
              {state.workers.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name} · {w.role} ({w.area})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Internal note" htmlFor="c-note" hint="Added to the complaint history timeline.">
            <Textarea id="c-note" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Crew dispatched for afternoon shift" />
          </Field>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold">History</p>
          <ComplaintTimeline complaint={complaint} />
        </div>
      </div>
    </Drawer>
  )
}

export function ComplaintsView() {
  const { state } = useStore()
  const now = useNow()
  const params = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | ComplaintStatus>('all')
  const [category, setCategory] = useState<'all' | ComplaintCategory>('all')
  const [area, setArea] = useState('all')
  const { complaints } = state
  const selected = complaints.find((c) => c.id === params.get('id'))
  const open = (id: string | null) => router.replace(id ? `/complaints?id=${id}` : '/complaints', { scroll: false })
  const areas = useMemo(() => [...new Set(complaints.map((c) => c.area))].sort(), [complaints])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return complaints.filter(
      (c) =>
        (!q || [c.id, c.name, c.address, c.description].some((f) => f.toLowerCase().includes(q))) &&
        (status === 'all' || c.status === status) &&
        (category === 'all' || c.category === category) &&
        (area === 'all' || c.area === area),
    )
  }, [complaints, query, status, category, area])

  const count = (s: ComplaintStatus) => complaints.filter((c) => c.status === s).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Citizen Complaints"
        description="Review reports submitted through the citizen portal, assign field workers and keep residents informed."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Submitted" value={count('Submitted')} hint="Awaiting triage" icon={MessageSquareWarning} tone="navy" />
        <StatCard label="Under review" value={count('Under Review')} icon={ClipboardList} tone="orange" />
        <StatCard label="Assigned" value={count('Assigned')} hint="With field workers" icon={UserCheck} tone="teal" />
        <StatCard label="Resolved" value={count('Resolved')} hint={`${Math.round((count('Resolved') / Math.max(1, complaints.length)) * 100)}% resolution rate`} icon={UserCheck} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <div className="flex flex-col gap-2 border-b p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" aria-label="Search complaints" placeholder="Search ID, name or address" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="grid grid-cols-3 gap-2 md:flex">
              <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="md:w-36">
                <option value="all">All statuses</option>
                {COMPLAINT_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="md:w-40">
                <option value="all">All categories</option>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select aria-label="Filter by area" value={area} onChange={(e) => setArea(e.target.value)} className="md:w-32">
                <option value="all">All areas</option>
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={MessageSquareWarning} title="No complaints found" description="Adjust the filters or search term." />
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60', selected?.id === c.id && 'bg-primary/5')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{c.id}</span>
                        <ComplaintStatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium">{c.category}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.address}, {c.area} · {c.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p>{timeAgo(c.createdAt, now)}</p>
                      {c.assignedTo && <p className="mt-1 font-medium text-foreground">{c.assignedTo}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader icon={MapPinned} title="Complaint locations" description="Purple: open · Green: resolved" />
          <div className="p-5 pt-4">
            <CityMap className="h-[420px]" complaints={filtered} legend={false} onComplaintClick={(c) => open(c.id)} />
          </div>
        </Card>
      </div>

      {selected && <ComplaintDrawer key={selected.id + selected.updatedAt} complaint={selected} onClose={() => open(null)} />}
    </div>
  )
}
