'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarDays, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params.slug as string

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [booked, setBooked] = useState(false)

  // Note: In production, you'd resolve the slug to a workspaceId/locationId
  // For now this is a placeholder that shows the UI structure

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-bold text-2xl">R</span>
          </div>
          <h1 className="text-3xl font-bold">Book an Appointment</h1>
          <p className="text-muted-foreground mt-2">
            Choose a convenient time for your visit
          </p>
        </div>

        {booked ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle2 className="size-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Appointment Booked!</h2>
              <p className="text-muted-foreground">
                You'll receive a confirmation email shortly.
              </p>
              {selectedSlot && (
                <p className="mt-4 text-lg font-medium">
                  {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')} at{' '}
                  {format(selectedSlot.start, 'h:mm a')}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Date picker */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-5" />
                  Select a Date
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date)
                    setSelectedSlot(null)
                  }}
                  disabled={{ before: new Date() }}
                />
              </CardContent>
            </Card>

            {/* Time slots */}
            {selectedDate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="size-5" />
                    Available Times — {format(selectedDate, 'EEEE, MMM d')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* Generate 30-min slots from 9 AM to 6 PM */}
                    {Array.from({ length: 18 }).map((_, i) => {
                      const hour = 9 + Math.floor(i / 2)
                      const minute = (i % 2) * 30
                      const start = new Date(selectedDate)
                      start.setHours(hour, minute, 0, 0)
                      const end = new Date(start)
                      end.setMinutes(end.getMinutes() + 30)
                      const isPast = start < new Date()
                      const isSelected = selectedSlot?.start.getTime() === start.getTime()

                      return (
                        <Button
                          key={i}
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          disabled={isPast}
                          onClick={() => setSelectedSlot({ start, end })}
                          className="text-xs"
                        >
                          {format(start, 'h:mm a')}
                        </Button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customer info */}
            {selectedSlot && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Your full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4 text-sm">
                    <p className="font-medium">
                      {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-muted-foreground">
                      {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!customerName.trim()}
                    onClick={() => {
                      // In production, this would call trpc.appointment.publicBook
                      toast.success('Appointment booked!')
                      setBooked(true)
                    }}
                  >
                    Book Appointment
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by Rectangled.io
        </p>
      </div>
    </div>
  )
}
