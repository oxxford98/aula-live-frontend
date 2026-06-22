import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
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
  MicOff,
  Video,
  VideoOff,
  Pin,
  PinOff,
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
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { deleteRoomById, getRoomById, markRoomAsJoined, updateRoomById, type Room, type UserProfile } from "@/lib/api-client"
import { toUserMessage } from "@/lib/error-messages"

type RoomViewProps = {
  authUser: User | null
  profile: UserProfile | null
}

type ChatMessage = {
  id: number | string
  user?: string
  userUid?: string
  uid?: string
  displayName?: string
  name?: string
  text: string
  isSystem?: boolean
  createdAt?: string
}

type ChatParticipant = {
  id: string
  uid?: string
  name: string
  role?: "admin" | "participant"
  isSpeaking?: boolean
  avatarUrl?: string | null
}

type PeerMediaState = {
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
}

type Peer = {
  id: string
  uid?: string
  name: string
  role?: "admin" | "participant"
  avatarUrl?: string | null
}

type MediaStateEvent = {
  peerId: string
  audioEnabled: boolean
  videoEnabled: boolean
  screenSharing: boolean
}

type SignalOfferPayload = {
  roomId: string
  fromPeerId: string
  sdp: RTCSessionDescriptionInit
}

type SignalAnswerPayload = {
  roomId: string
  fromPeerId: string
  sdp: RTCSessionDescriptionInit
}

type SignalIcePayload = {
  roomId: string
  fromPeerId: string
  candidate: RTCIceCandidateInit
}

type JoinRoomAck = {
  ok: boolean
  messages?: ChatMessage[]
  participants?: ChatParticipant[]
  selfPeerId?: string
  peers?: Peer[]
  mediaStates?: Array<MediaStateEvent>
  error?: string
}

type SendMessageAck = {
  ok: boolean
  message?: ChatMessage
  error?: string
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
}

const defaultPeerMediaState = (): PeerMediaState => ({
  audioEnabled: false,
  videoEnabled: false,
  screenSharing: false,
})

const isScreenShareSupported = (): boolean => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return false
  }

  const ua = navigator.userAgent || ""
  const isIOSLike = /iPad|iPhone|iPod/i.test(ua)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  // iOS/iPadOS browsers run on WebKit and screen share support is still limited.
  return !isIOSLike
}

const toMediaErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "No se pudo acceder a cámara/micrófono. Revisa permisos del navegador."
  }

  const name = (error as DOMException).name
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permiso denegado para cámara/micrófono o contexto inseguro (usa https o localhost)."
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No se detectó cámara o micrófono en tu equipo."
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Cámara/micrófono en uso por otra app. Cierra la app que los esté usando e intenta de nuevo."
  }
  if (name === "OverconstrainedError") {
    return "No se pudo iniciar cámara/micrófono con la configuración solicitada."
  }

  return "No se pudo acceder a cámara/micrófono. Revisa permisos del navegador."
}

const normalizeParticipants = (items: ChatParticipant[]): ChatParticipant[] => {
  const byIdentity = new Map<string, ChatParticipant>()

  for (const item of items) {
    const key = item.uid || item.id
    byIdentity.set(key, item)
  }

  return Array.from(byIdentity.values())
}

