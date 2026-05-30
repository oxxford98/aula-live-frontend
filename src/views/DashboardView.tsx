import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import { Copy, Pencil, Plus, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createRoom, deleteRoomById, getMyRooms, updateRoomById, type Room, type UserProfile } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"

type DashboardViewProps = {
  profile: UserProfile | null
  authUser: User | null
}

type RoomFieldErrors = {
  createName?: string
  createDescription?: string
  editName?: string
  editDescription?: string
}

export function DashboardView({ profile, authUser }: DashboardViewProps) {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [createRoomName, setCreateRoomName] = useState("")
  const [createRoomDescription, setCreateRoomDescription] = useState("")
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingRoomName, setEditingRoomName] = useState("")
  const [editingRoomDescription, setEditingRoomDescription] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<RoomFieldErrors>({})
  const [isLoadingRooms, setIsLoadingRooms] = useState(true)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadRooms = async () => {
      if (!authUser) {
        return
      }

      setIsLoadingRooms(true)
      try {
        const idToken = await authUser.getIdToken()
        const response = await getMyRooms(idToken)
        if (!cancelled) {
          setRooms(response.rooms)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("No se pudieron cargar tus salas", {
            description: toUserMessage(error, "profile"),
            duration: 10000,
          })
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRooms(false)
        }
      }
    }

    void loadRooms()

    return () => {
      cancelled = true
    }
  }, [authUser])

  const validateRoomName = (value: string): string | undefined => {
    const trimmed = value.trim()

    if (!trimmed) {
      return "El nombre de la sala es obligatorio"
    }

    if (trimmed.length < 3) {
      return "El nombre de la sala debe tener al menos 3 caracteres"
    }

    if (trimmed.length > 80) {
      return "El nombre de la sala no puede superar los 80 caracteres"
    }

    return undefined
  }

  const validateRoomDescription = (value: string): string | undefined => {
    const trimmed = value.trim()

    if (!trimmed) {
      return "La descripcion de la sala es obligatoria"
    }

    if (trimmed.length < 3) {
      return "La descripcion de la sala debe tener al menos 3 caracteres"
    }

    if (trimmed.length > 240) {
      return "La descripcion de la sala no puede superar los 240 caracteres"
    }

    return undefined
  }

  const withIdToken = async () => {
    if (!authUser) {
      throw new Error("No hay sesion activa")
    }

    return authUser.getIdToken()
  }

  const handleCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const createNameError = validateRoomName(createRoomName)
    const createDescriptionError = validateRoomDescription(createRoomDescription)

    if (createNameError || createDescriptionError) {
      setFieldErrors((previous) => ({
        ...previous,
        createName: createNameError,
        createDescription: createDescriptionError,
      }))
      toast.error("No se pudo crear la sala", {
        description: createNameError || createDescriptionError,
        duration: 10000,
      })
      return
    }

    setFieldErrors((previous) => ({ ...previous, createName: undefined, createDescription: undefined }))
    setIsCreatingRoom(true)
    try {
      const idToken = await withIdToken()
      const response = await createRoom(idToken, {
        name: createRoomName.trim(),
        description: createRoomDescription.trim(),
      })
      setRooms((previous) => [response.room, ...previous])
      setCreateRoomName("")
      setCreateRoomDescription("")
      setIsCreateDialogOpen(false)
      toast.success("Sala creada correctamente", {
        description: `Entrando a ${response.room.name} (${response.room.id})`,
        duration: 10000,
      })
      navigate(`/rooms/${response.room.id}`)
    } catch (error) {
      toast.error("No se pudo crear la sala", {
        description: toUserMessage(error, "profile"),
        duration: 10000,
      })
    } finally {
      setIsCreatingRoom(false)
    }
  }

  const startEditingRoom = (room: Room) => {
    setEditingRoomId(room.id)
    setEditingRoomName(room.name)
    setEditingRoomDescription(room.description)
    setFieldErrors((previous) => ({ ...previous, editName: undefined, editDescription: undefined }))
    setIsEditDialogOpen(true)
  }

  const cancelEditingRoom = () => {
    setIsEditDialogOpen(false)
    setEditingRoomId(null)
    setEditingRoomName("")
    setEditingRoomDescription("")
    setFieldErrors((previous) => ({ ...previous, editName: undefined, editDescription: undefined }))
  }

  const handleSaveRoomName = async (roomId: string) => {
    const editNameError = validateRoomName(editingRoomName)
    const editDescriptionError = validateRoomDescription(editingRoomDescription)

    if (editNameError || editDescriptionError) {
      setFieldErrors((previous) => ({
        ...previous,
        editName: editNameError,
        editDescription: editDescriptionError,
      }))
      toast.error("No se pudo actualizar la sala", {
        description: editNameError || editDescriptionError,
        duration: 10000,
      })
      return
    }

    setBusyRoomId(roomId)
    try {
      const idToken = await withIdToken()
      const response = await updateRoomById(roomId, idToken, {
        name: editingRoomName.trim(),
        description: editingRoomDescription.trim(),
      })
      setRooms((previous) => previous.map((room) => (room.id === roomId ? response.room : room)))
      cancelEditingRoom()
      toast.success("Sala actualizada", {
        description: "El nuevo nombre se reflejo correctamente en tu dashboard.",
        duration: 10000,
      })
    } catch (error) {
      toast.error("No se pudo actualizar la sala", {
        description: toUserMessage(error, "profile"),
        duration: 10000,
      })
    } finally {
      setBusyRoomId(null)
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    setBusyRoomId(roomId)
    try {
      const idToken = await withIdToken()
      await deleteRoomById(roomId, idToken)
      setRooms((previous) => previous.filter((room) => room.id !== roomId))
      toast.success("Sala eliminada", {
        description: "La sala fue eliminada correctamente.",
        duration: 10000,
      })
    } catch (error) {
      toast.error("No se pudo eliminar la sala", {
        description: toUserMessage(error, "profile"),
        duration: 10000,
      })
    } finally {
      setBusyRoomId(null)
    }
  }

  const handleCopyRoomId = async (roomId: string) => {
    try {
      await navigator.clipboard.writeText(roomId)
      toast.success("ID copiado", {
        description: `El ID ${roomId} se copio al portapapeles.`,
        duration: 10000,
      })
    } catch {
      toast.error("No se pudo copiar el ID", {
        description: "Intenta copiarlo manualmente.",
        duration: 10000,
      })
    }
  }

  const emptyState = !isLoadingRooms && rooms.length === 0

  const activeEditRoom = rooms.find((room) => room.id === editingRoomId) ?? null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-10 sm:px-6 lg:px-8 lg:pt-16">
      <Card className="border-border/70 bg-card/75">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-3xl">Dashboard</CardTitle>
            <CardDescription>
              Bienvenido{profile ? `, ${profile.firstName}` : ""}. Desde aqui puedes crear y gestionar tus salas de estudio.
            </CardDescription>
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open)
              if (!open) {
                setFieldErrors((previous) => ({ ...previous, createName: undefined, createDescription: undefined }))
              }
            }}
          >
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="mr-2 size-4" />
                Crear sala
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Sala</DialogTitle>
                <DialogDescription>Ingresa un nombre y descripcion para crear un nuevo espacio como anfitrion.</DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleCreateRoom} noValidate>
                <div className="space-y-2">
                  <label htmlFor="create-room-name" className="text-sm font-medium">
                    Nombre de la sala
                  </label>
                  <Input
                    id="create-room-name"
                    placeholder="Ej. Sala de Algebra"
                    value={createRoomName}
                    onChange={(event) => {
                      setCreateRoomName(event.target.value)
                      setFieldErrors((previous) => ({ ...previous, createName: undefined }))
                    }}
                    aria-invalid={Boolean(fieldErrors.createName)}
                  />
                  {fieldErrors.createName ? <p className="text-xs text-destructive">{fieldErrors.createName}</p> : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="create-room-description" className="text-sm font-medium">
                    Descripcion de la sala
                  </label>
                  <Input
                    id="create-room-description"
                    placeholder="Ej. Resolucion de guias y dudas en vivo"
                    value={createRoomDescription}
                    onChange={(event) => {
                      setCreateRoomDescription(event.target.value)
                      setFieldErrors((previous) => ({ ...previous, createDescription: undefined }))
                    }}
                    aria-invalid={Boolean(fieldErrors.createDescription)}
                  />
                  {fieldErrors.createDescription ? <p className="text-xs text-destructive">{fieldErrors.createDescription}</p> : null}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreatingRoom}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreatingRoom}>
                    {isCreatingRoom ? "Creando sala..." : "Crear sala"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoadingRooms ? (
            <div className="rounded-xl border border-border/60 bg-background/50 p-5 text-sm text-muted-foreground">Cargando tus salas...</div>
          ) : emptyState ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-6 text-sm text-muted-foreground">
              Aun no has creado salas. Usa el boton Crear sala para abrir el formulario.
            </div>
          ) : (
            <div className="grid gap-4">
              {rooms.map((room) => {
                const isBusy = busyRoomId === room.id

                return (
                  <Card key={room.id} className="border-border/60 bg-background/45 py-0">
                    <CardContent className="flex flex-col gap-4 px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="text-xl font-semibold">{room.name}</h3>
                          <p className="text-sm text-muted-foreground">{room.description}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <p>ID: {room.id}</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => void handleCopyRoomId(room.id)}
                              disabled={isBusy}
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" onClick={() => navigate(`/rooms/${room.id}`)} disabled={isBusy}>
                            Entrar
                          </Button>
                          <Button type="button" variant="outline" onClick={() => startEditingRoom(room)} disabled={isBusy}>
                            <Pencil className="mr-2 size-4" />
                            Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="destructive" disabled={isBusy}>
                                <Trash2 className="mr-2 size-4" />
                                Eliminar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta accion eliminara la sala {room.name} ({room.id}) de forma permanente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel type="button" disabled={isBusy}>
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction type="button" disabled={isBusy} onClick={() => void handleDeleteRoom(room.id)}>
                                  {isBusy ? "Eliminando..." : "Si, eliminar sala"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => (open ? setIsEditDialogOpen(true) : cancelEditingRoom())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sala</DialogTitle>
            <DialogDescription>
              Modifica los datos de la sala {activeEditRoom ? `${activeEditRoom.name} (${activeEditRoom.id})` : ""}.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!editingRoomId) {
                return
              }

              void handleSaveRoomName(editingRoomId)
            }}
            noValidate
          >
            <div className="space-y-2">
              <label htmlFor="edit-room-name" className="text-sm font-medium">
                Nombre de la sala
              </label>
              <Input
                id="edit-room-name"
                value={editingRoomName}
                onChange={(event) => {
                  setEditingRoomName(event.target.value)
                  setFieldErrors((previous) => ({ ...previous, editName: undefined }))
                }}
                aria-invalid={Boolean(fieldErrors.editName)}
              />
              {fieldErrors.editName ? <p className="text-xs text-destructive">{fieldErrors.editName}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-room-description" className="text-sm font-medium">
                Descripcion de la sala
              </label>
              <Input
                id="edit-room-description"
                value={editingRoomDescription}
                onChange={(event) => {
                  setEditingRoomDescription(event.target.value)
                  setFieldErrors((previous) => ({ ...previous, editDescription: undefined }))
                }}
                aria-invalid={Boolean(fieldErrors.editDescription)}
              />
              {fieldErrors.editDescription ? <p className="text-xs text-destructive">{fieldErrors.editDescription}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={cancelEditingRoom} disabled={Boolean(editingRoomId && busyRoomId === editingRoomId)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!editingRoomId || busyRoomId === editingRoomId}>
                {editingRoomId && busyRoomId === editingRoomId ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
