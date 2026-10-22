import { useSyncExternalStore, type ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

const QUERY = "(max-width: 1023px)"
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
/** True on phones and small tablets, where the app uses its native-style shell. */
export const useIsMobile = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)

/** A bottom sheet on mobile and a centred dialog on desktop, with the same content.
    Header and footer stay put; only the body scrolls when the content is taller than the screen. */
export function ResponsivePanel({ open, onOpenChange, title, description, footer, children, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const mobile = useIsMobile()
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
          <DrawerHeader className="shrink-0 px-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="text-lg">{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4", className)}>{children}</div>
          {footer && <DrawerFooter className="shrink-0 border-t bg-card/80 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(86dvh,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5", className)}>{children}</div>
        {footer && <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t bg-muted/40 px-6 py-4">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
