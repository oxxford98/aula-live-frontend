import { useCallback, useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { Navigate, Route, Routes, useNavigate } from "react-router-dom"

import { AuthLoginView } from "@/components/AuthLoginView"
import { AuthRegisterView } from "@/components/AuthRegisterView"
import { Navbar } from "@/components/Navbar"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import { deleteUserByUid, getMyProfile, updateMyProfile, type UserProfile } from "@/lib/api-client"
import { logoutUser, subscribeToAuthState } from "@/lib/firebase-auth"
import { DashboardView } from "./views/DashboardView"
import { LandingView } from "@/views/LandingView"
import { ProfileView } from "@/views/ProfileView"
import { RoomView } from "@/views/RoomView"
import { toast } from "sonner"

export function App() {
  const navigate = useNavigate()
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isDeletingAccountFlow, setIsDeletingAccountFlow] = useState(false)
  const hasCompletedProfile = Boolean(authUser && profile)
  const hasIncompleteSession = Boolean(authUser && !profile)

  const refreshProfile = useCallback(async (user: User) => {
    const idToken = await user.getIdToken()
    const response = await getMyProfile(idToken)
    setProfile(response.user)
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      setAuthUser(user)

      if (!user) {
        setProfile(null)
        setIsAuthLoading(false)
        return
      }

      try {
        await refreshProfile(user)
      } catch {
        setProfile(null)
      } finally {
        setIsAuthLoading(false)
      }
    })

    return unsubscribe
  }, [refreshProfile])

  const handleLogout = async () => {
    navigate("/", { replace: true })
    try {
      await logoutUser()
    } finally {
      setProfile(null)
    }
  }

  const handleUpdateProfile = async (input: {
    firstName: string
    lastName: string
    avatarUrl: string
    username: string
    email: string
  }) => {
    if (!authUser) {
      throw new Error("No hay sesion activa")
    }

    const idToken = await authUser.getIdToken()
    const response = await updateMyProfile(idToken, input)
    setProfile(response.user)
    return response.user
  }

  const handleDeleteAccount = async () => {
    if (!authUser) {
      throw new Error("No hay sesion activa")
    }

    // Keep the app out of protected routes while session is being torn down.
    setIsDeletingAccountFlow(true)

    try {
      const idToken = await authUser.getIdToken()
      await deleteUserByUid(authUser.uid, idToken)

      navigate("/", { replace: true })
      toast.success("Cuenta eliminada correctamente", {
        duration: 10000,
        description: "Tu cuenta fue eliminada exitosamente.",
      })

      try {
        await logoutUser()
      } catch {
        // Ignore sign-out failures after account deletion and continue local cleanup.
      }

      setAuthUser(null)
      setProfile(null)
      setIsAuthLoading(false)
    } finally {
      setIsDeletingAccountFlow(false)
    }
  }

  const handleRegisterSuccess = async (user?: UserProfile) => {
    if (user) {
      setProfile(user)
      setIsAuthLoading(false)
      navigate("/dashboard")
      return
    }

    if (authUser) {
      try {
        await refreshProfile(authUser)
      } catch {
        // If profile refresh fails, navigation logic will handle next step.
      }
    }

    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(70% 40% at 15% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%), radial-gradient(55% 35% at 85% 15%, rgba(34,211,238,.16), transparent 75%), linear-gradient(to bottom, transparent, color-mix(in oklab, var(--background) 85%, black))",
        }}
        aria-hidden="true"
      />

      <Navbar
        isLanding={location.pathname === "/"}
        isAuthenticated={hasCompletedProfile}
        onLogout={handleLogout}
        profile = {profile ?? undefined}
      />

      <div className="flex-1">
        <Routes>
          <Route
            path="/"
            element={<LandingView isAuthenticated={hasCompletedProfile} onLogout={handleLogout} />}
          />
          <Route
            path="/login"
            element={
              hasCompletedProfile ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AuthLoginView onGoRegister={() => navigate("/register")} onLoginSuccess={() => navigate("/dashboard")} />
              )
            }
          />
          <Route
            path="/register"
            element={
              hasCompletedProfile ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <AuthRegisterView onGoLogin={() => navigate("/login")} onRegisterSuccess={handleRegisterSuccess} />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              hasIncompleteSession ? (
                <Navigate to="/register" replace state={{ reason: "complete_google_profile" }} />
              ) : (
                <ProtectedRoute isAuthenticated={hasCompletedProfile} isAuthLoading={isAuthLoading}>
                  <DashboardView profile={profile} authUser={authUser} />
                </ProtectedRoute>
              )
            }
          />
          <Route
            path="/rooms/:roomId"
            element={
              hasIncompleteSession ? (
                <Navigate to="/register" replace state={{ reason: "complete_google_profile" }} />
              ) : (
                <ProtectedRoute isAuthenticated={hasCompletedProfile} isAuthLoading={isAuthLoading}>
                  <RoomView authUser={authUser} profile={profile} />
                </ProtectedRoute>
              )
            }
          />
          <Route
            path="/profile"
            element={
              isDeletingAccountFlow ? (
                <Navigate to="/" replace />
              ) : hasIncompleteSession ? (
                <Navigate to="/register" replace state={{ reason: "complete_google_profile" }} />
              ) : (
                <ProtectedRoute isAuthenticated={hasCompletedProfile} isAuthLoading={isAuthLoading}>
                  <ProfileView
                    profile={profile}
                    onSave={handleUpdateProfile}
                    onDeleteAccount={handleDeleteAccount}
                  />
                </ProtectedRoute>
              )
            }
          />
        </Routes>
      </div>

      <footer id="contacto" className="mt-auto border-t border-border/60 bg-card/30 py-8">
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

      <Toaster />
    </div>
  )
}

export default App
