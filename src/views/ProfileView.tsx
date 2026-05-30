import type { FormEvent } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toUserMessage } from "@/lib/error-messages"
import type { UserProfile } from "@/lib/api-client"

const AVATAR_OPTIONS = [
  "/avatars/avatar-01.png",
  "/avatars/avatar-02.png",
  "/avatars/avatar-03.png",
  "/avatars/avatar-04.png",
  "/avatars/avatar-05.png",
  "/avatars/avatar-06.png",
]

type ProfileViewProps = {
  profile: UserProfile | null
  onSave: (input: { firstName: string; lastName: string; avatarUrl: string }) => Promise<UserProfile>
}

export function ProfileView({ profile, onSave }: ProfileViewProps) {
  const [firstName, setFirstName] = useState(profile?.firstName || "")
  const [lastName, setLastName] = useState(profile?.lastName || "")
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_OPTIONS[0])
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
            <CardDescription>No se pudo cargar tu perfil en este momento.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const hasCustomAvatar = Boolean(profile.avatarUrl && !AVATAR_OPTIONS.includes(profile.avatarUrl))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      await onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatarUrl,
      })
      setSuccessMessage("Tus cambios se guardaron correctamente.")
    } catch (error) {
      setErrorMessage(toUserMessage(error, "profile"))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="text-3xl">Perfil</CardTitle>
          <CardDescription>Puedes editar nombre y avatar. Correo y username son de solo lectura.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="profile-first-name" className="text-sm font-medium">
                  Nombres
                </label>
                <input
                  id="profile-first-name"
                  className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="profile-last-name" className="text-sm font-medium">
                  Apellidos
                </label>
                <input
                  id="profile-last-name"
                  className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Avatar</p>
              {hasCustomAvatar ? (
                <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                  <p className="mb-2 text-xs text-muted-foreground">Avatar actual de tu cuenta</p>
                  <button
                    type="button"
                    className={`rounded-xl border p-1 transition ${
                      avatarUrl === profile.avatarUrl ? "border-primary ring-2 ring-primary/35" : "border-border/70"
                    }`}
                    onClick={() => setAvatarUrl(profile.avatarUrl)}
                  >
                    <img src={profile.avatarUrl} alt="Avatar actual" className="size-14 rounded-lg bg-background object-cover" />
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {AVATAR_OPTIONS.map((option) => {
                  const selected = avatarUrl === option
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-xl border p-1 transition ${selected ? "border-primary ring-2 ring-primary/35" : "border-border/70"}`}
                      onClick={() => setAvatarUrl(option)}
                    >
                      <img src={option} alt="Avatar" className="size-14 rounded-lg bg-background object-cover" />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="profile-email" className="text-sm font-medium">
                  Correo
                </label>
                <input
                  id="profile-email"
                  className="border-input bg-muted h-10 w-full rounded-lg border px-3 text-sm text-muted-foreground"
                  value={profile.email}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="profile-username" className="text-sm font-medium">
                  Username
                </label>
                <input
                  id="profile-username"
                  className="border-input bg-muted h-10 w-full rounded-lg border px-3 text-sm text-muted-foreground"
                  value={profile.username}
                  readOnly
                />
              </div>
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>

          {errorMessage ? <p className="mt-4 text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="mt-4 text-sm text-emerald-500">{successMessage}</p> : null}
        </CardContent>
      </Card>
    </main>
  )
}
