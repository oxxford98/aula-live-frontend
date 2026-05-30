import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        duration: 10000,
      }}
      {...props}
    />
  )
}
