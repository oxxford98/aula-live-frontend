import type { FormEvent } from "react"
import { useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { loginWithGoogleApi } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"
import { loginWithEmailPassword } from "@/lib/firebase-auth"
import { loginWithGooglePopup } from "@/lib/firebase-auth"
import { useLocation } from "react-router-dom"

type AuthLoginViewProps = {
  onGoRegister: () => void
  onLoginSuccess: () => void
}

type LoginFieldKey = "email" | "password"
type LoginFieldErrors = Partial<Record<LoginFieldKey, string>>

export function AuthLoginView({ onGoRegister, onLoginSuccess }: AuthLoginViewProps) {
  const location = useLocation()
  const [isManualLoading, setIsManualLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})

  const routeState = location.state as { reason?: string; from?: string } | null
  const requiresAuthNotice = routeState?.reason === "auth_required"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    const errors: LoginFieldErrors = {}
    if (!email) {
      errors.email = "El email es obligatorio"
    }

    if (!password) {
      errors.password = "La contraseña es obligatoria"
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMessage("Completa los campos obligatorios")

      const firstInvalidId = errors.email ? "login-email" : "login-password"
      const invalidInput = document.getElementById(firstInvalidId) as HTMLElement | null
      invalidInput?.focus()
      return
    }

    setFieldErrors({})

    setIsManualLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      await loginWithEmailPassword(email, password)
      setSuccessMessage("Inicio de sesion exitoso. Redirigiendo al dashboard...")
      await new Promise((resolve) => setTimeout(resolve, 700))
      onLoginSuccess()
    } catch (error) {
      setErrorMessage(toUserMessage(error, "login"))
    } finally {
      setIsManualLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const { idToken } = await loginWithGooglePopup()
      const result = await loginWithGoogleApi({ idToken })

      if (result.requiresUsername) {
        throw new Error("Tu cuenta de Google aun no tiene username. Ve a Registro para completarlo.")
      }

      setSuccessMessage("Inicio de sesion con Google exitoso. Redirigiendo al dashboard...")
      await new Promise((resolve) => setTimeout(resolve, 700))
      onLoginSuccess()
    } catch (error) {
      setErrorMessage(toUserMessage(error, "google-login"))
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-4 pb-14 pt-10 sm:px-6 lg:pt-14" aria-labelledby="login-title">
      <Card className="border-border/60 bg-card/80 shadow-xl shadow-black/25 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle id="login-title" className="text-2xl">
            Iniciar sesión
          </CardTitle>
          <CardDescription>Ingresa con tu email y contraseña para entrar a tu aula.</CardDescription>
        </CardHeader>
        <CardContent>
          {requiresAuthNotice ? (
            <p className="mb-4 rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              Debes iniciar sesión para ingresar a esta ruta.
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                aria-invalid={Boolean(fieldErrors.email)}
                onChange={() => setFieldErrors((prev) => ({ ...prev, email: undefined }))}
              />
              {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="********"
                aria-invalid={Boolean(fieldErrors.password)}
                onChange={() => setFieldErrors((prev) => ({ ...prev, password: undefined }))}
              />
              {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
            </div>

            <Button type="submit" className="h-10 w-full text-sm font-semibold" disabled={isManualLoading || isGoogleLoading}>
              {isManualLoading ? "Ingresando..." : "Entrar"}
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
            onClick={handleGoogleLogin}
            disabled={isManualLoading || isGoogleLoading}
          >
            <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-border text-xs font-bold">G</span>
            {isGoogleLoading ? "Conectando con Google..." : "Continuar con Google"}
          </Button>

          {errorMessage ? <p className="mt-4 text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="mt-4 text-sm text-emerald-500">{successMessage}</p> : null}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Aun no tienes cuenta?{" "}
            <button type="button" onClick={onGoRegister} className="font-medium text-primary underline-offset-4 hover:underline">
              Registrate
            </button>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
