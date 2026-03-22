interface IconProps {
  className?: string
}

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function ZomatoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#E23744"/>
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Z</text>
    </svg>
  )
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/>
    </svg>
  )
}

const PLATFORM_ICONS: Record<string, React.ComponentType<IconProps>> = {
  google: GoogleIcon,
  gbp: GoogleIcon,
  zomato: ZomatoIcon,
  facebook: FacebookIcon,
}

interface PlatformIconBadgeProps {
  platform: string
  size?: number
}

export function PlatformIconBadge({ platform, size = 32 }: PlatformIconBadgeProps) {
  const Icon = PLATFORM_ICONS[platform.toLowerCase()]
  if (!Icon) return null
  return <Icon className="shrink-0" style={{ width: size, height: size }} />
}

export function PlatformIconRow({ platforms }: { platforms: string[] }) {
  const unique = [...new Set(platforms.map((p) => p.toLowerCase()))]
  if (unique.length === 0) {
    return <span className="text-xs text-muted-foreground">No platforms connected</span>
  }
  return (
    <div className="flex items-center gap-2.5">
      {unique.map((p) => (
        <PlatformIconBadge key={p} platform={p} size={32} />
      ))}
    </div>
  )
}
