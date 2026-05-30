import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

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
}

export function Navbar({ isLanding, isAuthenticated, onLogout }: NavbarProps) {
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

        <div className="hidden items-center gap-2 sm:flex">
          {isAuthenticated ? (
            <>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/dashboard">Ir al Dashboard</Link>
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/profile">Ver Perfil</Link>
              </Button>
              <Button type="button" size="sm" onClick={() => void onLogout()}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild type="button" size="sm">
                <Link to="/register">Registro</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {isLanding ? (
        <nav
          aria-label="Navegacion principal movil"
          className="mx-auto flex w-full max-w-6xl gap-5 overflow-x-auto px-4 pb-3 text-sm md:hidden"
        >
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="whitespace-nowrap text-muted-foreground hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 pb-3 sm:hidden">
          {isAuthenticated ? (
            <>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/profile">Perfil</Link>
              </Button>
              <Button type="button" size="sm" onClick={() => void onLogout()}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild type="button" variant="outline" size="sm">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild type="button" size="sm">
                <Link to="/register">Registro</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