function VideoTile({
  stream,
  name,
  avatarUrl,
  muted,
  mediaState,
  isLocal,
  isPinned,
  onTogglePin,
  compact,
}: {
  stream: MediaStream | null
  name: string
  avatarUrl?: string | null
  muted: boolean
  mediaState: PeerMediaState
  isLocal: boolean
  isPinned?: boolean
  onTogglePin?: () => void
  compact?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const node = videoRef.current
    if (!node) return

    const tryPlay = () => {
      void node.play().catch(() => {
        // Ignore autoplay errors; playback usually resumes after user interaction.
      })
    }

    node.srcObject = stream
    tryPlay()

    const handleTrackGraphChange = () => {
      if (node.srcObject !== stream) {
        node.srcObject = stream
      }
      tryPlay()
    }

    if (stream) {
      stream.addEventListener("addtrack", handleTrackGraphChange)
      stream.addEventListener("removetrack", handleTrackGraphChange)
    }

    return () => {
      if (stream) {
        stream.removeEventListener("addtrack", handleTrackGraphChange)
        stream.removeEventListener("removetrack", handleTrackGraphChange)
      }
      if (node.srcObject === stream) {
        node.srcObject = null
      }
    }
  }, [stream])

  return (
    <article className="relative h-full min-h-0 overflow-hidden rounded-xl border bg-card">
      {onTogglePin ? (
        <button
          type="button"
          onClick={onTogglePin}
          className="absolute right-2 top-2 z-20 rounded-md border bg-background/85 p-1.5 text-foreground hover:bg-background"
          aria-label={isPinned ? "Desfijar participante" : "Fijar participante"}
          title={isPinned ? "Desfijar" : "Fijar"}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
      ) : null}

      {stream ? (
        // WebRTC streams are live and do not provide static caption tracks.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full min-h-0 ${compact ? "min-h-24 lg:min-h-0" : "min-h-40 lg:min-h-0"} w-full ${mediaState.screenSharing ? "object-contain bg-black" : "object-cover"} ${mediaState.videoEnabled ? "" : "opacity-20"}`}
        />
      ) : (
        <div className={`flex h-full min-h-0 ${compact ? "min-h-24 lg:min-h-0" : "min-h-40 lg:min-h-0"} w-full items-center justify-center bg-muted/40`}>
          <UserIcon className="size-10 text-muted-foreground" />
        </div>
      )}

      {!mediaState.videoEnabled ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${isLocal ? "Tu" : name}`}
              className={`${compact ? "size-16 lg:size-14" : "size-24 lg:size-20"} relative z-10 rounded-full border border-border/70 object-cover shadow-md`}
            />
          ) : (
            <div className={`${compact ? "size-16 lg:size-14" : "size-24 lg:size-20"} relative z-10 flex items-center justify-center rounded-full bg-muted text-muted-foreground`}>
              <UserIcon className={`${compact ? "size-7 lg:size-6" : "size-10 lg:size-8"}`} />
            </div>
          )}
        </div>
      ) : null}

      <footer className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-md bg-background/75 px-2 py-1 text-xs">
        <span className="truncate font-medium">{isLocal ? "Tu" : name}</span>
        <span className="flex items-center gap-1">
          {mediaState.audioEnabled ? <Mic className="size-3.5" /> : <MicOff className="size-3.5 text-destructive" />}
          {!mediaState.videoEnabled ? <VideoOff className="size-3.5 text-destructive" /> : null}
          {mediaState.screenSharing ? <MonitorUp className="size-3.5 text-primary" /> : null}
        </span>
      </footer>
    </article>
  )
}

function RemoteAudioSink({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const node = audioRef.current
    if (!node) return

    node.srcObject = stream
    const tryPlay = () => {
      void node.play().catch(() => {
        // Ignore autoplay errors; next user interaction usually resumes playback.
      })
    }

    tryPlay()
    node.onloadedmetadata = tryPlay

    return () => {
      node.onloadedmetadata = null
      if (node.srcObject === stream) {
        node.srcObject = null
      }
    }
  }, [stream])

  // WebRTC streams are live and do not provide static caption tracks.
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />
}

export function RoomView({ authUser, profile }: RoomViewProps) {
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
    ChatMessage[]
  >([{ id: 1, user: "Sistema", text: "Bienvenido a la sala.", isSystem: true }])
  const [participants, setParticipants] = useState<ChatParticipant[]>([])
  const [selfPeerId, setSelfPeerId] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [localMediaState, setLocalMediaState] = useState<PeerMediaState>({
    audioEnabled: false,
    videoEnabled: false,
    screenSharing: false,
  })
  const [peerMediaStates, setPeerMediaStates] = useState<Record<string, PeerMediaState>>({})
  const [remoteStreams, setRemoteStreams] = useState<Array<{ peerId: string; stream: MediaStream }>>([])
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null)
  const [pinnedTileId, setPinnedTileId] = useState<string | null>(null)
  const [hasCameraAvailable, setHasCameraAvailable] = useState(true)

  const socketRef = useRef<Socket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const socketConnectionRunRef = useRef(0)
  const selfPeerIdRef = useRef<string | null>(null)
  const localMediaStateRef = useRef<PeerMediaState>(localMediaState)
  const pendingMediaRequestRef = useRef<Promise<void> | null>(null)
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL as string | undefined
  const canShareScreen = useMemo(() => isScreenShareSupported(), [])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const logMediaDebug = (...args: unknown[]) => {
    console.log("[RoomView:media]", ...args)
  }

  const participantsById = useMemo(() => {
    const map = new Map<string, ChatParticipant>()
    for (const participant of participants) {
      map.set(participant.id, participant)
    }
    return map
  }, [participants])

  const remoteStreamsByPeerId = useMemo(() => {
    const map = new Map<string, MediaStream>()
    for (const entry of remoteStreams) {
      map.set(entry.peerId, entry.stream)
    }
    return map
  }, [remoteStreams])

  const updatePeerMediaState = (peerId: string, next: Partial<PeerMediaState>) => {
    setPeerMediaStates((previous) => {
      const current = previous[peerId] || defaultPeerMediaState()
      return {
        ...previous,
        [peerId]: {
          ...current,
          ...next,
        },
      }
    })
  }

  const refreshRemoteStreams = () => {
    setRemoteStreams(
      Array.from(remoteStreamsRef.current.entries()).map(([peerId, stream]) => ({
        peerId,
        stream,
      }))
    )
  }

  const cleanupPeerConnection = (peerId: string) => {
    const connection = peerConnectionsRef.current.get(peerId)
    if (connection) {
      connection.ontrack = null
      connection.onicecandidate = null
      connection.onconnectionstatechange = null
      connection.close()
      peerConnectionsRef.current.delete(peerId)
    }

    pendingCandidatesRef.current.delete(peerId)
    remoteStreamsRef.current.delete(peerId)
    setPeerMediaStates((previous) => {
      if (!previous[peerId]) {
        return previous
      }
      const next = { ...previous }
      delete next[peerId]
      return next
    })
    refreshRemoteStreams()
  }

  const getPreferredAudioTrack = (): MediaStreamTrack | null => {
    const track = localStreamRef.current?.getAudioTracks()[0] || null
    if (!track || track.readyState === "ended") {
      return null
    }
    return track
  }

  const getPreferredVideoTrack = (): { track: MediaStreamTrack | null; source: MediaStream | null } => {
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0] || null
    if (screenTrack && screenStreamRef.current) {
      return { track: screenTrack, source: screenStreamRef.current }
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null
    return {
      track: cameraTrack,
      source: localStreamRef.current,
    }
  }

  const ensureMicrophoneTrack = async (): Promise<MediaStreamTrack | null> => {
    const current = getPreferredAudioTrack()
    if (current) {
      return current
    }

    try {
      const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recoveredAudioTrack = audioOnlyStream.getAudioTracks()[0] || null
      if (!recoveredAudioTrack) {
        return null
      }

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream()
      }

      const oldAudioTrack = localStreamRef.current.getAudioTracks()[0]
      if (oldAudioTrack) {
        localStreamRef.current.removeTrack(oldAudioTrack)
        oldAudioTrack.stop()
      }

      localStreamRef.current.addTrack(recoveredAudioTrack)
      return recoveredAudioTrack
    } catch {
      return null
    }
  }

  const flushPendingCandidates = async (peerId: string) => {
    const connection = peerConnectionsRef.current.get(peerId)
    if (!connection || !connection.remoteDescription) {
      return
    }

    const pending = pendingCandidatesRef.current.get(peerId) || []
    pendingCandidatesRef.current.delete(peerId)

    for (const candidate of pending) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Ignore stale candidates after renegotiation.
      }
    }
  }

  const ensurePeerConnection = (peerId: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerId)
    if (existing) {
      return existing
    }

    const connection = new RTCPeerConnection(rtcConfig)
    peerConnectionsRef.current.set(peerId, connection)

    const audioTrack = getPreferredAudioTrack()
    const { track: videoTrack, source: videoSource } = getPreferredVideoTrack()

    if (audioTrack && localStreamRef.current) {
      connection.addTrack(audioTrack, localStreamRef.current)
    }

    if (videoTrack && videoSource) {
      connection.addTrack(videoTrack, videoSource)
    }

    // Garantiza que podamos recibir A/V aunque no publiquemos ambos tracks locales.
    if (!audioTrack) {
      connection.addTransceiver("audio", { direction: "recvonly" })
    }

    if (!videoTrack) {
      connection.addTransceiver("video", { direction: "recvonly" })
    }

    connection.onicecandidate = (event) => {
      if (!event.candidate || !socketRef.current || !roomId) {
        return
      }

      socketRef.current.emit("webrtc_ice_candidate", {
        roomId,
        toPeerId: peerId,
        candidate: event.candidate.toJSON(),
      })
    }

    connection.ontrack = (event) => {
      const incomingTrack = event.track
      const currentStream = remoteStreamsRef.current.get(peerId) || new MediaStream()

      const sameKindTracks = incomingTrack.kind === "audio"
        ? currentStream.getAudioTracks()
        : currentStream.getVideoTracks()

      for (const track of sameKindTracks) {
        currentStream.removeTrack(track)
      }

      currentStream.addTrack(incomingTrack)
      remoteStreamsRef.current.set(peerId, currentStream)
      refreshRemoteStreams()
    }

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === "failed" || state === "closed" || state === "disconnected") {
        cleanupPeerConnection(peerId)
      }
    }

    return connection
  }

  const createOfferToPeer = async (peerId: string) => {
    if (!roomId || !socketRef.current) {
      return
    }

    const connection = ensurePeerConnection(peerId)
    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)

    if (connection.localDescription) {
      socketRef.current.emit("webrtc_offer", {
        roomId,
        toPeerId: peerId,
        sdp: connection.localDescription,
      })
    }
  }

  const renegotiatePeerVideoTrack = async (peerId: string, connection: RTCPeerConnection) => {
    if (!roomId || !socketRef.current || !socketRef.current.connected) {
      return
    }

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)

    if (connection.localDescription) {
      socketRef.current.emit("webrtc_offer", {
        roomId,
        toPeerId: peerId,
        sdp: connection.localDescription,
      })
    }
  }

  const replaceVideoTrackForAllPeers = async (nextTrack: MediaStreamTrack | null, sourceStream: MediaStream | null) => {
    const preferredAudioTrack = await ensureMicrophoneTrack()

    for (const [peerId, connection] of peerConnectionsRef.current.entries()) {
      let addedTrack = false

      const audioSender = connection.getSenders().find((sender) => sender.track?.kind === "audio")
      if (audioSender) {
        await audioSender.replaceTrack(preferredAudioTrack)
      } else if (preferredAudioTrack && localStreamRef.current) {
        connection.addTrack(preferredAudioTrack, localStreamRef.current)
        addedTrack = true
      }

      const videoSender = connection.getSenders().find((sender) => sender.track?.kind === "video")
      if (videoSender) {
        await videoSender.replaceTrack(nextTrack)
      } else if (nextTrack && sourceStream) {
        connection.addTrack(nextTrack, sourceStream)
        addedTrack = true
      }

      if (addedTrack) {
        await renegotiatePeerVideoTrack(peerId, connection)
      }
    }
  }

  const syncLocalTracksToAllPeers = async (stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0] || null
    const videoTrack = stream.getVideoTracks()[0] || null
    const socket = socketRef.current

    for (const [peerId, connection] of peerConnectionsRef.current.entries()) {
      let addedTrack = false

      const audioSender = connection.getSenders().find((sender) => sender.track?.kind === "audio")
      if (audioSender) {
        await audioSender.replaceTrack(audioTrack)
      } else if (audioTrack) {
        connection.addTrack(audioTrack, stream)
        addedTrack = true
      }

      const videoSender = connection.getSenders().find((sender) => sender.track?.kind === "video")
      if (videoSender) {
        await videoSender.replaceTrack(videoTrack)
      } else if (videoTrack) {
        connection.addTrack(videoTrack, stream)
        addedTrack = true
      }

      // Si la conexión se creó antes de tener tracks locales, forzamos renegociación.
      if (addedTrack && socket && socket.connected && roomId) {
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        if (connection.localDescription) {
          socket.emit("webrtc_offer", {
            roomId,
            toPeerId: peerId,
            sdp: connection.localDescription,
          })
        }
      }
    }
  }

  const emitLocalMediaState = (nextState: PeerMediaState) => {
    if (!roomId || !socketRef.current || !socketRef.current.connected) {
      return
    }

    socketRef.current.emit("media_state", {
      roomId,
      audioEnabled: nextState.audioEnabled,
      videoEnabled: nextState.videoEnabled,
      screenSharing: nextState.screenSharing,
    })
  }

  const stopScreenShare = async () => {
    const currentScreenStream = screenStreamRef.current
    if (!currentScreenStream) {
      return
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null
    await replaceVideoTrackForAllPeers(cameraTrack, localStreamRef.current)

    for (const track of currentScreenStream.getTracks()) {
      track.stop()
    }
    screenStreamRef.current = null

    setLocalPreviewStream(localStreamRef.current)

    const nextMediaState: PeerMediaState = {
      ...localMediaState,
      screenSharing: false,
      videoEnabled: Boolean(cameraTrack?.enabled),
      audioEnabled: Boolean(localStreamRef.current?.getAudioTracks()[0]?.enabled),
    }
    setLocalMediaState(nextMediaState)
    emitLocalMediaState(nextMediaState)
  }

  const handleToggleAudio = () => {
    const audioTracks = localStreamRef.current?.getAudioTracks() || []
    const audioTrack = audioTracks[0]
    logMediaDebug("Toggle audio", {
      localStream: Boolean(localStreamRef.current),
      audioTrackCount: audioTracks.length,
      tracks: audioTracks.map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })),
    })

    if (!audioTrack) {
      toast.error("No se detectó micrófono")
      void requestLocalMedia()
      return
    }

    audioTrack.enabled = !audioTrack.enabled
    const nextState: PeerMediaState = {
      ...localMediaState,
      audioEnabled: audioTrack.enabled,
    }
    setLocalMediaState(nextState)
    emitLocalMediaState(nextState)
  }

  const handleToggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (!videoTrack) {
      toast.error("No hay cámara disponible", {
        description: "Este dispositivo no tiene cámara activa o el navegador no pudo acceder a ella.",
      })
      return
    }

    videoTrack.enabled = !videoTrack.enabled
    const nextState: PeerMediaState = {
      ...localMediaState,
      videoEnabled: videoTrack.enabled,
    }
    setLocalMediaState(nextState)
    emitLocalMediaState(nextState)
  }

  const handleToggleScreenShare = async () => {
    if (!canShareScreen) {
      toast.error("Este navegador no permite compartir pantalla", {
        description: "En iPhone/iPad esta función suele estar bloqueada. Usa desktop para compartir pantalla.",
      })
      return
    }

    if (screenStreamRef.current) {
      await stopScreenShare()
      return
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = display.getVideoTracks()[0]
      if (!screenTrack) {
        display.getTracks().forEach((track) => track.stop())
        return
      }

      screenTrack.onended = () => {
        void stopScreenShare()
      }

      screenStreamRef.current = display
      await replaceVideoTrackForAllPeers(screenTrack, display)
      setLocalPreviewStream(display)

      const nextState: PeerMediaState = {
        ...localMediaState,
        screenSharing: true,
        videoEnabled: true,
      }
      setLocalMediaState(nextState)
      emitLocalMediaState(nextState)
    } catch {
      toast.error("No se pudo compartir pantalla")
    }
  }

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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    selfPeerIdRef.current = selfPeerId
  }, [selfPeerId])

  useEffect(() => {
    localMediaStateRef.current = localMediaState
  }, [localMediaState])

  const requestLocalMedia = async () => {
    if (pendingMediaRequestRef.current) {
      await pendingMediaRequestRef.current
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError("Tu navegador no soporta acceso a cámara/micrófono.")
      return
    }

    const runRequest = async () => {
      try {
        let stream: MediaStream | null = null
        let capturedAudio = false
        let capturedVideo = false

        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const hasVideoInput = devices.some((device) => device.kind === "videoinput")
          setHasCameraAvailable(hasVideoInput)
          logMediaDebug(
            "Dispositivos",
            devices.map((device) => ({ kind: device.kind, label: device.label || "(sin label)", id: device.deviceId }))
          )
        } catch (error) {
          logMediaDebug("No se pudo enumerar dispositivos", error)
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          capturedAudio = stream.getAudioTracks().length > 0
          capturedVideo = stream.getVideoTracks().length > 0
          logMediaDebug("A/V OK", {
            audio: stream.getAudioTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })),
            video: stream.getVideoTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })),
          })
        } catch (errorAV) {
          console.warn("No se pudo iniciar A/V juntos, intentando fallback", errorAV)
          logMediaDebug("A/V FAIL, fallback", errorAV)

          const fallback = new MediaStream()

          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            audioOnly.getAudioTracks().forEach((track) => fallback.addTrack(track))
            capturedAudio = fallback.getAudioTracks().length > 0
            logMediaDebug("Audio-only OK", fallback.getAudioTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })))
          } catch (errorAudio) {
            console.warn("Fallback audio-only falló", errorAudio)
            logMediaDebug("Audio-only FAIL", errorAudio)
          }

          try {
            const videoOnly = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
            videoOnly.getVideoTracks().forEach((track) => fallback.addTrack(track))
            capturedVideo = fallback.getVideoTracks().length > 0
            logMediaDebug("Video-only OK", fallback.getVideoTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })))
          } catch (errorVideo) {
            console.warn("Fallback video-only falló", errorVideo)
            logMediaDebug("Video-only FAIL", errorVideo)
            if (!capturedAudio) {
              throw errorVideo
            }
          }

          if (!capturedAudio && !capturedVideo) {
            throw errorAV
          }

          stream = fallback
        }

        if (!stream) {
          throw new Error("No stream available")
        }

        setHasCameraAvailable(capturedVideo)

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop())
        }

        localStreamRef.current = stream
        setLocalPreviewStream(stream)
        setMediaError(null)
        logMediaDebug("Stream local asignado", {
          audio: stream.getAudioTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })),
          video: stream.getVideoTracks().map((track) => ({ id: track.id, enabled: track.enabled, readyState: track.readyState })),
        })

        await syncLocalTracksToAllPeers(stream)

        const nextState: PeerMediaState = {
          audioEnabled: capturedAudio && Boolean(stream.getAudioTracks()[0]?.enabled),
          videoEnabled: capturedVideo && Boolean(stream.getVideoTracks()[0]?.enabled),
          screenSharing: false,
        }
        setLocalMediaState(nextState)
        emitLocalMediaState(nextState)

        if (!capturedAudio || !capturedVideo) {
          toast.error("Permisos parciales de media", {
            description: !capturedVideo
              ? "Micrófono activo, pero no se pudo iniciar cámara."
              : "Cámara activa, pero no se pudo iniciar micrófono.",
          })
        }
      } catch (error) {
        const message = toMediaErrorMessage(error)
        console.error("Error solicitando permisos de media:", error)
        logMediaDebug("requestLocalMedia ERROR", error)
        setMediaError(message)
        toast.error("No se pudo iniciar cámara/micrófono", {
          description: message,
        })
      }
    }

    pendingMediaRequestRef.current = runRequest()
    try {
      await pendingMediaRequestRef.current
    } finally {
      pendingMediaRequestRef.current = null
    }
  }

  useEffect(() => {
    let cancelled = false

    const startLocalMedia = async () => {
      if (!roomId) {
        return
      }

      await requestLocalMedia()

      if (cancelled) {
        localStreamRef.current?.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
        setLocalPreviewStream(null)
        const resetState = defaultPeerMediaState()
        setLocalMediaState(resetState)
        localMediaStateRef.current = resetState
      }
    }

    void startLocalMedia()

    return () => {
      cancelled = true
      for (const pc of peerConnectionsRef.current.values()) {
        pc.close()
      }
      peerConnectionsRef.current.clear()

      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          track.stop()
        }
        screenStreamRef.current = null
      }

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop()
        }
        localStreamRef.current = null
      }

      const resetState = defaultPeerMediaState()
      setLocalMediaState(resetState)
      localMediaStateRef.current = resetState
      setLocalPreviewStream(null)

      remoteStreamsRef.current.clear()
      setRemoteStreams([])
    }
  }, [roomId])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    let cancelled = false

    const loadRoom = async () => {
      if (!authUser || !roomId) return
      setIsLoading(true)
      try {
        const idToken = await authUser.getIdToken()
        const response = await getRoomById(roomId, idToken)
        await markRoomAsJoined(roomId, idToken)
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
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!roomId) return
    if (!SOCKET_URL) {
      console.warn("VITE_SOCKET_URL no configurado. Ignorando conexión socket.")
      return
    }

    const runId = socketConnectionRunRef.current + 1
    socketConnectionRunRef.current = runId
    let active = true
    let effectSocket: Socket | null = null

    const connectSocket = async () => {
      try {
        // obtener token: preferir el authUser que te llega como prop
        const token =
          (await authUser?.getIdToken()) ?? (await getAuth().currentUser?.getIdToken?.())

        if (!active || socketConnectionRunRef.current !== runId || !token) {
          return
        }

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
        })

        effectSocket = socket

        if (!active || socketConnectionRunRef.current !== runId) {
          socket.disconnect()
          return
        }

        if (socketRef.current && socketRef.current !== socket) {
          socketRef.current.disconnect()
        }

        socketRef.current = socket

        socket.on("connect", () => {
          if (!active || socketConnectionRunRef.current !== runId) {
            return
          }

          // join the room and request history
          socket.emit(
            "join_room",
            roomId,
            (res: JoinRoomAck) => {
              if (!active) return
              if (res?.ok) {
                if (Array.isArray(res.messages)) {
                  setMessages(res.messages)
                }
                if (Array.isArray(res.participants)) {
                  setParticipants(normalizeParticipants(res.participants))
                }
                if (res.selfPeerId) {
                  setSelfPeerId(res.selfPeerId)
                  selfPeerIdRef.current = res.selfPeerId
                }

                if (Array.isArray(res.mediaStates)) {
                  for (const mediaState of res.mediaStates) {
                    updatePeerMediaState(mediaState.peerId, {
                      audioEnabled: mediaState.audioEnabled,
                      videoEnabled: mediaState.videoEnabled,
                      screenSharing: mediaState.screenSharing,
                    })
                  }
                }

                const existingPeers = Array.isArray(res.peers) ? res.peers : []
                for (const peer of existingPeers) {
                  // El que acaba de entrar inicia oferta hacia los peers existentes.
                  void createOfferToPeer(peer.id)
                }

                emitLocalMediaState(localMediaStateRef.current)
              } else {
                toast.error("No se pudo entrar a la sala", { description: res?.error ?? "" })
              }
            }
          )
        })

        socket.on("message", (msg: ChatMessage) => {
          if (!active) return
          setMessages((prev) => [...prev, msg])
        })

        // opcional: recibir actualizaciones de participantes
        socket.on("room_participants", (list: ChatParticipant[]) => {
          if (!active) return
          setParticipants(normalizeParticipants(list))
        })

        socket.on("peer_joined", (payload: { peer: Peer; mediaState: PeerMediaState }) => {
          if (!active) return

          const peer = payload.peer
          updatePeerMediaState(peer.id, payload.mediaState)

          // Los peers existentes esperan la oferta del que acaba de entrar.
          ensurePeerConnection(peer.id)
        })

        socket.on("peer_left", (payload: { peerId: string }) => {
          if (!active) return
          cleanupPeerConnection(payload.peerId)
          setParticipants((previous) => previous.filter((participant) => participant.id !== payload.peerId))
        })

        socket.on("webrtc_offer", async (payload: SignalOfferPayload) => {
          if (!active || !roomId || payload.roomId !== roomId) return

          try {
            const connection = ensurePeerConnection(payload.fromPeerId)
            await connection.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            await flushPendingCandidates(payload.fromPeerId)

            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)

            if (connection.localDescription) {
              socket.emit("webrtc_answer", {
                roomId,
                toPeerId: payload.fromPeerId,
                sdp: connection.localDescription,
              })
            }
          } catch (error) {
            console.error("Error manejando offer WebRTC", error)
          }
        })

        socket.on("webrtc_answer", async (payload: SignalAnswerPayload) => {
          if (!active || !roomId || payload.roomId !== roomId) return

          try {
            const connection = ensurePeerConnection(payload.fromPeerId)
            await connection.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            await flushPendingCandidates(payload.fromPeerId)
          } catch (error) {
            console.error("Error manejando answer WebRTC", error)
          }
        })

        socket.on("webrtc_ice_candidate", async (payload: SignalIcePayload) => {
          if (!active || !roomId || payload.roomId !== roomId) return

          const connection = ensurePeerConnection(payload.fromPeerId)
          if (!connection.remoteDescription) {
            const queue = pendingCandidatesRef.current.get(payload.fromPeerId) || []
            queue.push(payload.candidate)
            pendingCandidatesRef.current.set(payload.fromPeerId, queue)
            return
          }

          try {
            await connection.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } catch (error) {
            console.error("Error agregando ICE candidate", error)
          }
        })

        socket.on("media_state_changed", (payload: MediaStateEvent) => {
          if (!active) return
          updatePeerMediaState(payload.peerId, {
            audioEnabled: payload.audioEnabled,
            videoEnabled: payload.videoEnabled,
            screenSharing: payload.screenSharing,
          })
        })

        socket.on("connect_error", (err: Error) => {
          console.error("Socket connect_error", err)
        })
      } catch (err) {
        console.error("Error conectando socket:", err)
      }
    }

    void connectSocket()

    return () => {
      active = false

      if (effectSocket) {
        try {
          effectSocket.emit("leave_room", roomId)
        } catch (error) {
          void error
        }

        effectSocket.disconnect()
        if (socketRef.current === effectSocket) {
          socketRef.current = null
        }
      }

      for (const pc of peerConnectionsRef.current.values()) {
        pc.close()
      }
      peerConnectionsRef.current.clear()
      pendingCandidatesRef.current.clear()
      remoteStreamsRef.current.clear()
      setRemoteStreams([])
    }
    // intentionally depend on authUser?.uid and roomId
  }, [authUser, roomId, SOCKET_URL])
  /* eslint-enable react-hooks/exhaustive-deps */

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

  const handleSendMessage = (e?: FormEvent) => {
    e?.preventDefault()
    if (!chatMessage.trim()) return

    const payload = { roomId, text: chatMessage }
    const socket = socketRef.current

    // enviar por socket con callback de ack si está conectado
    if (socket && socket.connected) {
      socket.emit("message", payload, (res: SendMessageAck) => {
        if (res?.ok) {
          // opcional: el servidor puede devolver el mensaje con id/createdAt
          const nextMessage = res.message
          if (nextMessage) {
            setMessages((prev) => [...prev, nextMessage])
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

  const leaveCurrentRoom = () => {
    const socket = socketRef.current
    if (!socket || !roomId) {
      return
    }

    try {
      socket.emit("leave_room", roomId)
    } catch (error) {
      void error
    }

    socket.disconnect()
    socketRef.current = null
  }

  const handleLeaveRoom = () => {
    leaveCurrentRoom()
    navigate("/dashboard", { replace: true })
  }

  useEffect(() => {
    if (!roomId) {
      return
    }

    const handlePageExit = () => {
      leaveCurrentRoom()
    }

    window.addEventListener("pagehide", handlePageExit)
    window.addEventListener("beforeunload", handlePageExit)

    return () => {
      window.removeEventListener("pagehide", handlePageExit)
      window.removeEventListener("beforeunload", handlePageExit)
    }
  }, [roomId])

  const participantIdsForGrid = useMemo(() => {
    const ids = new Set<string>()
    const selfUid = authUser?.uid || null

    if (selfPeerId) {
      ids.add(selfPeerId)
    }

    for (const participant of participants) {
      if (selfUid && participant.uid === selfUid) {
        continue
      }
      ids.add(participant.id)
    }

    // Fallback mientras llega el peerId propio desde join_room.
    if (!selfPeerId && localPreviewStream) {
      ids.add("local")
    }

    return Array.from(ids)
  }, [authUser?.uid, participants, selfPeerId, localPreviewStream])

  const orderedTiles = participantIdsForGrid.map((participantId) => {
    const isLocal = selfPeerId ? participantId === selfPeerId : participantId === "local"
    const participant = participantsById.get(participantId)
    return {
      id: participantId,
      isLocal,
      name: isLocal ? "Tu" : participant?.name || "Participante",
      avatarUrl: isLocal ? profile?.avatarUrl || null : participant?.avatarUrl || null,
      stream: isLocal ? localPreviewStream : remoteStreamsByPeerId.get(participantId) || null,
      mediaState: isLocal
        ? localMediaState
        : peerMediaStates[participantId] || defaultPeerMediaState(),
    }
  })

  const pinnedTile = pinnedTileId
    ? orderedTiles.find((tile) => tile.id === pinnedTileId) || null
    : null

  const sideTiles = pinnedTile
    ? orderedTiles.filter((tile) => tile.id !== pinnedTile.id).slice(0, 3)
    : []

  const hiddenSideTilesCount = pinnedTile
    ? Math.max(0, orderedTiles.length - 1 - sideTiles.length)
    : 0

  const gridClassName =
    orderedTiles.length <= 1
      ? "grid-cols-1"
      : orderedTiles.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : orderedTiles.length <= 4
          ? "grid-cols-2"
          : "grid-cols-2 xl:grid-cols-3"

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className="hidden">
        {remoteStreams.map(({ peerId, stream }) => (
          <RemoteAudioSink key={`audio-${peerId}`} stream={stream} />
        ))}
      </div>

      {/* HEADER */}
      <header className="shrink-0 border-b px-4 py-3 sm:px-6 lg:flex lg:h-16 lg:items-center lg:justify-between lg:py-0">
        <div className="flex min-w-0 items-start gap-3 lg:flex-1 lg:items-center lg:gap-4">
          <Button variant="ghost" className="mt-0.5 px-2 lg:mt-0">
            <Link to="/dashboard" aria-label="Volver">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1 flex-col">
            {isEditingRoomName ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={roomNameDraft}
                  onChange={(e) => setRoomNameDraft(e.target.value)}
                  className="h-8 w-full sm:w-52"
                  placeholder="Nombre de la sala"
                />
                <Button size="sm" onClick={() => void handleSaveRoomName()} disabled={isSavingRoomName} className="sm:w-auto">
                  {isSavingRoomName ? "..." : "Guardar"}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEditing} className="sm:w-auto">
                  Cancelar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">{isLoading ? "Cargando..." : room?.name ?? "Sala"}</h1>
                  {isCreator && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="size-3" />
                      Admin
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{room?.description || "Sin descripción"}</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto lg:mt-0 lg:justify-start lg:gap-3">
          {/* ID + copy: visible both mobile and desktop; text hidden on small */}
          <div className="flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1">
            <span className="mr-2 font-mono text-xs tracking-widest">{room?.id ?? "--- --- ---"}</span>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => void handleCopyRoomId()} disabled={isLoading || !room?.id}>
              <Copy className="size-3.5" />
            </Button>
          </div>

          {/* Edit + Delete: icon-only on mobile, full on desktop */}
          {isCreator && !isEditingRoomName && (
            <div className="ml-1 flex shrink-0 items-center gap-2 border-l pl-3 lg:ml-3">
              <Button
                variant="ghost"
                size="icon"
                className="flex h-8 w-8 items-center justify-center sm:hidden"
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
            className="ml-1 h-8 w-8 shrink-0 lg:hidden"
            onClick={() => setIsMobileChatOpen(true)}
            aria-label="Abrir chat"
            title="Chat"
          >
            <MessageSquare className="size-4" />
          </Button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-2 sm:p-4 lg:flex-row">
        {/* LEFT: Stage + Participants */}
        <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card p-3 pb-20 shadow-lg lg:pb-24">
            {mediaError ? (
              <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {mediaError}
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => void requestLocalMedia()}>
                    Activar cámara y micrófono
                  </Button>
                </div>
              </div>
            ) : null}

            {!hasCameraAvailable ? (
              <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
                No hay cámara disponible en este dispositivo. Puedes continuar con audio sin problema.
              </div>
            ) : null}

            {pinnedTile ? (
              <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
                <div className="min-h-0 flex-1">
                  <VideoTile
                    key={pinnedTile.id}
                    stream={pinnedTile.stream}
                    name={pinnedTile.name}
                    avatarUrl={pinnedTile.avatarUrl}
                    muted
                    mediaState={pinnedTile.mediaState}
                    isLocal={pinnedTile.isLocal}
                    isPinned
                    onTogglePin={() => setPinnedTileId(null)}
                  />
                </div>

                <div className="hidden min-h-0 w-64 shrink-0 flex-col gap-3 overflow-hidden lg:flex">
                  {sideTiles.map((tile) => (
                    <VideoTile
                      key={tile.id}
                      stream={tile.stream}
                      name={tile.name}
                      avatarUrl={tile.avatarUrl}
                      muted
                      mediaState={tile.mediaState}
                      isLocal={tile.isLocal}
                      compact
                      onTogglePin={() => setPinnedTileId(tile.id)}
                    />
                  ))}

                  {hiddenSideTilesCount > 0 ? (
                    <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
                      +{hiddenSideTilesCount} participantes más
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${gridClassName}`}>
                {orderedTiles.map((tile) => (
                  <VideoTile
                    key={tile.id}
                    stream={tile.stream}
                    name={tile.name}
                    avatarUrl={tile.avatarUrl}
                    muted
                    mediaState={tile.mediaState}
                    isLocal={tile.isLocal}
                    isPinned={pinnedTileId === tile.id}
                    onTogglePin={() =>
                      setPinnedTileId((current) => (current === tile.id ? null : tile.id))
                    }
                  />
                ))}
              </div>
            )}

            {/* Floating controls: ensure spacing and no overlap */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 rounded-2xl border bg-card p-2 z-10">
              <Button
                variant={localMediaState.audioEnabled ? "secondary" : "destructive"}
                size="icon"
                className="hover:bg-muted"
                title={localMediaState.audioEnabled ? "Silenciar micrófono" : "Activar micrófono"}
                onClick={handleToggleAudio}
              >
                {localMediaState.audioEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
              </Button>
              <Button
                variant={localMediaState.videoEnabled ? "secondary" : "destructive"}
                size="icon"
                className="hover:bg-muted"
                title={localMediaState.videoEnabled ? "Apagar cámara" : "Activar cámara"}
                onClick={handleToggleVideo}
              >
                {localMediaState.videoEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
              </Button>

              <Button
                variant={localMediaState.screenSharing ? "default" : "secondary"}
                size="icon"
                className="gap-2 px-3"
                title={localMediaState.screenSharing ? "Detener pantalla" : "Compartir pantalla"}
                onClick={() => void handleToggleScreenShare()}
                disabled={!canShareScreen}
              >
                <MonitorUp className="size-5" />
              </Button>

              {/* Mobile-only chat toggle in floating controls (keeps it reachable) */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileChatOpen(true)}
                aria-label="Abrir chat"
                title="Chat" 
              >
                <MessageSquare className="size-5" />
              </Button>

              <div className="w-px h-8 bg-border mx-1" />
              <Button variant="destructive" size="icon" className="gap-2" title="salir de la sala" onClick={handleLeaveRoom}>
                <PhoneMissed className="size-5" />
              </Button>
            </div>
          </div>

          {/* Participants strip */}
          <div className="flex h-20 shrink-0 items-center gap-3 overflow-x-auto rounded-xl border bg-background p-3 lg:h-[76px] lg:py-2">
            <div className="mr-2 flex h-full flex-col justify-center border-r px-2">
              <Users className="size-5 text-muted-foreground mb-1" />
              <span className="text-xs font-medium text-muted-foreground">{participants.length}</span>
            </div>

            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No hay participantes aún...</p>
            ) : (
              participants.map((p) => (
                <div key={p.id} className="relative flex h-full min-w-[120px] max-w-[160px] flex-col items-center justify-center rounded-lg border bg-card px-3 py-1.5 lg:justify-start lg:pt-1.5">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt={`Avatar de ${p.name}`}
                      className="h-7 w-7 rounded-full object-cover lg:h-6 lg:w-6"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground lg:h-6 lg:w-6">
                      <UserIcon className="size-4 lg:size-3.5" />
                    </div>
                  )}
                  <span className="mt-1 w-full truncate text-center text-[11px] font-medium leading-tight lg:text-[10px]">{p.name}</span>
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
          } min-h-0 w-full flex-col overflow-hidden border bg-background shadow-lg lg:static lg:flex lg:h-full lg:w-80 lg:rounded-2xl lg:border`}
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

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{msg.text}</span>
                  </div>
                )
              }

              // soporta distintos formatos: { userUid, displayName, text } o legacy { user, text }
              const msgUid = msg.userUid ?? msg.uid
              const msgName = msg.displayName ?? msg.name ?? msg.user ?? "Anon"
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
