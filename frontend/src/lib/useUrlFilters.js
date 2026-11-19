import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/**
 * List filters stored in the URL (?status=…&page=2) so back/forward and
 * shared links keep the same view.
 */
export function useUrlFilters(defaults = {}) {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => {
    const out = { ...defaults }
    for (const [k, v] of params.entries()) out[k] = v
    return out
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === '' || value === null || value === undefined || value === false) next.delete(key)
          else next.set(key, value)
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const setPage = useCallback((page) => setFilter('page', page > 1 ? page : ''), [setFilter])

  return { filters, setFilter, setPage }
}
