import { BIN_STATUS_META, COMPLAINT_STATUS_META, getBinStatus, SEVERITY_META, VEHICLE_STATUS_META } from '@/lib/domain'
import type { AlertSeverity, ComplaintStatus, VehicleStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Pill } from './primitives'

export function BinStatusBadge({ fillLevel, className }: { fillLevel: number; className?: string }) {
  const meta = BIN_STATUS_META[getBinStatus(fillLevel)]
  return (
    <Pill className={cn(meta.bg, meta.text, className)} dot={meta.color}>
      {meta.label}
    </Pill>
  )
}

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const meta = SEVERITY_META[severity]
  return (
    <Pill className={cn(meta.bg, meta.text)} dot={meta.dot}>
      {meta.label}
    </Pill>
  )
}

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = COMPLAINT_STATUS_META[status]
  return <Pill className={cn(meta.bg, meta.text)}>{status}</Pill>
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const meta = VEHICLE_STATUS_META[status]
  return <Pill className={cn(meta.bg, meta.text)}>{meta.label}</Pill>
}
