import type { FormEvent } from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { checkUsernameAvailability } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"
import type { UserProfile } from "@/lib/api-client"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

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
  onSave: (input: { firstName: string; lastName: string; avatarUrl: string; username: string; email: string }) => Promise<UserProfile>
  onDeleteAccount: () => Promise<void>
}

type UsernameState = "idle" | "checking" | "available" | "taken"
type ProfileFieldKey = "firstName" | "lastName" | "username" | "email" | "avatarUrl"
type ProfileFieldErrors = Partial<Record<ProfileFieldKey, string>>

export function ProfileView({ profile, onSave, onDeleteAccount }: ProfileViewProps) {
  const [firstName, setFirstName] = useState(profile?.firstName || "")
  const [lastName, setLastName] = useState(profile?.lastName || "")
  const [username, setUsername] = useState(profile?.username || "")
  const [email, setEmail] = useState(profile?.email || "")
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_OPTIONS[0])
  const [usernameState, setUsernameState] = useState<UsernameState>("idle")
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
  const isManualProvider = profile.provider === "manual"

  const checkUsername = async (usernameValue: string): Promise<boolean> => {
    const trimmed = usernameValue.trim()
    if (!trimmed) {
      setUsernameState("idle")
      return false
    }

    if (trimmed.toLowerCase() === profile.usernameNormalized) {
      setUsernameState("available")
      return true
    }

    setUsernameState("checking")
    try {
      const { available } = await checkUsernameAvailability(trimmed)
      setUsernameState(available ? "available" : "taken")
      return available
    } catch (error) {
      setUsernameState("idle")
      toast.error("No se pudo validar el username", {
        duration: 10000,
        description: toUserMessage(error, "profile"),
      })
      return false
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors: ProfileFieldErrors = {}
    const firstNameValue = firstName.trim()
    const lastNameValue = lastName.trim()
    const usernameValue = username.trim()
    const emailValue = email.trim()

    if (!firstNameValue) {
      errors.firstName = "Los nombres son obligatorios"
    }

    if (!lastNameValue) {
      errors.lastName = "Los apellidos son obligatorios"
    }

    if (!usernameValue) {
      errors.username = "El username es obligatorio"
    }

    if (!avatarUrl) {
      errors.avatarUrl = "Debes seleccionar un avatar"
    }

    if (!emailValue) {
      errors.email = "El correo es obligatorio"
    } else if (isManualProvider && !/^[^\s@]+@[^\s@]+\.(edu|edu\.[a-z]{2,})$/i.test(emailValue)) {
      errors.email = "Ingresa un correo institucional valido"
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Formulario incompleto", {
        duration: 10000,
        description: "Corrige los campos marcados antes de continuar",
      })
      return
    }

    const usernameAvailable = await checkUsername(usernameValue)
    if (!usernameAvailable) {
      setFieldErrors((prev) => ({ ...prev, username: "El username ya esta en uso o no es valido" }))
      toast.error("Username no disponible", {
        duration: 10000,
        description: "El username ya esta en uso o no es valido",
      })
      return
    }

    setFieldErrors({})
    setIsSaving(true)

    try {
      await onSave({
        firstName: firstNameValue,
        lastName: lastNameValue,
        avatarUrl,
        username: usernameValue,
        email: emailValue,
      })
      toast.success("Perfil actualizado", {
        duration: 10000,
        description: "Tus cambios se guardaron correctamente.",
      })
    } catch (error) {
      toast.error("No se pudo guardar el perfil", {
        duration: 10000,
        description: toUserMessage(error, "profile"),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccountClick = async () => {
    setIsDeleting(true)
    try {
      await onDeleteAccount()
    } catch (error) {
      toast.error("No se pudo eliminar la cuenta", {
        duration: 10000,
        description: toUserMessage(error, "profile"),
      })
      setIsDeleting(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      
      <Button variant="ghost" className="px-2">
        <Link to="/dashboard" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
      </Button>

      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="text-3xl">Perfil</CardTitle>
          <CardDescription>
            Puedes editar nombre, avatar y username. El correo solo puede editarse en cuentas registradas manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="profile-first-name" className="text-sm font-medium">
                  Nombres
                </label>
                <Input
                  id="profile-first-name"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value)
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }))
                  }}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                />
                {fieldErrors.firstName ? <p className="text-xs text-destructive">{fieldErrors.firstName}</p> : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="profile-last-name" className="text-sm font-medium">
                  Apellidos
                </label>
                <Input
                  id="profile-last-name"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value)
                    setFieldErrors((prev) => ({ ...prev, lastName: undefined }))
                  }}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                />
                {fieldErrors.lastName ? <p className="text-xs text-destructive">{fieldErrors.lastName}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="profile-username" className="text-sm font-medium">
                Username
              </label>
              <Input
                id="profile-username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setUsernameState("idle")
                  setFieldErrors((prev) => ({ ...prev, username: undefined }))
                }}
                onBlur={() => {
                  void checkUsername(username)
                }}
                aria-invalid={Boolean(fieldErrors.username || usernameState === "taken")}
              />
              {usernameState === "checking" ? <p className="text-xs text-muted-foreground">Validando username...</p> : null}
              {usernameState === "available" ? <p className="text-xs text-emerald-500">Username disponible</p> : null}
              {usernameState === "taken" ? <p className="text-xs text-destructive">Username ya ocupado</p> : null}
              {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="profile-email" className="text-sm font-medium">
                Correo
              </label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((prev) => ({ ...prev, email: undefined }))
                }}
                readOnly={!isManualProvider}
                aria-invalid={Boolean(fieldErrors.email)}
                className={!isManualProvider ? "bg-muted text-muted-foreground" : undefined}
              />
              {!isManualProvider ? (
                <p className="text-xs text-muted-foreground">
                  No puedes editar el correo porque esta cuenta fue registrada con Google.
                </p>
              ) : null}
              {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
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
                      onClick={() => {
                        setAvatarUrl(option)
                        setFieldErrors((prev) => ({ ...prev, avatarUrl: undefined }))
                      }}
                    >
                      <img src={option} alt="Avatar" className="size-14 rounded-lg bg-background object-cover" />
                    </button>
                  )
                })}
              </div>
              {fieldErrors.avatarUrl ? <p className="text-xs text-destructive">{fieldErrors.avatarUrl}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="ml-auto" disabled={isSaving || isDeleting}>
                    {isDeleting ? "Eliminando cuenta..." : "Eliminar mi cuenta"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta accion eliminara tu cuenta de forma permanente, incluyendo tu acceso y tu perfil. No se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button" disabled={isDeleting}>
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction type="button" disabled={isDeleting} onClick={() => void handleDeleteAccountClick()}>
                      {isDeleting ? "Eliminando..." : "Si, eliminar cuenta"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>

        </CardContent>
      </Card>
    </main>
  )
}
