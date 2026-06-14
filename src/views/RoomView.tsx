import { useEffect, useRef, useState } from "react"
import type { User } from "firebase/auth"
import { getAuth } from "firebase/auth"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Copy,
  Pencil,
  ShieldCheck,
  Trash2,
  MonitorUp,
  MessageSquare,
  Users,
  Mic,
  Video,
  PhoneMissed,
  Send,
  User as UserIcon,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { io, Socket } from "socket.io-client"

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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteRoomById, getRoomById, updateRoomById, type Room } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"

type RoomViewProps = {
  authUser: User | null
}

export function RoomView({ authUser }: RoomViewProps) {
  const navigate = useNavigate()
  const { roomId } = useParams<{ roomId: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingRoomName, setIsEditingRoomName] = useState(false)
  const [roomNameDraft, setRoomNameDraft] = useState("")
  const [roomDescriptionDraft, setRoomDescriptionDraft] = useState("")
  const [isSavingRoomName, setIsSavingRoomName] = useState(false)
  const [isDeletingRoom, setIsDeletingRoom] = useState(false)

  const isCreator = Boolean(room?.creatorUid && authUser?.uid && room.creatorUid === authUser.uid)

  // UI-only chat & participants state (local, non-persistent)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [messages, setMessages] = useState<
    { id: number | string; user: string; text: string; isSystem?: boolean; createdAt?: string }[]
  >([{ id: 1, user: "Sistema", text: "Bienvenido a la sala.", isSystem: true }])
  const [participants, setParticipants] = useState<
    { id: string; name: string; role?: "admin" | "participant"; isSpeaking?: boolean }[]
  >([])

  const socketRef = useRef<Socket | null>(null)
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleCopyRoomId = async () => {
    if (!room?.id) return
    try {
      await navigator.clipboard.writeText(room.id)
      toast.success("ID copiado", { description: `El ID ${room.id} se copió al portapapeles.` })
    } catch {
      toast.error("No se pudo copiar el ID")
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    let cancelled = false

    const loadRoom = async () => {
      if (!authUser || !roomId) return
      setIsLoading(true)
      try {
        const idToken = await authUser.getIdToken()
        const response = await getRoomById(roomId, idToken)
        if (!cancelled) {
          setRoom(response.room)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("No se pudo abrir la sala", { description: toUserMessage(error, "profile") })
          navigate("/dashboard", { replace: true })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadRoom()
    return () => {
      cancelled = true
    }
  }, [authUser, navigate, roomId])

  // SOCKET.IO: conectar cuando tengamos authUser y roomId
  useEffect(() => {
    if (!roomId) return
    if (!SOCKET_URL) {
      console.warn("VITE_SOCKET_URL no configurado. Ignorando conexión socket.")
      return
    }

    let active = true
    const connectSocket = async () => {
      try {
        // obtener token: preferir el authUser que te llega como prop
        const token =
          (await authUser?.getIdToken()) ?? (await getAuth().currentUser?.getIdToken?.())

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
        })

        socketRef.current = socket

        socket.on("connect", () => {
          // join the room and request history
          socket.emit(
            "join_room",
            roomId,
            (res: { ok: boolean; messages?: any[]; participants?: any[]; error?: string }) => {
              if (!active) return
              if (res?.ok) {
                if (Array.isArray(res.messages)) {
                  setMessages(res.messages)
                }
                if (Array.isArray(res.participants)) {
                  setParticipants(res.participants)
                }
              } else {
                toast.error("No se pudo entrar a la sala", { description: res?.error ?? "" })
              }
            }
          )
        })

        socket.on("message", (msg: any) => {
          if (!active) return
          setMessages((prev) => [...prev, msg])
        })

        // opcional: recibir actualizaciones de participantes
        socket.on("room_participants", (list: any[]) => {
          if (!active) return
          setParticipants(list)
        })

        socket.on("connect_error", (err: any) => {
          console.error("Socket connect_error", err)
        })
      } catch (err) {
        console.error("Error conectando socket:", err)
      }
    }

    void connectSocket()

    return () => {
      active = false
      const s = socketRef.current
      if (s) {
        try {
          s.emit("leave_room", roomId)
        } catch {}
        s.disconnect()
        socketRef.current = null
      }
    }
    // intentionally depend on authUser?.uid and roomId
  }, [authUser?.uid, roomId, SOCKET_URL])

  const startEditing = () => {
    if (!room) return
    setRoomNameDraft(room.name)
    setRoomDescriptionDraft(room.description)
    setIsEditingRoomName(true)
  }

  const cancelEditing = () => {
    setIsEditingRoomName(false)
    setRoomNameDraft("")
    setRoomDescriptionDraft("")
  }

  const handleSaveRoomName = async () => {
    if (!room || !authUser) return
    const nextName = roomNameDraft.trim()
    if (!nextName) {
      toast.error("El nombre de la sala es obligatorio")
      return
    }
    const nextDescription = roomDescriptionDraft.trim()
    if (!nextDescription) {
      toast.error("La descripción de la sala es obligatoria")
      return
    }

    setIsSavingRoomName(true)
    try {
      const idToken = await authUser.getIdToken()
      const response = await updateRoomById(room.id, idToken, {
        name: nextName,
        description: nextDescription,
      })
      setRoom(response.room)
      setIsEditingRoomName(false)
      setRoomDescriptionDraft("")
      toast.success("Sala actualizada")
    } catch (error) {
      toast.error("No se pudo actualizar la sala", { description: toUserMessage(error, "profile") })
    } finally {
      setIsSavingRoomName(false)
    }
  }

  const handleDeleteRoom = async () => {
    if (!room || !authUser) return
    setIsDeletingRoom(true)
    try {
      const idToken = await authUser.getIdToken()
      await deleteRoomById(room.id, idToken)
      toast.success("Sala eliminada")
      navigate("/dashboard", { replace: true })
    } catch (error) {
      toast.error("No se pudo eliminar la sala", { description: toUserMessage(error, "profile") })
      setIsDeletingRoom(false)
    }
  }

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!chatMessage.trim()) return

    const payload = { roomId, text: chatMessage }
    const socket = socketRef.current

    // enviar por socket con callback de ack si está conectado
    if (socket && socket.connected) {
      socket.emit("message", payload, (res: { ok: boolean; message?: any; error?: string }) => {
        if (res?.ok) {
          // opcional: el servidor puede devolver el mensaje con id/createdAt
          if (res.message) {
            setMessages((prev) => [...prev, res.message])
          }
        } else {
          toast.error("No se pudo enviar el mensaje", { description: res?.error ?? "" })
        }
      })
    } else {
      // fallback local (optimista)
      setMessages((prev) => [...prev, { id: Date.now(), user: "Tú", text: chatMessage }])
    }

    setChatMessage("")
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      {/* HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex flex-1 items-center gap-4">
          <Button variant="ghost" className="px-2">
            <Link to="/dashboard" aria-label="Volver">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="flex flex-col">
            {isEditingRoomName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={roomNameDraft}
                  onChange={(e) => setRoomNameDraft(e.target.value)}
                  className="h-8 w-52"
                  placeholder="Nombre de la sala"
                />
                <Button size="sm" onClick={() => void handleSaveRoomName()} disabled={isSavingRoomName}>
                  {isSavingRoomName ? "..." : "Guardar"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEditing}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{isLoading ? "Cargando..." : room?.name ?? "Sala"}</h1>
                  {isCreator && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="size-3" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{room?.description || "Sin descripción"}</p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* ID + copy: visible both mobile and desktop; text hidden on small */}
          <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
            <span className="font-mono text-xs tracking-widest mr-2">{room?.id ?? "--- --- ---"}</span>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => void handleCopyRoomId()} disabled={isLoading || !room?.id}>
              <Copy className="size-3.5" />
            </Button>
          </div>

          {/* Edit + Delete: icon-only on mobile, full on desktop */}
          {isCreator && !isEditingRoomName && (
            <div className="flex items-center gap-2 border-l pl-3 ml-3">
              <Button
                variant="ghost"
                size="icon"
                className="flex items-center justify-center sm:hidden h-8 w-8"
                onClick={() => {
                  startEditing()
                }}
                aria-label="Editar sala"
                title="Editar"
              >
                <Pencil className="size-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex h-8 px-2"
                onClick={() => {
                  startEditing()
                }}
              >
                <Pencil className="mr-2 size-3.5" /> Editar
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-8 w-8 sm:hidden" aria-label="Eliminar sala" title="Eliminar sala" disabled={isDeletingRoom}>
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="hidden sm:inline-flex h-8 px-2" disabled={isDeletingRoom}>
                    <Trash2 className="mr-2 size-3.5" />
                    {isDeletingRoom ? "Eliminando..." : "Eliminar"}
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción eliminará la sala de forma permanente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void handleDeleteRoom()}>Si, eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Chat button visible on mobile to open full-screen chat */}
          <Button
            variant={isMobileChatOpen ? "default" : "ghost"}
            size="icon"
            className="lg:hidden h-8 w-8 ml-2"
            onClick={() => setIsMobileChatOpen(true)}
            aria-label="Abrir chat"
            title="Chat"
          >
            <MessageSquare className="size-4" />
          </Button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="relative flex flex-1 overflow-hidden p-2 sm:p-4 gap-4 lg:flex-row flex-col">
        {/* LEFT: Stage + Participants */}
        <section className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="relative flex flex-1 flex-col items-center justify-center rounded-2xl border bg-card shadow-lg overflow-hidden">
            <div className="flex flex-col items-center text-muted-foreground">
              <div className="mb-4 rounded-full bg-muted p-6">
                <MonitorUp className="size-12 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">Nadie está compartiendo pantalla</p>
              <p className="text-sm text-muted-foreground">Cuando alguien inicie transmisión, aparecerá aquí.</p>
            </div>

            {/* Floating controls: ensure spacing and no overlap */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 rounded-2xl border bg-card p-2 z-10">
              <Button variant="secondary" size="icon" className="hover:bg-muted">
                <Mic className="size-5" />
              </Button>
              <Button variant="secondary" size="icon" className="hover:bg-muted">
                <Video className="size-5 text-muted-foreground" />
              </Button>

              <Button variant="secondary" size="icon" className="gap-2 px-3">
                <MonitorUp className="size-5" />
                <span className="hidden sm:inline">Compartir</span>
              </Button>

              {/* Mobile-only chat toggle in floating controls (keeps it reachable) */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileChatOpen(true)}
                aria-label="Abrir chat"
              >
                <MessageSquare className="size-5" />
              </Button>

              <div className="w-px h-8 bg-border mx-1" />
              <Button variant="destructive" size="icon" className="gap-2">
                <PhoneMissed className="size-5" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </div>
          </div>

          {/* Participants strip */}
          <div className="flex h-24 shrink-0 items-center gap-3 overflow-x-auto rounded-xl border bg-background p-3">
            <div className="flex h-full flex-col justify-center px-2 border-r mr-2">
              <Users className="size-5 text-muted-foreground mb-1" />
              <span className="text-xs font-medium text-muted-foreground">{participants.length}</span>
            </div>

            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No hay participantes aún...</p>
            ) : (
              participants.map((p) => (
                <div key={p.id} className="relative flex h-full min-w-[120px] max-w-[160px] flex-col items-center justify-center rounded-lg bg-card border px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                    <UserIcon className="size-4" />
                  </div>
                  <span className="mt-2 truncate w-full text-center text-xs font-medium">{p.name}</span>
                  {p.role === "admin" && <ShieldCheck className="absolute top-2 right-2 size-3 text-primary" />}
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Chat (desktop) OR mobile full-screen overlay when open */}
        <aside
          className={`${
            isMobileChatOpen ? "absolute inset-0 z-50 flex" : "hidden"
          } w-full flex-col overflow-hidden border bg-background lg:static lg:flex lg:w-80 lg:rounded-2xl lg:border shadow-lg`}
          aria-hidden={!isMobileChatOpen && typeof window !== "undefined" && window.innerWidth < 1024}
        >
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-muted-foreground" />
              <h2 className="font-semibold">Chat de la sala</h2>
            </div>

            {/* Close button only on mobile overlay */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setIsMobileChatOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{msg.text}</span>
                  </div>
                )
              }

              // soporta distintos formatos: { userUid, displayName, text } o legacy { user, text }
              const msgUid = (msg as any).userUid ?? (msg as any).uid ?? undefined
              const msgName = (msg as any).displayName ?? (msg as any).name ?? (msg as any).user ?? "Anon"
              const myUid = authUser?.uid
              const isMine = Boolean(msgUid && myUid && msgUid === myUid)

              const displayName = isMine ? "Tú" : msgName

              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                  <div className={`flex flex-col ${isMine ? "items-start" : "items-end"} max-w-[90%]`}>
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">{displayName}</span>
                    <div className="rounded-2xl bg-card p-2 text-sm">{msg.text}</div>
                    {msg.createdAt ? <span className="mt-1 text-[10px] text-muted-foreground">{msg.createdAt}</span> : null}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3 bg-card">
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage() }} className="flex gap-2">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="rounded-full h-10"
              />
              <Button type="submit" variant="default" size="icon" className="shrink-0 h-10 w-10 rounded-full">
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default RoomView
