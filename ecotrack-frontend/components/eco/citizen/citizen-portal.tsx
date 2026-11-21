'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Copy, ImagePlus, Loader2, Search, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import { CITY_NAME, COMPLAINT_CATEGORIES, generateComplaintId } from '@/lib/domain'
import { AREAS } from '@/lib/mock-data'
import type { Complaint, ComplaintCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Field, Input, Segmented, Select, Textarea } from '../primitives'
import { ComplaintStatusBadge } from '../badges'
import { ComplaintProgress, ComplaintTimeline } from '../complaints/complaint-timeline'
import { Logo } from '../logo'

type FormState = {
  name: string
  contact: string
  category: ComplaintCategory | ''
  area: string
  address: string
  description: string
}

const EMPTY: FormState = { name: '', contact: '', category: '', area: '', address: '', description: '' }

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (f.name.trim().length < 2) e.name = 'Please enter your name.'
  const contact = f.contact.trim()
  if (!/^\S+@\S+\.\S+$/.test(contact) && !/^\+?[\d\s-]{7,15}$/.test(contact)) e.contact = 'Enter a valid phone number or email.'
  if (!f.category) e.category = 'Choose a category.'
  if (!f.area) e.area = 'Choose your area.'
  if (f.address.trim().length < 4) e.address = 'Enter a street or landmark.'
  if (f.description.trim().length < 15) e.description = 'Describe the issue in at least 15 characters.'
  return e
}

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const scale = Math.min(1, 720 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function ReportForm({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const { state, submitComplaint } = useStore()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [touched, setTouched] = useState(false)
  const [image, setImage] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const errors = touched ? validate(form) : {}
  const update = (k: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file.')
    if (file.size > 8 * 1024 * 1024) return toast.error('Image must be under 8 MB.')
    try {
      setImage(await resizeImage(file))
    } catch {
      toast.error('Could not read that image.')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(validate(form)).length) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 700))
    const area = AREAS.find((a) => a.name === form.area) ?? AREAS[0]
    const now = new Date().toISOString()
    const id = generateComplaintId(state.complaints.map((c) => c.id))
    const complaint: Complaint = {
      id,
      name: form.name.trim(),
      contact: form.contact.trim(),
      category: form.category as ComplaintCategory,
      description: form.description.trim(),
      area: area.name,
      address: form.address.trim(),
      lat: area.lat + (Math.random() - 0.5) * 0.008,
      lng: area.lng + (Math.random() - 0.5) * 0.008,
      image,
      status: 'Submitted',
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'Submitted', at: now, note: 'Complaint received via citizen portal.' }],
    }
    try {
      submitComplaint(complaint)
      setForm(EMPTY)
      setImage(undefined)
      setTouched(false)
      onSubmitted(id)
    } catch {
      toast.error('Could not save your complaint. Try removing the photo and submit again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 p-5 pt-4 sm:grid-cols-2">
      <Field label="Your name" htmlFor="f-name" error={errors.name}>
        <Input id="f-name" autoComplete="name" value={form.name} onChange={update('name')} aria-invalid={!!errors.name} />
      </Field>
      <Field label="Phone or email" htmlFor="f-contact" error={errors.contact} hint="Used only for updates on this complaint.">
        <Input id="f-contact" autoComplete="email" value={form.contact} onChange={update('contact')} aria-invalid={!!errors.contact} />
      </Field>
      <Field label="Category" htmlFor="f-category" error={errors.category}>
        <Select id="f-category" value={form.category} onChange={update('category')} aria-invalid={!!errors.category}>
          <option value="" disabled>
            Select an issue
          </option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Area" htmlFor="f-area" error={errors.area}>
        <Select id="f-area" value={form.area} onChange={update('area')} aria-invalid={!!errors.area}>
          <option value="" disabled>
            Select your neighbourhood
          </option>
          {AREAS.map((a) => (
            <option key={a.id}>{a.name}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Street address or landmark" htmlFor="f-address" error={errors.address}>
          <Input id="f-address" autoComplete="street-address" value={form.address} onChange={update('address')} aria-invalid={!!errors.address} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description" htmlFor="f-desc" error={errors.description} hint={`${form.description.length}/500`}>
          <Textarea id="f-desc" rows={4} maxLength={500} value={form.description} onChange={update('description')} aria-invalid={!!errors.description} placeholder="What's the problem and how long has it been happening?" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-medium">Photo (optional)</p>
        {image ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Preview of attached photo" className="h-32 rounded-lg border object-cover" />
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background"
              aria-label="Remove photo"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files[0])
            }}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5"
          >
            <ImagePlus className="size-5" aria-hidden />
            Click or drop an image (max 8 MB)
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {submitting ? 'Submitting…' : 'Submit complaint'}
        </Button>
      </div>
    </form>
  )
}

function TrackPanel({ initialId }: { initialId: string }) {
  const { state } = useStore()
  const [query, setQuery] = useState(initialId)
  const [searched, setSearched] = useState(initialId)
  const found = state.complaints.find((c) => c.id.toLowerCase() === searched.trim().toLowerCase())

  return (
    <div className="flex flex-col gap-5 p-5 pt-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSearched(query)
        }}
      >
        <label htmlFor="track-id" className="sr-only">
          Complaint ID
        </label>
        <Input id="track-id" placeholder="e.g. CMP-2026-48213" value={query} onChange={(e) => setQuery(e.target.value)} className="font-mono" />
        <Button type="submit">
          <Search className="size-4" aria-hidden /> Track
        </Button>
      </form>

      {searched && !found && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground" role="status">
          No complaint found with ID <span className="font-mono">{searched}</span>. Check the ID and try again.
        </p>
      )}

      {found && (
        <div className="flex flex-col gap-5 animate-in fade-in" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold">{found.id}</p>
              <p className="text-sm">{found.category}</p>
              <p className="text-xs text-muted-foreground">
                {found.address}, {found.area}
              </p>
            </div>
            <ComplaintStatusBadge status={found.status} />
          </div>
          <ComplaintProgress complaint={found} />
          {found.assignedTo && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm">
              Assigned to <span className="font-medium">{found.assignedTo}</span>
            </p>
          )}
          <ComplaintTimeline complaint={found} />
        </div>
      )}
    </div>
  )
}

