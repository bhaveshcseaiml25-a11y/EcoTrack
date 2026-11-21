'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { Camera, CheckCircle2, ClipboardList, Copy, LocateFixed, MapPin, Search, Send, Trash2 } from 'lucide-react'
import { LocationPickerMap } from '@/components/map'
import { Logo } from '@/components/eco/logo'
import { Badge, Card, CardHeader, EmptyState, Field, Input, Select, Spinner, Textarea } from '@/components/eco/primitives'
import { ComplaintTimeline } from '@/components/complaints/complaint-timeline'
import { RoleSwitcher } from '@/components/layout/topbar'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { CITY_NAME, COMPLAINT_CATEGORIES, COMPLAINT_STATUS_META, TRACKED_COMPLAINTS_KEY } from '@/lib/constants'
import { formatDateTime } from '@/lib/logic'
import { useStore } from '@/lib/store'
import type { Complaint, ComplaintCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

const trackedListeners = new Set<() => void>()
function readTracked(): string {
  return window.localStorage.getItem(TRACKED_COMPLAINTS_KEY) ?? '[]'
}
function addTracked(id: string) {
  const ids: string[] = JSON.parse(readTracked())
  window.localStorage.setItem(TRACKED_COMPLAINTS_KEY, JSON.stringify([id, ...ids.filter((x) => x !== id)].slice(0, 20)))
  trackedListeners.forEach((l) => l())
}
function useTrackedIds(): string[] {
  const raw = useSyncExternalStore(
    (cb) => {
      trackedListeners.add(cb)
      return () => trackedListeners.delete(cb)
    },
    readTracked,
    () => '[]',
  )
  return JSON.parse(raw)
}

async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const scale = Math.min(1, 960 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.75)
  } finally {
    URL.revokeObjectURL(url)
  }
}

type Errors = Partial<Record<'citizenName' | 'contact' | 'description' | 'location' | 'address', string>>

function ComplaintForm({ onSubmitted }: { onSubmitted: (c: Complaint) => void }) {
  const { setDb, notify } = useStore()
  const [form, setForm] = useState({ citizenName: '', contact: '', category: COMPLAINT_CATEGORIES[0] as ComplaintCategory, description: '', address: '' })
  const [image, setImage] = useState<string | null>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [fly, setFly] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const onPick = useCallback((p: { lat: number; lng: number }) => setPos(p), [])

  const locate = () => {
    if (!navigator.geolocation) return notify({ tone: 'warning', title: 'Geolocation not supported', description: 'Tap the map to choose a location.' })
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }
        setPos(next)
        setFly({ ...next, key: Date.now() })
        setLocating(false)
      },
      () => {
        setLocating(false)
        notify({ tone: 'warning', title: 'Location unavailable', description: 'Permission denied or unavailable. Tap the map instead.' })
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (form.citizenName.trim().length < 2) errs.citizenName = 'Please enter your name.'
    if (!/^(\S+@\S+\.\S+|[+\d][\d\s-]{6,})$/.test(form.contact.trim())) errs.contact = 'Enter a valid phone number or email.'
    if (form.description.trim().length < 10) errs.description = 'Describe the issue in at least 10 characters.'
    if (!form.address.trim()) errs.address = 'Add a street or landmark.'
    if (!pos) errs.location = 'Pick the exact location on the map.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const { db, complaint } = await api.submitComplaint({
        citizenName: form.citizenName.trim(),
        contact: form.contact.trim(),
        category: form.category,
        description: form.description.trim(),
        address: form.address.trim(),
        image,
        latitude: pos!.lat,
        longitude: pos!.lng,
      })
      setDb(db)
      addTracked(complaint.id)
      onSubmitted(complaint)
      setForm({ citizenName: '', contact: '', category: COMPLAINT_CATEGORIES[0], description: '', address: '' })
      setImage(null)
      setPos(null)
    } catch (err) {
      notify({ tone: 'error', title: 'Submission failed', description: (err as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 p-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="c-name" error={errors.citizenName}>
            <Input id="c-name" autoComplete="name" value={form.citizenName} aria-invalid={!!errors.citizenName} onChange={(e) => setForm({ ...form, citizenName: e.target.value })} />
          </Field>
          <Field label="Phone or email" htmlFor="c-contact" error={errors.contact}>
            <Input id="c-contact" value={form.contact} aria-invalid={!!errors.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </Field>
        </div>
        <Field label="Issue category" htmlFor="c-cat">
          <Select id="c-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ComplaintCategory })}>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="c-desc" error={errors.description}>
          <Textarea
            id="c-desc"
            value={form.description}
            maxLength={600}
            aria-invalid={!!errors.description}
            placeholder="What did you see? How long has it been there?"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">Photo (optional)</span>
          {image ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Preview of attached photo" className="aspect-video w-full rounded-lg border object-cover" />
              <Button type="button" size="xs" variant="secondary" className="absolute top-2 right-2" onClick={() => setImage(null)}>
                <Trash2 /> Remove
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-6 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-within:border-primary">
              <Camera className="size-5" aria-hidden="true" />
              Upload or take a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 12 * 1024 * 1024) return notify({ tone: 'warning', title: 'Image too large', description: 'Choose a photo under 12 MB.' })
                  setImage(await compressImage(f))
                }}
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Exact location</span>
            <Button type="button" size="xs" variant="outline" onClick={locate} disabled={locating}>
              {locating ? <Spinner /> : <LocateFixed />} Use my location
            </Button>
          </div>
          <div className={cn('overflow-hidden rounded-lg border', errors.location && 'border-destructive')}>
            <LocationPickerMap value={pos} onChange={onPick} flyTarget={fly} className="h-72 w-full" />
          </div>
          <p className={cn('flex items-center gap-1 text-xs', errors.location ? 'text-destructive' : 'text-muted-foreground')} role={errors.location ? 'alert' : undefined}>
            <MapPin className="size-3" aria-hidden="true" />
            {errors.location ?? (pos ? `Pinned at ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} · drag to adjust` : 'Tap the map to drop a pin')}
          </p>
        </div>
        <Field label="Street / landmark" htmlFor="c-addr" error={errors.address}>
          <Input id="c-addr" value={form.address} aria-invalid={!!errors.address} placeholder="e.g. Near Riverside Market gate" onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Button type="submit" size="lg" disabled={submitting} className="mt-auto">
          {submitting ? <Spinner /> : <Send />} Submit complaint
        </Button>
      </div>
    </form>
  )
}

function TrackComplaint({ initialId }: { initialId?: string }) {
  const [id, setId] = useState(initialId ?? '')
  const [result, setResult] = useState<Complaint | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const { db } = useStore()
  const live = result ? (db?.complaints.find((c) => c.id === result.id) ?? result) : result

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!id.trim()) return
    setLoading(true)
    setResult(await api.fetchComplaintById(id))
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Complaint ID, e.g. CMP-10234" className="pl-8 uppercase" aria-label="Complaint ID" />
        </div>
        <Button type="submit" disabled={loading || !id.trim()}>
          {loading ? <Spinner /> : 'Track'}
        </Button>
      </form>
      {live === null && <EmptyState title="Complaint not found" description="Check the ID and try again." />}
      {live && (
        <div className="flex flex-col gap-4 rounded-lg border p-4 animate-in fade-in">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">{live.id}</p>
              <p className="font-medium">{live.category}</p>
              <p className="text-xs text-muted-foreground">
                {live.address} · {formatDateTime(live.createdAt)}
              </p>
            </div>
            <Badge className={COMPLAINT_STATUS_META[live.status].badge}>{COMPLAINT_STATUS_META[live.status].label}</Badge>
          </div>
          <ComplaintTimeline complaint={live} />
        </div>
      )}
    </div>
  )
}

