import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Hook to detect if the user is on a mobile device.
 * Returns 'undefined' initially on the server and synchronizes 
 * after the first mount to prevent hydration mismatch.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    // We do this check only on the client
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    
    // Initial check
    check()

    mql.addEventListener("change", check)
    return () => mql.removeEventListener("change", check)
  }, [])

  return isMobile
}
