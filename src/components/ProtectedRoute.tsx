import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { Card, CardDescription, CardHeader } from "@/components/ui/card"

type ProtectedRouteProps = {
  isAuthenticated: boolean
  isAuthLoading: boolean
  children: ReactNode
}

export function ProtectedRoute({ isAuthenticated, isAuthLoading, children }: ProtectedRouteProps) {
  const location = useLocation()

  if (isAuthLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <Card>
          <CardHeader>
            <CardDescription>Validando sesion...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ reason: "auth_required", from: location.pathname }} />
  }

  return <>{children}</>
}
