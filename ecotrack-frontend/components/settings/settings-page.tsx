'use client'

import { useState } from 'react'
import { Bell, Gauge, Plus, RotateCcw, Save, Tags, UserRound, X } from 'lucide-react'
import { Card, CardHeader, Field, Input, PageHeader, Select, Toggle } from '@/components/eco/primitives'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useStore } from '@/lib/store'
import type { Settings } from '@/lib/types'

export function SettingsPage() {
  const { db, run, busy } = useStore()
  const [draft, setDraft] = useState<Settings | null>(db?.settings ?? null)
  const [newCat, setNewCat] = useState('')
  if (!db || !draft) return null

  const th = draft.thresholds
  const thresholdError =
    !(th.warning < th.high && th.high < th.critical) ? 'Thresholds must increase: warning < high < critical.' : th.warning < 1 || th.critical > 100 ? 'Use values between 1 and 100.' : ''
  const emailError = /^\S+@\S+\.\S+$/.test(draft.adminEmail) ? '' : 'Enter a valid email address.'
  const dirty = JSON.stringify(draft) !== JSON.stringify(db.settings)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = () =>
    run('settings', () => api.updateSettings(draft), { tone: 'success', title: 'Settings saved', description: 'New thresholds apply to the next sensor readings.' })

  const addCategory = () => {
    const c = newCat.trim()
    if (!c || draft.wasteCategories.some((x) => x.toLowerCase() === c.toLowerCase())) return
    set('wasteCategories', [...draft.wasteCategories, c])
    setNewCat('')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configure administrator profile, alert thresholds, waste categories and simulation preferences."
        actions={
          <>
            <Button variant="outline" disabled={!dirty} onClick={() => setDraft(db.settings)}>
              <RotateCcw /> Discard
            </Button>
            <Button disabled={!dirty || !!thresholdError || !!emailError || busy === 'settings'} onClick={save}>
              <Save /> Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={UserRound} title="Administrator profile" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="s-name">
              <Input id="s-name" value={draft.adminName} onChange={(e) => set('adminName', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="s-email" error={emailError}>
              <Input id="s-email" type="email" value={draft.adminEmail} aria-invalid={!!emailError} onChange={(e) => set('adminEmail', e.target.value)} />
            </Field>
            <Field label="Department" htmlFor="s-dept" className="sm:col-span-2">
              <Input id="s-dept" value={draft.department} onChange={(e) => set('department', e.target.value)} />
            </Field>
            <Field label="Theme" htmlFor="s-theme">
              <Select id="s-theme" value={draft.theme} onChange={(e) => set('theme', e.target.value as Settings['theme'])}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Gauge} title="Alert thresholds" description="Fill level (%) at which each alert tier is raised." />
          <div className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-3 gap-3">
              {(['warning', 'high', 'critical'] as const).map((k) => (
                <Field key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`t-${k}`}>
                  <Input
                    id={`t-${k}`}
                    type="number"
                    min={1}
                    max={100}
                    value={th[k]}
                    aria-invalid={!!thresholdError}
                    onChange={(e) => set('thresholds', { ...th, [k]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-status-normal" aria-hidden="true">
              <div className="absolute inset-y-0 bg-status-moderate" style={{ left: `${th.warning}%`, right: 0 }} />
              <div className="absolute inset-y-0 bg-status-high" style={{ left: `${th.high}%`, right: 0 }} />
              <div className="absolute inset-y-0 bg-status-critical" style={{ left: `${th.critical}%`, right: 0 }} />
            </div>
            {thresholdError && (
              <p className="text-xs text-destructive" role="alert">
                {thresholdError}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Tags} title="Waste categories" description="Available categories for smart bins." />
          <div className="flex flex-col gap-3 p-5">
            <ul className="flex flex-wrap gap-2">
              {draft.wasteCategories.map((c) => {
                const inUse = db.bins.some((b) => b.wasteCategory === c)
                return (
                  <li key={c} className="flex items-center gap-1 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-xs font-medium">
                    {c}
                    <button
                      type="button"
                      disabled={inUse}
                      title={inUse ? 'In use by bins' : `Remove ${c}`}
                      onClick={() => set('wasteCategories', draft.wasteCategories.filter((x) => x !== c))}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                      aria-label={`Remove ${c}`}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-2">
              <Input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) addCategory()
                }}
                placeholder="New category, e.g. E-waste"
                aria-label="New waste category"
              />
              <Button variant="outline" onClick={addCategory} disabled={!newCat.trim()}>
                <Plus /> Add
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Bell} title="Notifications & simulation" />
          <ul className="divide-y">
            {(
              [
                ['inApp', 'In-app notifications', 'Show alerts in the notification menu'],
                ['criticalOnly', 'Critical alerts only', 'Hide warning-level alerts from notifications'],
                ['complaintUpdates', 'Complaint updates', 'Notify on new citizen complaints'],
                ['dailyDigest', 'Daily digest', 'Simulated end-of-day summary'],
              ] as const
            ).map(([k, label, desc]) => (
              <li key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Toggle label={label} checked={draft.notifications[k]} onChange={(v) => set('notifications', { ...draft.notifications, [k]: v })} />
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-medium">Auto-simulate sensors</p>
                <p className="text-xs text-muted-foreground">Periodically generate new bin readings</p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={draft.simulationIntervalSec}
                  onChange={(e) => set('simulationIntervalSec', Number(e.target.value))}
                  className="w-20"
                  aria-label="Simulation interval"
                  disabled={!draft.autoSimulate}
                >
                  {[5, 8, 15, 30].map((n) => (
                    <option key={n} value={n}>
                      {n}s
                    </option>
                  ))}
                </Select>
                <Toggle label="Auto-simulate sensors" checked={draft.autoSimulate} onChange={(v) => set('autoSimulate', v)} />
              </div>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
