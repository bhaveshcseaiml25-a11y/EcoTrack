'use client'

import { useState } from 'react'
import { Bell, Gauge, Monitor, Moon, RotateCcw, Save, Sun, User, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import type { Settings, ThemePreference } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, Field, Input, PageHeader, Switch } from '../primitives'

function validate(s: Settings) {
  const errors: Record<string, string> = {}
  if (!s.profile.name.trim()) errors.name = 'Name is required.'
  if (!/^\S+@\S+\.\S+$/.test(s.profile.email)) errors.email = 'Enter a valid email address.'
  const t = s.thresholds
  if (!(t.warning < t.high && t.high < t.critical)) errors.thresholds = 'Thresholds must increase: warning < high < critical.'
  if (t.critical > 100 || t.warning < 1) errors.thresholds = 'Thresholds must be between 1% and 100%.'
  if (t.collection < 1 || t.collection > 100) errors.collection = 'Collection threshold must be between 1% and 100%.'
  if (s.system.simulationIntervalSec < 3 || s.system.simulationIntervalSec > 120) errors.interval = 'Use an interval between 3 and 120 seconds.'
  return errors
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsView() {
  const { state, updateSettings, resetDemo } = useStore()
  const [draft, setDraft] = useState<Settings>(state.settings)
  const errors = validate(draft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings)

  const set = <K extends keyof Settings>(key: K, patch: Partial<Settings[K]>) =>
    setDraft((d) => ({ ...d, [key]: { ...(d[key] as object), ...patch } }))

  function save() {
    if (Object.keys(errors).length) {
      toast.error('Please fix the highlighted fields')
      return
    }
    updateSettings(draft)
    toast.success('Settings saved')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, alert thresholds, notification preferences and system behaviour."
        actions={
          <>
            <Button variant="outline" onClick={() => setDraft(state.settings)} disabled={!dirty}>
              Discard
            </Button>
            <Button onClick={save} disabled={!dirty}>
              <Save className="size-4" aria-hidden /> Save changes
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={User} title="Profile" description="Shown on reports and activity entries" />
          <div className="grid gap-4 p-5 pt-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="s-name" error={errors.name}>
              <Input id="s-name" value={draft.profile.name} onChange={(e) => set('profile', { name: e.target.value })} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Email" htmlFor="s-email" error={errors.email}>
              <Input id="s-email" type="email" value={draft.profile.email} onChange={(e) => set('profile', { email: e.target.value })} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Phone" htmlFor="s-phone">
              <Input id="s-phone" type="tel" value={draft.profile.phone} onChange={(e) => set('profile', { phone: e.target.value })} />
            </Field>
            <Field label="Role" htmlFor="s-role">
              <Input id="s-role" value={draft.profile.role} onChange={(e) => set('profile', { role: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Department" htmlFor="s-dept">
                <Input id="s-dept" value={draft.profile.department} onChange={(e) => set('profile', { department: e.target.value })} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Gauge} title="Alert thresholds" description="Fill levels that trigger each alert severity" />
          <div className="flex flex-col gap-4 p-5 pt-4">
            <div className="grid grid-cols-3 gap-3">
              {(['warning', 'high', 'critical'] as const).map((k) => (
                <Field key={k} label={k === 'high' ? 'High priority' : k[0].toUpperCase() + k.slice(1)} htmlFor={`t-${k}`}>
                  <div className="relative">
                    <Input
                      id={`t-${k}`}
                      type="number"
                      min={1}
                      max={100}
                      value={draft.thresholds[k]}
                      onChange={(e) => set('thresholds', { [k]: Number(e.target.value) })}
                      aria-invalid={!!errors.thresholds}
                      className="pr-8"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </Field>
              ))}
            </div>
            {errors.thresholds && (
              <p className="text-xs text-destructive" role="alert">
                {errors.thresholds}
              </p>
            )}
            <Field label="Collection threshold" htmlFor="t-collection" hint="Bins at or above this level are included in route optimization." error={errors.collection}>
              <Input
                id="t-collection"
                type="number"
                min={1}
                max={100}
                value={draft.thresholds.collection}
                onChange={(e) => set('thresholds', { collection: Number(e.target.value) })}
                aria-invalid={!!errors.collection}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Bell} title="Notifications" />
          <div className="flex flex-col gap-5 p-5 pt-4">
            <Switch label="In-app notifications" description="Show alerts in the notification centre" checked={draft.notifications.inApp} onCheckedChange={(v) => set('notifications', { inApp: v })} />
            <Switch label="Toast pop-ups" description="Display a pop-up when a new alert is raised" checked={draft.notifications.toasts} onCheckedChange={(v) => set('notifications', { toasts: v })} />
            <Switch label="Critical alerts only" description="Only pop up for critical severity" checked={draft.notifications.criticalOnly} onCheckedChange={(v) => set('notifications', { criticalOnly: v })} />
            <Switch label="Daily digest" description="Summary of the previous day each morning" checked={draft.notifications.dailyDigest} onCheckedChange={(v) => set('notifications', { dailyDigest: v })} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={Wrench} title="System & appearance" />
          <div className="flex flex-col gap-5 p-5 pt-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Theme</legend>
              <div className="grid grid-cols-3 gap-2">
                {THEMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draft.theme === value}
                    onClick={() => setDraft((d) => ({ ...d, theme: value }))}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted',
                      draft.theme === value && 'border-primary bg-primary/5 text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <Switch
              label="Live sensor simulation"
              description="Periodically generate simulated fill-level readings"
              checked={draft.system.autoSimulate}
              onCheckedChange={(v) => set('system', { autoSimulate: v })}
            />
            <Field label="Simulation interval (seconds)" htmlFor="s-interval" error={errors.interval}>
              <Input
                id="s-interval"
                type="number"
                min={3}
                max={120}
                value={draft.system.simulationIntervalSec}
                onChange={(e) => set('system', { simulationIntervalSec: Number(e.target.value) })}
                disabled={!draft.system.autoSimulate}
                aria-invalid={!!errors.interval}
              />
            </Field>
            <Switch label="Auto-fit maps" description="Zoom maps to fit visible markers" checked={draft.system.mapAutoFit} onCheckedChange={(v) => set('system', { mapAutoFit: v })} />
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 border-destructive/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Reset demo data</p>
          <p className="text-xs text-muted-foreground">Restore all bins, alerts, complaints, routes and settings to their initial state.</p>
        </div>
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            if (!window.confirm('Reset all demo data? This cannot be undone.')) return
            resetDemo()
            setDraft(state.settings)
            toast.success('Demo data reset')
            setTimeout(() => window.location.reload(), 300)
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reset data
        </Button>
      </Card>
    </div>
  )
}
