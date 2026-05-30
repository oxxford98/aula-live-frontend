import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserProfile } from "@/lib/api-client"

type DashboardViewProps = {
  profile: UserProfile | null
}

export function DashboardView({ profile }: DashboardViewProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="text-3xl">Dashboard</CardTitle>
          <CardDescription>
            Bienvenido{profile ? `, ${profile.firstName}` : ""}. Tu autenticacion fue validada correctamente.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}
