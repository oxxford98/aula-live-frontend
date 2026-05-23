import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

export function WelcomeCard() {
  return (
    <Card className="mx-auto w-full max-w-4xl border-primary/20 bg-gradient-to-b from-primary/5 to-background">
      <CardHeader className="gap-4 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Estudio en tiempo real
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">AulaLive</h1>
        <CardDescription className="mx-auto max-w-3xl text-base sm:text-lg">
          Crea tu sala, invita a tu equipo y estudien juntos con chat, audio, video y
          comparticion de pantalla en una sola plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild type="button" aria-label="Entrar al Aula" size="lg">
          <a href="#cta">Entrar al Aula</a>
        </Button>
        <Button asChild type="button" aria-label="Ver demo" size="lg" variant="outline">
          <a href="#como-funciona">Ver demo</a>
        </Button>
      </CardContent>
    </Card>
  )
}