export function CitizenPortal() {
  const { db, loading } = useStore()
  const trackedIds = useTrackedIds()
  const [submitted, setSubmitted] = useState<Complaint | null>(null)
  const [tab, setTab] = useState<'report' | 'track'>('report')
  const mine = trackedIds.map((id) => db?.complaints.find((c) => c.id === id)).filter(Boolean) as Complaint[]

  return (
    <div className="min-h-dvh">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Logo />
          <div className="rounded-lg bg-white">
            <RoleSwitcher compact />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-16 md:px-6">
          <p className="text-xs font-medium tracking-wider text-teal-300 uppercase">{CITY_NAME} Citizen Portal</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">Help keep {CITY_NAME} clean.</h1>
          <p className="mt-2 max-w-xl text-sm text-white/70 text-pretty">
            Report overflowing bins, illegal dumping or missed collections. Pin the exact location and track your complaint until it&apos;s resolved.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-10 flex max-w-6xl flex-col gap-6 px-4 pb-12 md:px-6">
        {submitted && (
          <Card className="flex flex-wrap items-center gap-4 border-status-normal/40 p-5 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="size-8 text-status-normal" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold">Complaint submitted</p>
              <p className="text-sm text-muted-foreground">
                Your reference ID is <strong className="font-mono text-foreground">{submitted.id}</strong>. Save it to track progress.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(submitted.id)}>
              <Copy /> Copy ID
            </Button>
            <Button size="sm" onClick={() => setTab('track')}>
              Track status
            </Button>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div role="tablist" aria-label="Citizen actions" className="flex border-b">
            {(
              [
                ['report', 'Report an issue', Send],
                ['track', 'Track a complaint', Search],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors',
                  tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          {loading || !db ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="size-6 text-muted-foreground" />
            </div>
          ) : tab === 'report' ? (
            <ComplaintForm onSubmitted={setSubmitted} />
          ) : (
            <TrackComplaint key={submitted?.id} initialId={submitted?.id} />
          )}
        </Card>

        <Card>
          <CardHeader icon={ClipboardList} title="My complaints" description="Reports submitted from this device" />
          {mine.length === 0 ? (
            <EmptyState title="No complaints yet" description="Complaints you submit will appear here." />
          ) : (
            <ul className="divide-y">
              {mine.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{c.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.id} · {formatDateTime(c.createdAt)}
                    </p>
                  </div>
                  <Badge className={COMPLAINT_STATUS_META[c.status].badge}>{COMPLAINT_STATUS_META[c.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  )
}
