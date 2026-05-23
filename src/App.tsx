import { MessageSquareText, MonitorUp, ShieldCheck, Video } from "lucide-react"

import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

const features = [
  {
    title: "Chat en tiempo real",
    description: "Conversaciones instantaneas para resolver dudas sin salir del aula.",
    Icon: MessageSquareText,
  },
  {
    title: "Videollamadas",
    description: "Sesiones de estudio fluidas con audio y video para todo el grupo.",
    Icon: Video,
  },
  {
    title: "Comparticion de pantalla",
    description: "Explica ejercicios y presenta contenido en vivo con un solo clic.",
    Icon: MonitorUp,
  },
  {
    title: "Accesibilidad WCAG 2.2",
    description: "Navegacion clara, alto contraste y soporte completo para teclado.",
    Icon: ShieldCheck,
  },
]

export function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(70% 40% at 15% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%), radial-gradient(55% 35% at 85% 15%, rgba(34,211,238,.16), transparent 75%), linear-gradient(to bottom, transparent, color-mix(in oklab, var(--background) 85%, black))",
        }}
        aria-hidden="true"
      />

      <Navbar />

      <main id="inicio" className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <section aria-labelledby="hero-title" className="grid items-center gap-8 md:grid-cols-2 lg:gap-12">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              AulaLive
            </p>
            <h1 id="hero-title" className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Estudia en tiempo real, desde cualquier lugar
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Chat, videollamadas y colaboracion en un solo espacio.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button id="cta" size="lg" className="h-10 px-6 text-sm font-semibold shadow-lg shadow-primary/30">
                Entrar al Aula
              </Button>
              <Button asChild size="lg" variant="outline" className="h-10 px-6 text-sm font-semibold">
                <a href="#caracteristicas">Explorar caracteristicas</a>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 sm:max-w-md">
              <Card className="border-border/60 bg-card/70 py-4">
                <CardContent className="px-4 text-center">
                  <p className="text-xl font-semibold">24/7</p>
                  <p className="text-xs text-muted-foreground">Disponible</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/70 py-4">
                <CardContent className="px-4 text-center">
                  <p className="text-xl font-semibold">HD</p>
                  <p className="text-xs text-muted-foreground">Video estable</p>
                </CardContent>
              </Card>
              <Card className="border-border/60 bg-card/70 py-4">
                <CardContent className="px-4 text-center">
                  <p className="text-xl font-semibold">WCAG</p>
                  <p className="text-xs text-muted-foreground">Accesible</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="relative isolate min-h-[360px] overflow-hidden rounded-3xl border border-border/70 bg-card/65 p-5 shadow-2xl shadow-black/40 lg:min-h-[420px]">
            <div className="abstract-grid absolute inset-0 rounded-2xl" aria-hidden="true" />
            <div className="float-slow absolute right-10 top-6 size-28 rounded-full bg-primary/35 blur-3xl" aria-hidden="true" />
            <div className="float-slow-reverse absolute bottom-10 left-6 size-32 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-4">
              <Card className="border-border/60 bg-background/80 py-4 backdrop-blur">
                <CardHeader className="gap-2">
                  <h2 className="text-sm font-semibold tracking-wide">Sala activa: Algebra II</h2>
                  <CardDescription>6 participantes conectados</CardDescription>
                </CardHeader>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="border-border/60 bg-background/75 py-4">
                  <CardContent className="px-4">
                    <p className="text-sm text-muted-foreground">Chat en vivo</p>
                    <p className="mt-2 text-sm">"Listo, resolvamos el ejercicio 4"</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60 bg-background/75 py-4">
                  <CardContent className="flex h-full items-center justify-between px-4">
                    <p className="text-sm text-muted-foreground">Compartiendo pantalla</p>
                    <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-1 text-xs text-primary">
                    En vivo
                    </span>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="caracteristicas" className="py-14 md:py-20" aria-labelledby="features-title">
          <h2 id="features-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Caracteristicas
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Herramientas pensadas para sesiones de estudio academicas, dinamicas y productivas.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map(({ title, description, Icon }, index) => (
              <Card
                key={title}
                className={`fade-up ${
                  index === 0 ? "delay-1" : index === 1 ? "delay-2" : index === 2 ? "delay-3" : "delay-1"
                } border-border/60 bg-card/70 transition-colors hover:bg-card`}
              >
                <CardHeader className="gap-4">
                  <div className="inline-flex size-11 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <CardDescription className="text-sm sm:text-base">{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="accesibilidad" className="py-10 md:py-14" aria-labelledby="a11y-title">
          <Card className="border-primary/35 bg-gradient-to-br from-primary/10 via-card to-background">
            <CardHeader>
              <h2 id="a11y-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Disenada para ser accesible
              </h2>
              <CardDescription className="max-w-3xl text-base">
                AulaLive cumple lineamientos WCAG 2.2 con contraste alto, enfoque visible,
                estructura semantica y navegacion operable por teclado.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="py-10 md:py-14" aria-label="Testimonio destacado">
          <blockquote className="fade-up rounded-3xl border border-border/70 bg-card/80 px-6 py-10 text-center shadow-lg shadow-black/25">
            <p className="text-lg leading-relaxed sm:text-2xl">
              "AulaLive nos ayudo a convertir cada sesion remota en un estudio real: concentrado,
              colaborativo y eficiente."
            </p>
            <footer className="mt-4 text-sm text-muted-foreground">Equipo de Estudio U</footer>
          </blockquote>
        </section>
      </main>

      <footer id="contacto" className="border-t border-border/60 bg-card/30 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">AulaLive - Salon de Estudio Colaborativo</p>
          <nav aria-label="Enlaces del pie de pagina" className="flex flex-wrap gap-4 text-sm">
            <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/docs" aria-label="Ir a Documentacion">
              Documentacion
            </a>
            <a
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="https://github.com/oxxford98/aula-live-frontend"
              aria-label="Ir a GitHub"
            >
              GitHub
            </a>
            <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="mailto:contacto@aulalive.app">
              Contacto
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}

export default App
