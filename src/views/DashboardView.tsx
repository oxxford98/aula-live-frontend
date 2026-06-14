import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import type { User } from "firebase/auth"
import {
  Copy,
  Keyboard,
  LayoutDashboard,
  LogIn,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  createRoom,
  deleteRoomById,
  getMyRooms,
  updateRoomById,
  type Room,
  type UserProfile,
} from "@/lib/api-client"
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
  const [joinRoomCode, setJoinRoomCode] = useState("")
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

  const validateRoomName = (value: string) => {
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

  const validateRoomDescription = (value: string) => {
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

    setFieldErrors((previous) => ({
      ...previous,
      createName: undefined,
      createDescription: undefined,
    }))
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

  const handleJoinRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const code = joinRoomCode.trim()
    if (!code) {
      toast.error("Debes ingresar el código de la sala")
      return
    }

    setJoinRoomCode("")
    navigate(`/rooms/${code}`)
  }

  const startEditingRoom = (room: Room) => {
    setEditingRoomId(room.id)
    setEditingRoomName(room.name)
    setEditingRoomDescription(room.description)
    setFieldErrors((previous) => ({
      ...previous,
      editName: undefined,
      editDescription: undefined,
    }))
    setIsEditDialogOpen(true)
  }

  const cancelEditingRoom = () => {
    setIsEditDialogOpen(false)
    setEditingRoomId(null)
    setEditingRoomName("")
    setEditingRoomDescription("")
    setFieldErrors((previous) => ({
      ...previous,
      editName: undefined,
      editDescription: undefined,
    }))
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
      setRooms((previous) =>
        previous.map((room) => (room.id === roomId ? response.room : room))
      )
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
    <main className="min-h-screen w-full bg-background text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Bienvenido{profile ? `, ${profile.firstName}` : ""}. Desde aquí puedes crear y gestionar tus salas de estudio.
              </p>
            </div>
          </div>
        </header>

        <section className="mb-10 rounded-2xl border bg-card/75 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <form
              onSubmit={handleJoinRoom}
              className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:flex-1"
            >
              <div className="relative flex-1">
                <Keyboard className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  id="join-room-code"
                  className="pl-11"
                  placeholder="Pega el código de la sala (Ej: IJS-NES-DLO)"
                  value={joinRoomCode}
                  onChange={(event) => setJoinRoomCode(event.target.value)}
                />
              </div>

              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto gap-2 font-semibold"
                disabled={!joinRoomCode.trim()}
              >
                <LogIn className="size-4" />
                Unirse
              </Button>
            </form>

            <div className="hidden sm:block h-10 w-px bg-slate-800" />

            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto gap-2 font-semibold"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="size-5" />
              Crear sala
            </Button>
          </div>
        </section>

        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-100">
              Tus salas gestionadas
            </h2>
          </div>

          {!isLoadingRooms && (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
              {rooms.length} salas
            </span>
          )}
        </section>

        {isLoadingRooms ? (
          <div className="rounded-[28px] border border-slate-800 bg-slate-950/70 p-8 text-center text-sm text-slate-500">
            Cargando tus salas...
          </div>
        ) : emptyState ? (
          <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-900/60 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/60">
              <Plus className="size-8 text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-slate-300">
              Aún no has creado salas
            </h3>
            <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500">
              Usa el botón "Crear sala" para empezar a organizar tus espacios de estudio.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                Crear mi primera sala
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => {
              const isBusy = busyRoomId === room.id

              return (
                <div
                  key={room.id}
                  className="group flex flex-col justify-between gap-4 rounded-xl border bg-card/75 p-5 transition hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-md"
                >
                  <div>
                    <h3 className="text-lg font-medium text-slate-100 group-hover:text-blue-400 transition-colors truncate">
                      {room.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                      {room.description}
                    </p>

                    <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-400">
                      <span className="text-xs uppercase tracking-wider text-slate-500">
                        ID:
                      </span>
                      <span className="font-mono text-xs text-slate-300">
                        {room.id}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-slate-200"
                        onClick={() => void handleCopyRoomId(room.id)}
                        title="Copiar ID"
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex w-full items-center gap-2 pt-4 border-t border-slate-800 mt-auto">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-slate-900"
                      onClick={() => navigate(`/rooms/${room.id}`)}
                      disabled={isBusy}
                    >
                      Entrar
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="bg-slate-900"
                      onClick={() => startEditingRoom(room)}
                      disabled={isBusy}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          disabled={isBusy}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar sala</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará la sala {room.name} ({room.id}) de forma permanente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel type="button" disabled={isBusy}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteRoom(room.id)}
                          >
                            {isBusy ? "Eliminando..." : "Sí, eliminar sala"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            setFieldErrors((previous) => ({
              ...previous,
              createName: undefined,
              createDescription: undefined,
            }))
          }
        }}
      >
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Sala</DialogTitle>
            <DialogDescription>
              Ingresa un nombre y descripcion para crear un nuevo espacio como anfitrion.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateRoom} noValidate>
            <div className="space-y-2">
              <label htmlFor="create-room-name" className="text-sm font-medium text-slate-200">
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
              {fieldErrors.createName ? (
                <p className="text-xs text-destructive">{fieldErrors.createName}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="create-room-description" className="text-sm font-medium text-slate-200">
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
              {fieldErrors.createDescription ? (
                <p className="text-xs text-destructive">{fieldErrors.createDescription}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreatingRoom}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreatingRoom}>
                {isCreatingRoom ? "Creando sala..." : "Crear sala"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => (open ? setIsEditDialogOpen(true) : cancelEditingRoom())}
      >
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
              <label htmlFor="edit-room-name" className="text-sm font-medium text-slate-200">
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
              {fieldErrors.editName ? (
                <p className="text-xs text-destructive">{fieldErrors.editName}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-room-description" className="text-sm font-medium text-slate-200">
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
              {fieldErrors.editDescription ? (
                <p className="text-xs text-destructive">{fieldErrors.editDescription}</p>
              ) : null}
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