export function CitizenPortal() {
  const [tab, setTab] = useState<'report' | 'track'>('report')
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [trackId, setTrackId] = useState('')

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Admin dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div>
          <p className="text-sm font-medium text-primary">{CITY_NAME} Citizen Portal</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">Help keep your neighbourhood clean</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">
            Report overflowing bins, missed pickups or illegal dumping. Every report gets a tracking ID so you can follow its progress.
          </p>
        </div>

        {submittedId && (
          <Card className="flex flex-col gap-4 border-success/40 bg-success/5 p-5 sm:flex-row sm:items-center animate-in fade-in slide-in-from-top-2" role="status">
            <CheckCircle2 className="size-8 shrink-0 text-success" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Complaint submitted</p>
              <p className="text-sm text-muted-foreground">
                Your tracking ID is <span className="font-mono font-semibold text-foreground">{submittedId}</span>. Save it to check the status later.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(submittedId)
                  toast.success('Tracking ID copied')
                }}
              >
                <Copy className="size-3.5" aria-hidden /> Copy
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setTrackId(submittedId)
                  setTab('track')
                }}
              >
                Track status
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <CardHeader
            title={tab === 'report' ? 'Report an issue' : 'Track a complaint'}
            description={tab === 'report' ? 'All fields except the photo are required.' : 'Enter the ID you received when submitting.'}
            action={
              <Segmented
                label="Portal section"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'report', label: 'Report' },
                  { value: 'track', label: 'Track' },
                ]}
              />
            }
          />
          {tab === 'report' ? <ReportForm onSubmitted={setSubmittedId} /> : <TrackPanel key={trackId} initialId={trackId} />}
        </Card>
      </main>
    </div>
  )
}
