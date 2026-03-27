'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

type PresetKey = 'today' | '7d' | '14d' | '30d' | '90d' | 'all'

interface DateRangePickerProps {
  dateRange: { from?: Date; to?: Date }
  onDateRangeChange: (range: { from?: Date; to?: Date }) => void
  presets?: PresetKey[]
  className?: string
}

const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Today',
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
}

function getPresetRange(key: PresetKey): { from?: Date; to?: Date } {
  const now = new Date()
  switch (key) {
    case 'today':
      return { from: new Date(new Date().setHours(0, 0, 0, 0)), to: now }
    case '7d':
      return { from: new Date(Date.now() - 7 * 86400000), to: now }
    case '14d':
      return { from: new Date(Date.now() - 14 * 86400000), to: now }
    case '30d':
      return { from: new Date(Date.now() - 30 * 86400000), to: now }
    case '90d':
      return { from: new Date(Date.now() - 90 * 86400000), to: now }
    case 'all':
      return { from: undefined, to: undefined }
  }
}

export function DateRangePicker({ dateRange, onDateRangeChange, presets = ['7d', '14d', '30d', '90d', 'all'], className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)

  const handlePreset = (key: PresetKey) => {
    onDateRangeChange(getPresetRange(key))
    setOpen(false)
  }

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onDateRangeChange({ from: range?.from, to: range?.to })
  }

  const displayText =
    dateRange.from && dateRange.to
      ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
      : dateRange.from
        ? `${format(dateRange.from, 'MMM d, yyyy')} -`
        : 'All time'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-9 justify-start text-left text-sm font-normal ${className ?? ''}`}>
          <CalendarIcon className="mr-2 size-3.5" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            {presets.map((key) => (
              <Button key={key} variant="ghost" size="sm" className="justify-start" onClick={() => handlePreset(key)}>
                {PRESET_LABELS[key]}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
