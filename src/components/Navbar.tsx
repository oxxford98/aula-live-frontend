import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, LogOut, User } from "lucide-react"

const navItems = [
  { href: "#inicio", label: "Inicio" },
  { href: "#caracteristicas", label: "Caracteristicas" },
  { href: "#accesibilidad", label: "Accesibilidad" },
  { href: "#contacto", label: "Contacto" },
]

type NavbarProps = {
  isLanding: boolean
  isAuthenticated: boolean
  onLogout: () => Promise<void>
  profile?: { firstName: string; lastName: string; avatarUrl: string; username?: string }
}

export function Navbar({ isLanding, isAuthenticated, onLogout, profile }: NavbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const initials = profile
    ? `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()
    : "U"

  const userName = profile ? profile.firstName : "Usuario"
  const userLabel = profile ? `${profile.firstName} ${profile.lastName}` : "Usuario"
  const userSubLabel = profile ? profile.username ?? "" : "Sin perfil"

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          AulaLive
        </Link>

        {isLanding ? (
          <nav aria-label="Navegacion principal" className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : (
          <p className="hidden text-sm text-muted-foreground md:block">AulaLive</p>
        )}

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-slate-900 px-2 py-1 text-sm text-slate-100 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  <img src={profile?.avatarUrl} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
                </div>

                <span className="hidden truncate text-sm font-medium text-slate-100 sm:inline">
                  {userName}
                </span>

                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-background shadow-lg shadow-black/40 z-50">
                  <div className="border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">{userLabel}</p>
                    <p className="truncate text-xs text-slate-400">{userSubLabel}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100"
                      role="menuitem"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Ver perfil
                    </Link>
                  </div>

                  <div className="border-t border-border/70 py-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300 text-left"
                      role="menuitem"
                      onClick={() => {
                        void onLogout()
                        setIsDropdownOpen(false)
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild type="button" size="sm">
                <Link to="/register">Registro</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {isLanding && (
        <nav
          aria-label="Navegacion principal movil"
          className="mx-auto flex w-full max-w-6xl gap-5 overflow-x-auto px-4 pb-3 text-sm md:hidden"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
