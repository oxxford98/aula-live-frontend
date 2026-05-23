import { Button } from "@/components/ui/button"

const navItems = [
  { href: "#inicio", label: "Inicio" },
  { href: "#caracteristicas", label: "Caracteristicas" },
  { href: "#accesibilidad", label: "Accesibilidad" },
  { href: "#contacto", label: "Contacto" },
]

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#inicio" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          AulaLive
        </a>

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

        <Button asChild size="sm" className="hidden sm:inline-flex">
          <a href="#cta">Entrar al Aula</a>
        </Button>
      </div>

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
    </header>
  )
}
