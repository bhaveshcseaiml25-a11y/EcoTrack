'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ImageIcon, List, Map as MapIcon, MessageSquareWarning, Search, UserCheck, X } from 'lucide-react'
import { CityMap } from '@/components/map'
import { Badge, Card, CardHeader, EmptyState, Input, PageHeader, Select, Textarea } from '@/components/eco/primitives'
import { ComplaintTimeline } from '@/components/complaints/complaint-timeline'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUS_META, COMPLAINT_STATUS_ORDER, MUNICIPAL_WORKERS } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/logic'
import { useStore } from '@/lib/store'
import type { Complaint, ComplaintStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

function ComplaintDetail({ complaint, onClose }: { complaint: Complaint; onClose: () => void }) {
  const { run, busy } = useStore()
  const [note, setNote] = useState('')
  const key = `cmp-${complaint.id}`
  const update = (patch: Parameters<typeof api.updateComplaint>[1], title: string) =>
    run(key, () => api.updateComplaint(complaint.id, patch), { tone: 'success', title }).then(() => setNote(''))

  return (
    <Card className="overflow-hidden animate-in fade-in slide-in-from-right-2">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{complaint.id}</p>
          <h2 className="text-base font-semibold">{complaint.category}</h2>
          <Badge className={cn('mt-1', COMPLAINT_STATUS_META[complaint.status].badge)}>{COMPLAINT_STATUS_META[complaint.status].label}</Badge>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close complaint details">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex max-h-[calc(100dvh-14rem)] flex-col gap-5 overflow-y-auto p-5">
        {complaint.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={complaint.image} alt={`Photo submitted with ${complaint.id}`} className="aspect-video w-full rounded-lg border object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            <ImageIcon className="mr-1.5 size-4" aria-hidden="true" /> No photo attached
          </div>
        )}
        <p className="text-sm text-pretty">{complaint.description}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Citizen</dt>
            <dd className="font-medium">{complaint.citizenName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contact</dt>
            <dd className="truncate font-medium">{complaint.contact}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Location</dt>
            <dd>{complaint.address}</dd>
            <dd className="font-mono text-xs text-muted-foreground">
              {complaint.latitude.toFixed(6)}, {complaint.longitude.toFixed(6)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd>{formatDateTime(complaint.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Assigned to</dt>
            <dd>{complaint.assignedTo ?? 'Unassigned'}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <label htmlFor="assign" className="text-xs font-medium">
            Assign to municipal worker
          </label>
          <Select
            id="assign"
            value={complaint.assignedTo ?? ''}
            disabled={busy === key}
            onChange={(e) => e.target.value && update({ assignedTo: e.target.value, note: note || undefined }, `Assigned to ${e.target.value.split(' –')[0]}`)}
          >
            <option value="">Select a worker…</option>
            {MUNICIPAL_WORKERS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </Select>
          <label htmlFor="note" className="mt-1 text-xs font-medium">
            Status note (optional)
          </label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible in the citizen's status timeline" className="min-h-16" />
          <div className="grid grid-cols-2 gap-2">
            {COMPLAINT_STATUS_ORDER.filter((s) => s !== complaint.status).map((s) => (
              <Button key={s} size="sm" variant={s === 'resolved' ? 'default' : 'outline'} disabled={busy === key} onClick={() => update({ status: s, note: note || undefined }, `Marked ${COMPLAINT_STATUS_META[s].label.toLowerCase()}`)}>
                {COMPLAINT_STATUS_META[s].label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium">Status history</p>
          <ComplaintTimeline complaint={complaint} />
        </div>
      </div>
    </Card>
  )
}

export function ComplaintsPage() {
  const { db } = useStore()
  const params = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(params.get('id'))
  const [view, setView] = useState<'list' | 'map'>('list')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ComplaintStatus | 'all'>('all')
  const [category, setCategory] = useState('all')
  if (!db) return null

  const term = query.trim().toLowerCase()
  const list = db.complaints.filter(
    (c) =>
      (!term || `${c.id} ${c.address} ${c.citizenName} ${c.description}`.toLowerCase().includes(term)) &&
      (status === 'all' || c.status === status) &&
      (category === 'all' || c.category === category),
  )
  const selected = db.complaints.find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Citizen complaints" description="Review reports submitted through the citizen portal, assign crews and keep residents updated." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {COMPLAINT_STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(status === s ? 'all' : s)}
            className={cn('flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm hover:shadow-md', status === s && 'ring-2 ring-primary')}
          >
            <span className="size-3 rounded-full" style={{ background: COMPLAINT_STATUS_META[s].color }} aria-hidden="true" />
            <div>
              <p className="text-xl font-semibold tabular-nums">{db.complaints.filter((c) => c.status === s).length}</p>
              <p className="text-xs text-muted-foreground">{COMPLAINT_STATUS_META[s].label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader
            icon={MessageSquareWarning}
            title="All complaints"
            description={`${list.length} of ${db.complaints.length}`}
            action={
              <div role="tablist" aria-label="View" className="flex rounded-lg border bg-muted/50 p-0.5 text-xs font-medium">
                {(['list', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 capitalize', view === v ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                  >
                    {v === 'list' ? <List className="size-3.5" /> : <MapIcon className="size-3.5" />} {v}
                  </button>
                ))}
              </div>
            }
          />
          <div className="grid gap-2 border-b px-5 py-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, address, name" className="pl-8" aria-label="Search complaints" />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus | 'all')} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {COMPLAINT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {COMPLAINT_STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="all">All categories</option>
              {COMPLAINT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          {view === 'map' ? (
            <div className="h-[560px]">
              <CityMap className="h-full w-full" complaints={list} layers={{ bins: false, vehicles: false, routes: false }} onComplaintOpen={setSelectedId} focus={selected ? [selected.latitude, selected.longitude] : null} />
            </div>
          ) : list.length === 0 ? (
            <EmptyState title="No complaints match" description="Try adjusting the filters." />
          ) : (
            <ul className="max-h-[620px] divide-y overflow-y-auto">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn('flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50', selectedId === c.id && 'bg-accent/60')}
                  >
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" className="size-14 shrink-0 rounded-lg border object-cover" />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <MessageSquareWarning className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{c.category}</p>
                        <Badge className={COMPLAINT_STATUS_META[c.status].badge}>{COMPLAINT_STATUS_META[c.status].label}</Badge>
                      </div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{c.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.id} · {c.address} · {formatRelative(c.createdAt)}
                      </p>
                      {c.assignedTo && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-status-info">
                          <UserCheck className="size-3" aria-hidden="true" /> {c.assignedTo}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <ComplaintDetail complaint={selected} onClose={() => setSelectedId(null)} />
        ) : (
          <Card className="h-fit">
            <EmptyState icon={MessageSquareWarning} title="Select a complaint" description="Choose a report from the list or map to review, assign and update it." />
          </Card>
        )}
      </div>
    </div>
  )
}
