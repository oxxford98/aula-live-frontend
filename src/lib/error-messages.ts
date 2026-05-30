type KnownContext = "login" | "google-login" | "register" | "google-register" | "profile"

const fallbackByContext: Record<KnownContext, string> = {
  login: "No se pudo iniciar sesion. Verifica tus credenciales e intenta de nuevo.",
  "google-login": "No se pudo iniciar sesion con Google. Intenta nuevamente.",
  register: "No se pudo completar el registro. Revisa tus datos e intenta de nuevo.",
  "google-register": "No se pudo completar el registro con Google. Intenta nuevamente.",
  profile: "No se pudo actualizar tu perfil. Intenta nuevamente.",
}

const firebaseCodeMessages: Record<string, string> = {
  "auth/invalid-email": "El correo no tiene un formato valido.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "La contrasena es incorrecta.",
  "auth/invalid-credential": "Correo o contrasena incorrectos.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  "auth/network-request-failed": "No hay conexion a internet o el servicio no responde.",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de completar el acceso.",
  "auth/popup-blocked": "El navegador bloqueo la ventana emergente de Google. Habilita popups e intenta otra vez.",
  "auth/cancelled-popup-request": "La solicitud de Google fue cancelada. Intenta nuevamente.",
  "auth/account-exists-with-different-credential": "Ya existe una cuenta con ese correo usando otro metodo de acceso.",
}

const extractFirebaseAuthCode = (message: string): string | null => {
  const match = message.match(/auth\/[a-z0-9-]+/i)
  return match?.[0] ?? null
}

export const toUserMessage = (error: unknown, context: KnownContext): string => {
  if (!(error instanceof Error)) {
    return fallbackByContext[context]
  }

  const rawMessage = error.message || ""
  const firebaseCode = extractFirebaseAuthCode(rawMessage)

  if (firebaseCode && firebaseCodeMessages[firebaseCode]) {
    return firebaseCodeMessages[firebaseCode]
  }

  if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError")) {
    return "No se pudo conectar con el servidor. Verifica que el backend este activo."
  }

  if (rawMessage.includes("username")) {
    return "El username ingresado no esta disponible o no es valido."
  }

  if (rawMessage.includes("correo institucional")) {
    return "Debes registrarte con un correo institucional valido."
  }

  if (rawMessage.includes("No autorizado")) {
    return "Tu sesion expiro. Inicia sesion nuevamente."
  }

  if (rawMessage.trim()) {
    return rawMessage
  }

  return fallbackByContext[context]
}
