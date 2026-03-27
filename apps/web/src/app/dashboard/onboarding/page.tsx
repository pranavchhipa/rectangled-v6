'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingBag,
  UtensilsCrossed,
  Package,
  Building2,
  Heart,
  Car,
  Hotel,
  Scissors,
  GraduationCap,
  Briefcase,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Sparkles,
  Rocket,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

const INDUSTRY_OPTIONS = [
  { value: 'retail', label: 'Retail', icon: ShoppingBag },
  { value: 'f&b', label: 'Food & Beverage', icon: UtensilsCrossed },
  { value: 'd2c', label: 'Direct to Consumer', icon: Package },
  { value: 'smb', label: 'Small & Medium Business', icon: Building2 },
  { value: 'healthcare', label: 'Healthcare', icon: Heart },
  { value: 'automotive', label: 'Automotive', icon: Car },
  { value: 'hospitality', label: 'Hospitality', icon: Hotel },
  { value: 'salon_spa', label: 'Salon & Spa', icon: Scissors },
  { value: 'education', label: 'Education', icon: GraduationCap },
  { value: 'professional_services', label: 'Professional Services', icon: Briefcase },
  { value: 'other', label: 'Other', icon: HelpCircle },
] as const

const TOTAL_STEPS = 3

export default function OnboardingPage() {
  const router = useRouter()
  const { currentWorkspaceId } = useAuthStore()
  const utils = trpc.useUtils()

  const [step, setStep] = useState(1)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)
  const [newAspectName, setNewAspectName] = useState('')
  const [seeded, setSeeded] = useState(false)

  // Queries
  const onboardingQuery = trpc.onboarding.getState.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId }
  )

  const aspectsQuery = trpc.businessAspect.list.useQuery(
    { workspaceId: currentWorkspaceId! },
    { enabled: !!currentWorkspaceId && step >= 2 }
  )

  // Mutations
  const updateStep = trpc.onboarding.updateStep.useMutation()

  const seedDefaults = trpc.businessAspect.seedDefaults.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      setSeeded(true)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to seed default aspects')
    },
  })

  const createAspect = trpc.businessAspect.create.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      setNewAspectName('')
      toast.success('Aspect added')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create aspect')
    },
  })

  const updateAspect = trpc.businessAspect.update.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
    },
  })

  const deleteAspect = trpc.businessAspect.delete.useMutation({
    onSuccess: () => {
      utils.businessAspect.list.invalidate()
      toast.success('Aspect removed')
    },
  })

  const completeOnboarding = trpc.onboarding.complete.useMutation({
    onSuccess: async () => {
      toast.success('Onboarding complete! Welcome aboard.')
      await utils.onboarding.getState.invalidate()
      router.replace('/dashboard')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to complete onboarding')
    },
  })

  // Restore step from server state
  useEffect(() => {
    if (onboardingQuery.data) {
      if (onboardingQuery.data.isComplete) {
        router.replace('/dashboard')
        return
      }
      const serverStep = onboardingQuery.data.currentStep
      if (serverStep > 0 && serverStep <= TOTAL_STEPS) {
        setStep(serverStep)
      }
    }
  }, [onboardingQuery.data, router])

  const progressPercent = (step / TOTAL_STEPS) * 100
  const aspects = aspectsQuery.data ?? []

  function handleSelectIndustry(industry: string) {
    setSelectedIndustry(industry)
  }

  async function handleNext() {
    if (step === 1) {
      if (!selectedIndustry) {
        toast.error('Please select your industry')
        return
      }
      // Seed aspects for the selected industry
      if (!seeded && currentWorkspaceId) {
        seedDefaults.mutate({
          workspaceId: currentWorkspaceId,
          industry: selectedIndustry,
        })
      }
      const nextStep = 2
      if (currentWorkspaceId) {
        updateStep.mutate({ workspaceId: currentWorkspaceId, step: nextStep })
      }
      setStep(nextStep)
    } else if (step === 2) {
      const nextStep = 3
      if (currentWorkspaceId) {
        updateStep.mutate({ workspaceId: currentWorkspaceId, step: nextStep })
      }
      setStep(nextStep)
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  function handleAddAspect() {
    if (!newAspectName.trim() || !currentWorkspaceId) return
    createAspect.mutate({
      workspaceId: currentWorkspaceId,
      name: newAspectName.trim(),
    })
  }

  function handleToggleAspect(id: string, isActive: boolean) {
    updateAspect.mutate({ id, isActive: !isActive })
  }

  function handleDeleteAspect(id: string) {
    deleteAspect.mutate({ id })
  }

  function handleComplete() {
    if (!currentWorkspaceId) return
    completeOnboarding.mutate({ workspaceId: currentWorkspaceId })
  }

  if (onboardingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Step 1: Industry Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Welcome to Rectangled</h1>
            <p className="text-muted-foreground">
              Let's set up your workspace. Start by selecting your industry so we can
              configure the right review aspects for your business.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {INDUSTRY_OPTIONS.map((industry) => {
              const Icon = industry.icon
              const isSelected = selectedIndustry === industry.value
              return (
                <Card
                  key={industry.value}
                  className={`cursor-pointer p-4 transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectIndustry(industry.value)}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium">{industry.label}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Business Aspects Configuration */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Configure Business Aspects</h1>
            <p className="text-muted-foreground">
              These are the aspects of your business that reviews will be analyzed against.
              You can add, remove, or toggle aspects as needed.
            </p>
          </div>

          {seedDefaults.isPending || aspectsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Add new aspect */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a new aspect..."
                  value={newAspectName}
                  onChange={(e) => setNewAspectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddAspect()
                  }}
                />
                <Button
                  onClick={handleAddAspect}
                  disabled={!newAspectName.trim() || createAspect.isPending}
                  size="icon"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Aspects list */}
              <div className="space-y-2">
                {aspects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-12">
                    <p className="text-sm text-muted-foreground">
                      No aspects configured yet. Add some above.
                    </p>
                  </div>
                ) : (
                  aspects.map((aspect) => (
                    <div
                      key={aspect.id}
                      className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={aspect.isActive}
                          onCheckedChange={() =>
                            handleToggleAspect(aspect.id, aspect.isActive)
                          }
                        />
                        <span
                          className={`text-sm font-medium ${
                            !aspect.isActive ? 'text-muted-foreground line-through' : ''
                          }`}
                        >
                          {aspect.name}
                        </span>
                        {aspect.category && (
                          <Badge variant="secondary" className="text-xs">
                            {aspect.category}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteAspect(aspect.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {aspects.filter((a) => a.isActive).length} of {aspects.length} aspects active
              </p>
            </>
          )}
        </div>
      )}

      {/* Step 3: Completion */}
      {step === 3 && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Rocket className="h-8 w-8 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">You're all set!</h1>
            <p className="text-muted-foreground">
              Your workspace is configured and ready to go. You can always adjust your
              business aspects later from Settings.
            </p>
          </div>

          <Separator />

          <div className="mx-auto max-w-sm space-y-3 text-left">
            <h3 className="font-semibold text-sm">Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Industry</span>
                <Badge variant="outline">
                  {INDUSTRY_OPTIONS.find((i) => i.value === selectedIndustry)?.label ??
                    selectedIndustry}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Business aspects</span>
                <Badge variant="outline">
                  {aspects.filter((a) => a.isActive).length} active
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} disabled={step === 1 && !selectedIndustry}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={completeOnboarding.isPending}
          >
            {completeOnboarding.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Get Started
          </Button>
        )}
      </div>
    </div>
  )
}
