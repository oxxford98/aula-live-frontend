import type { FormEvent } from "react"
import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { checkUsernameAvailability, loginWithGoogleApi, registerManualUser, type UserProfile } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"
import { loginWithEmailPassword, loginWithGooglePopup } from "@/lib/firebase-auth"
import { useLocation } from "react-router-dom"

type AuthRegisterViewProps = {
  onGoLogin: () => void
  onRegisterSuccess: (user?: UserProfile) => void | Promise<void>
}

type UsernameState = "idle" | "checking" | "available" | "taken"

type ManualFieldKey = "firstName" | "lastName" | "username" | "avatarUrl" | "email" | "password"
type ManualFieldErrors = Partial<Record<ManualFieldKey, string>>

const FIELD_ID_BY_KEY: Record<Exclude<ManualFieldKey, "avatarUrl">, string> = {
  firstName: "register-first-name",
  lastName: "register-last-name",
  username: "register-username",
  email: "register-email",
  password: "register-password",
}

const FIELD_ORDER: ManualFieldKey[] = ["firstName", "lastName", "username", "avatarUrl", "email", "password"]

const AVATAR_OPTIONS = [
  "/avatars/avatar-01.png",
  "/avatars/avatar-02.png",
  "/avatars/avatar-03.png",
  "/avatars/avatar-04.png",
  "/avatars/avatar-05.png",
  "/avatars/avatar-06.png",
]

