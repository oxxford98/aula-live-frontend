import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Copy, Pencil, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"

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

  const handleCopyRoomId = async () => {
    if (!room?.id) {
      return
    }

    try {
      await navigator.clipboard.writeText(room.id)
      toast.success("ID copiado", {
        description: `El ID ${room.id} se copio al portapapeles.`,
        duration: 10000,
      })
    } catch {
      toast.error("No se pudo copiar el ID", {
        description: "Intenta copiarlo manualmente.",
        duration: 10000,
      })
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadRoom = async () => {
      if (!authUser || !roomId) {
        return
      }

      setIsLoading(true)
      try {
        const idToken = await authUser.getIdToken()
        const response = await getRoomById(roomId, idToken)
        if (!cancelled) {
          setRoom(response.room)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("No se pudo abrir la sala", {
            description: toUserMessage(error, "profile"),
            duration: 10000,
          })
          navigate("/dashboard", { replace: true })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadRoom()

    return () => {
      cancelled = true
    }
  }, [authUser, navigate, roomId])

  const handleStartEditRoomName = () => {
    if (!room) {
      return
    }

    setRoomNameDraft(room.name)
    setRoomDescriptionDraft(room.description)
    setIsEditingRoomName(true)
  }

  const handleCancelEditRoomName = () => {
    setIsEditingRoomName(false)
    setRoomNameDraft("")
    setRoomDescriptionDraft("")
  }

  const handleSaveRoomName = async () => {
    if (!room || !authUser) {
      return
    }

    const nextName = roomNameDraft.trim()
    if (!nextName) {
      toast.error("No se pudo actualizar la sala", {
        description: "El nombre de la sala es obligatorio",
        duration: 10000,
      })
      return
    }

    const nextDescription = roomDescriptionDraft.trim()
    if (!nextDescription) {
      toast.error("No se pudo actualizar la sala", {
        description: "La descripcion de la sala es obligatoria",
        duration: 10000,
      })
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
      toast.success("Sala actualizada", {
        description: "El nombre y la descripcion se actualizaron correctamente.",
        duration: 10000,
      })
    } catch (error) {
      toast.error("No se pudo actualizar la sala", {
        description: toUserMessage(error, "profile"),
        duration: 10000,
      })
    } finally {
      setIsSavingRoomName(false)
    }
  }

  const handleDeleteRoom = async () => {
    if (!room || !authUser) {
      return
    }

    setIsDeletingRoom(true)
    try {
      const idToken = await authUser.getIdToken()
      await deleteRoomById(room.id, idToken)
      toast.success("Sala eliminada", {
        description: "La sala fue eliminada correctamente.",
        duration: 10000,
      })
      navigate("/dashboard", { replace: true })
    } catch (error) {
      toast.error("No se pudo eliminar la sala", {
        description: toUserMessage(error, "profile"),
        duration: 10000,
      })
      setIsDeletingRoom(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button asChild variant="outline" type="button">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 size-4" />
            Volver al dashboard
          </Link>
        </Button>
      </div>

      <Card className="border-border/70 bg-card/75">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {isEditingRoomName ? (
                <div className="min-w-64 space-y-2">
                  <Input value={roomNameDraft} onChange={(event) => setRoomNameDraft(event.target.value)} disabled={isSavingRoomName} />
                  <Input
                    value={roomDescriptionDraft}
                    onChange={(event) => setRoomDescriptionDraft(event.target.value)}
                    disabled={isSavingRoomName}
                    placeholder="Descripcion de la sala"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => void handleSaveRoomName()} disabled={isSavingRoomName}>
                      {isSavingRoomName ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelEditRoomName} disabled={isSavingRoomName}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <CardTitle className="text-3xl">{isLoading ? "Cargando sala..." : room?.name ?? "Sala"}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{room?.description || "Sin descripcion"}</p>
                </div>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <ShieldCheck className="size-4" />
                {isCreator ? "Administrador" : "Participante"}
              </span>
            </div>

            <div className="flex flex-col items-end gap-2">
              {isCreator && !isEditingRoomName ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleStartEditRoomName}>
                    <Pencil className="mr-2 size-4" />
                    Editar sala
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" disabled={isDeletingRoom}>
                        <Trash2 className="mr-2 size-4" />
                        {isDeletingRoom ? "Eliminando..." : "Eliminar sala"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta accion eliminara la sala de forma permanente. No se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel type="button" disabled={isDeletingRoom}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction type="button" disabled={isDeletingRoom} onClick={() => void handleDeleteRoom()}>
                          Si, eliminar sala
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 shadow-sm shadow-primary/20">
                <p className="font-mono text-xs font-semibold tracking-[0.2em] text-primary">{room?.id ?? "--- --- ---"}</p>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => void handleCopyRoomId()} disabled={isLoading || !room?.id}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="mt-6 border-border/70 bg-card/75">
        <CardHeader>
          <CardTitle className="text-lg">Participantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              No hay participantes en la sala
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
