'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (accessToken) {
      router.replace('/dashboard')
    }
  }, [accessToken, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="text-center space-y-6">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">R</span>
          </div>
        </div>
        <h1 className="text-5xl font-bold text-foreground">OptimizerV6</h1>
        <p className="text-xl text-primary font-medium">
          rectangled.io — AI-Native ORM Platform
        </p>
        <p className="text-muted-foreground max-w-md mx-auto">
          Set it once, forget it forever. Your reputation runs on autopilot.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button asChild size="lg">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
