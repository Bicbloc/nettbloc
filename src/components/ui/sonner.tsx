import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"
import { maybeTranslate } from "@/i18n/translateRuntime"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

// Wrap sonner's `toast` so any imperative `toast("...")` / `toast.success("...")`
// call automatically gets FR→EN translation when the active language is English.
const translateMessage = (message: unknown): unknown => {
  if (typeof message === "string") return maybeTranslate(message)
  return message
}

const translateOptions = (opts: any): any => {
  if (!opts || typeof opts !== "object") return opts
  const next = { ...opts }
  if (typeof next.description === "string") {
    next.description = maybeTranslate(next.description)
  }
  return next
}

const wrapped = ((message: any, opts?: any) =>
  (sonnerToast as any)(translateMessage(message), translateOptions(opts))) as typeof sonnerToast

// Re-bind variant methods so existing call sites (toast.success, .error, etc.) work.
const variants = ["success", "error", "info", "warning", "message", "loading"] as const
for (const v of variants) {
  const orig = (sonnerToast as any)[v]
  if (typeof orig === "function") {
    ;(wrapped as any)[v] = (message: any, opts?: any) =>
      orig(translateMessage(message), translateOptions(opts))
  }
}
// Forward remaining helpers (dismiss, promise, custom, etc.) untouched.
for (const key of Object.keys(sonnerToast as any)) {
  if ((wrapped as any)[key] === undefined) {
    ;(wrapped as any)[key] = (sonnerToast as any)[key]
  }
}

const toast = wrapped

export { Toaster, toast }
