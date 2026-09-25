type IconProps = {
  className?: string
}

export function HeartIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BuildingIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V8l8-4 8 4v12H4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function UsersIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 19a5.5 5.5 0 0 1 11 0"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 19a4.5 4.5 0 0 1 5-4.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function StarIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 3 2.4 5.5 6 .6-4.5 4 1.3 5.9L12 16.5 6.8 19l1.3-5.9-4.5-4 6-.6L12 3Z" />
    </svg>
  )
}

export function WhatsAppIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.5 2 2.03 6.45 2.03 12c0 1.77.46 3.45 1.28 4.9L2 22l5.25-1.27A9.96 9.96 0 0 0 12.04 22C17.57 22 22 17.55 22 12S17.57 2 12.04 2Zm5.8 14.21c-.24.68-1.4 1.26-1.94 1.34-.5.07-1.12.1-1.82-.11-.42-.13-.97-.32-1.67-.62-2.94-1.27-4.85-4.23-5-4.42-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.4.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.32.02.5-.1.2-.15.32-.3.5-.14.16-.3.37-.43.5-.14.14-.29.29-.12.56.16.27.73 1.2 1.56 1.95 1.08.96 1.98 1.26 2.26 1.4.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.24.08 1.54.73 1.8.86.27.14.44.2.5.3.07.12.07.68-.17 1.36Z" />
    </svg>
  )
}

export function MenuIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function CloseIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function ChevronIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function InstagramIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function FacebookIcon({ className = 'icon' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1Z" />
    </svg>
  )
}
