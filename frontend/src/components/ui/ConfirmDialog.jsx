import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

const ConfirmContext = createContext(null)

/**
 * const confirm = useConfirm()
 * if (await confirm({ title, message, confirmText, tone: 'danger' })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setState(options)
      }),
    [],
  )

  const close = (result) => {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? 'تأكيد'}
        size="sm"
        footer={
          <>
            <Button variant={state?.tone ?? 'danger'} className="flex-1" onClick={() => close(true)}>
              {state?.confirmText ?? 'تأكيد'}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
              تراجع
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="size-5 text-amber-600" />
          </div>
          <div className="text-sm leading-6 text-slate-700">{state?.message}</div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