export function AuthRegisterView({ onGoLogin, onRegisterSuccess }: AuthRegisterViewProps) {
  const location = useLocation()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [username, setUsername] = useState("")
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0])
  const [pendingGoogleToken, setPendingGoogleToken] = useState("")
  const [googleProfileName, setGoogleProfileName] = useState("")
  const [googleProfileEmail, setGoogleProfileEmail] = useState("")
  const [usernameState, setUsernameState] = useState<UsernameState>("idle")
  const [isManualLoading, setIsManualLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState<ManualFieldErrors>({})
  const routeState = location.state as { reason?: string } | null
  const requiresGoogleCompletionNotice = routeState?.reason === "complete_google_profile"

  const validateManualFields = (params: {
    firstName: string
    lastName: string
    username: string
    avatarUrl: string
    email: string
    password: string
  }): ManualFieldErrors => {
    const errors: ManualFieldErrors = {}

    if (!params.firstName) {
      errors.firstName = "Los nombres son obligatorios"
    }

    if (!params.lastName) {
      errors.lastName = "Los apellidos son obligatorios"
    }

    if (!params.username) {
      errors.username = "El nombre de usuario es obligatorio"
    }

    if (!params.avatarUrl) {
      errors.avatarUrl = "Debes seleccionar un avatar"
    }

    if (!params.email) {
      errors.email = "El correo institucional es obligatorio"
    } else if (!/^[^\s@]+@[^\s@]+\.(edu|edu\.[a-z]{2,})$/i.test(params.email)) {
      errors.email = "Ingresa un correo institucional valido"
    }

    if (!params.password) {
      errors.password = "La contraseña es obligatoria"
    } else if (params.password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres"
    }

    return errors
  }

  const focusFirstInvalidField = (errors: ManualFieldErrors) => {
    const firstInvalid = FIELD_ORDER.find((key) => errors[key])
    if (!firstInvalid) {
      return
    }

    if (firstInvalid === "avatarUrl") {
      const avatarButton = document.querySelector("[aria-label^='Seleccionar avatar-']") as HTMLButtonElement | null
      avatarButton?.focus()
      return
    }

    const elementId = FIELD_ID_BY_KEY[firstInvalid]
    const inputElement = document.getElementById(elementId) as HTMLElement | null
    inputElement?.focus()
  }

  const checkUsername = async (usernameValue: string): Promise<boolean> => {
    const trimmed = usernameValue.trim()
    if (!trimmed) {
      setUsernameState("idle")
      return false
    }

    setUsernameState("checking")
    try {
      const { available } = await checkUsernameAvailability(trimmed)
      setUsernameState(available ? "available" : "taken")
      return available
    } catch (error) {
      setErrorMessage(toUserMessage(error, "register"))
      setUsernameState("idle")
      return false
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const firstNameValue = String(formData.get("firstName") || "").trim()
    const lastNameValue = String(formData.get("lastName") || "").trim()
    const usernameValue = String(formData.get("username") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    const errors = validateManualFields({
      firstName: firstNameValue,
      lastName: lastNameValue,
      username: usernameValue,
      avatarUrl,
      email,
      password,
    })

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMessage("Corrige los campos marcados antes de continuar")
      focusFirstInvalidField(errors)
      return
    }

    setFieldErrors({})

    const usernameAvailable = await checkUsername(usernameValue)
    if (!usernameAvailable) {
      setFieldErrors((previous) => ({ ...previous, username: "El username ya esta en uso o no es valido" }))
      setErrorMessage("El username ya esta en uso o no es valido")
      const usernameInput = document.getElementById("register-username") as HTMLElement | null
      usernameInput?.focus()
      return
    }

    setIsManualLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await registerManualUser({
        firstName: firstNameValue,
        lastName: lastNameValue,
        username: usernameValue,
        avatarUrl,
        email,
        password,
      })
      await loginWithEmailPassword(email, password)
      setSuccessMessage("Registro manual exitoso. Redirigiendo al dashboard...")
      await new Promise((resolve) => setTimeout(resolve, 700))
      await onRegisterSuccess(response.user)
    } catch (error) {
      setErrorMessage(toUserMessage(error, "register"))
    } finally {
      setIsManualLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    setIsGoogleLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const { idToken } = await loginWithGooglePopup()
      const response = await loginWithGoogleApi({ idToken })

      if (response.requiresUsername) {
        setPendingGoogleToken(idToken)
        setGoogleProfileName(`${response.googleProfile.firstName} ${response.googleProfile.lastName}`.trim())
        setGoogleProfileEmail(response.googleProfile.email)
        setAvatarUrl(response.googleProfile.avatarUrl)
        setSuccessMessage("Google autenticado. Ahora elige un username para finalizar tu perfil.")
        return
      }

      setSuccessMessage("Inicio de sesion con Google exitoso. Redirigiendo al dashboard...")
      await new Promise((resolve) => setTimeout(resolve, 700))
      await onRegisterSuccess(response.user)
    } catch (error) {
      setErrorMessage(toUserMessage(error, "google-register"))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleCompleteGoogleProfile = async () => {
    const usernameAvailable = await checkUsername(username)
    if (!usernameAvailable) {
      setErrorMessage("El username ya esta en uso o no es valido")
      return
    }

    if (!pendingGoogleToken) {
      setErrorMessage("La sesion de Google expiro. Intenta nuevamente.")
      return
    }

    setIsGoogleLoading(true)
    setErrorMessage("")

    try {
      const response = await loginWithGoogleApi({
        idToken: pendingGoogleToken,
        username: username.trim(),
        avatarUrl,
      })

      if (response.requiresUsername) {
        throw new Error("No se pudo completar el perfil de Google")
      }

      setSuccessMessage("Perfil de Google completado correctamente. Redirigiendo al dashboard...")
      await new Promise((resolve) => setTimeout(resolve, 700))
      await onRegisterSuccess(response.user)
    } catch (error) {
      setErrorMessage(toUserMessage(error, "google-register"))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const isGoogleUsernameStep = Boolean(pendingGoogleToken)

  return (
    <section className="mx-auto w-full max-w-md px-4 pb-14 pt-10 sm:px-6 lg:pt-14" aria-labelledby="register-title">
      <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/25 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle id="register-title" className="text-2xl">
            {isGoogleUsernameStep ? "Elige tu username" : "Crea tu cuenta"}
          </CardTitle>
          <CardDescription>
            {isGoogleUsernameStep
              ? "Tu cuenta Google fue validada. Elige username y avatar para continuar."
              : "Registra tu usuario manual o continua con Google."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requiresGoogleCompletionNotice ? (
            <p className="mb-4 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Debes completar tu perfil de Google eligiendo username y avatar para continuar.
            </p>
          ) : null}

          {isGoogleUsernameStep ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
                <p>Nombre: {googleProfileName || "Cuenta Google"}</p>
                <p>Email: {googleProfileEmail || "-"}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="register-username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="register-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="tu_usuario"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setUsernameState("idle")
                  }}
                  onBlur={() => {
                    void checkUsername(username)
                  }}
                />
                {usernameState === "checking" ? <p className="text-xs text-muted-foreground">Validando username...</p> : null}
                {usernameState === "available" ? <p className="text-xs text-emerald-500">Username disponible</p> : null}
                {usernameState === "taken" ? <p className="text-xs text-destructive">Username ya ocupado</p> : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Selecciona tu avatar</p>
                  <img
                    src={avatarUrl}
                    alt="Avatar seleccionado"
                    className="size-10 rounded-full border border-border/70 bg-background object-cover"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {AVATAR_OPTIONS.map((option) => {
                    const isSelected = avatarUrl === option

                    return (
                      <button
                        key={option}
                        type="button"
                        className={`rounded-xl border p-1 transition ${
                          isSelected ? "border-primary ring-2 ring-primary/35" : "border-border/70 hover:border-primary/60"
                        }`}
                        onClick={() => setAvatarUrl(option)}
                        aria-label={`Seleccionar ${option.split("/").pop()}`}
                      >
                        <img src={option} alt="Avatar" className="size-14 rounded-lg bg-background object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>

              <Button type="button" className="h-10 w-full text-sm font-semibold" onClick={handleCompleteGoogleProfile} disabled={isGoogleLoading}>
                {isGoogleLoading ? "Guardando perfil..." : "Finalizar registro con Google"}
              </Button>
            </div>
          ) : (
            <>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="register-first-name" className="text-sm font-medium">
                      Nombres
                    </label>
                    <Input
                      id="register-first-name"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Juan"
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value)
                        setFieldErrors((previous) => ({ ...previous, firstName: undefined }))
                      }}
                      aria-invalid={Boolean(fieldErrors.firstName)}
                    />
                    {fieldErrors.firstName ? <p className="text-xs text-destructive">{fieldErrors.firstName}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="register-last-name" className="text-sm font-medium">
                      Apellidos
                    </label>
                    <Input
                      id="register-last-name"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Perez"
                      value={lastName}
                      onChange={(event) => {
                        setLastName(event.target.value)
                        setFieldErrors((previous) => ({ ...previous, lastName: undefined }))
                      }}
                      aria-invalid={Boolean(fieldErrors.lastName)}
                    />
                    {fieldErrors.lastName ? <p className="text-xs text-destructive">{fieldErrors.lastName}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-username" className="text-sm font-medium">
                    Nombre de usuario
                  </label>
                  <Input
                    id="register-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="tu_usuario"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value)
                      setUsernameState("idle")
                      setFieldErrors((previous) => ({ ...previous, username: undefined }))
                    }}
                    onBlur={() => {
                      void checkUsername(username)
                    }}
                    aria-invalid={Boolean(fieldErrors.username || usernameState === "taken")}
                  />
                  {usernameState === "checking" ? <p className="text-xs text-muted-foreground">Validando nombre de usuario...</p> : null}
                  {usernameState === "available" ? <p className="text-xs text-emerald-500">Nombre de usuario disponible</p> : null}
                  {usernameState === "taken" ? <p className="text-xs text-destructive">Nombre de usuario ya ocupado</p> : null}
                  {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Selecciona tu avatar</p>
                    <img
                      src={avatarUrl}
                      alt="Avatar seleccionado"
                      className="size-10 rounded-full border border-border/70 bg-background object-cover"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {AVATAR_OPTIONS.map((option) => {
                      const isSelected = avatarUrl === option

                      return (
                        <button
                          key={option}
                          type="button"
                          className={`rounded-xl border p-1 transition ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/35"
                              : fieldErrors.avatarUrl
                                ? "border-destructive"
                                : "border-border/70 hover:border-primary/60"
                          }`}
                          onClick={() => {
                            setAvatarUrl(option)
                            setFieldErrors((previous) => ({ ...previous, avatarUrl: undefined }))
                          }}
                          aria-label={`Seleccionar ${option.split("/").pop()}`}
                        >
                          <img src={option} alt="Avatar" className="size-14 rounded-lg bg-background object-cover" />
                        </button>
                      )
                    })}
                  </div>
                  {fieldErrors.avatarUrl ? <p className="text-xs text-destructive">{fieldErrors.avatarUrl}</p> : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-email" className="text-sm font-medium">
                    Correo institucional
                  </label>
                  <Input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@universidad.edu"
                    onChange={() => setFieldErrors((previous) => ({ ...previous, email: undefined }))}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="register-password" className="text-sm font-medium">
                    Contraseña
                  </label>
                  <Input
                    id="register-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="mínimo 6 caracteres"
                    onChange={() => setFieldErrors((previous) => ({ ...previous, password: undefined }))}
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
                </div>

                <Button type="submit" className="h-10 w-full text-sm font-semibold" disabled={isManualLoading || isGoogleLoading}>
                  {isManualLoading ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full text-sm font-semibold"
                onClick={handleGoogleRegister}
                disabled={isManualLoading || isGoogleLoading}
              >
                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-border text-xs font-bold">G</span>
                {isGoogleLoading ? "Conectando con Google..." : "Continuar con Google"}
              </Button>
            </>
          )}

          {errorMessage ? <p className="mt-4 text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="mt-4 text-sm text-emerald-500">{successMessage}</p> : null}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <button type="button" onClick={onGoLogin} className="font-medium text-primary underline-offset-4 hover:underline">
              Inicia sesión
            </button>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
