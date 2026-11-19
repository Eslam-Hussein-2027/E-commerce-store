import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

/** Strip empty params so URLs stay clean. */
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false))

export function useList(resource, params = {}, options = {}) {
  const p = clean(params)
  return useQuery({
    queryKey: [resource, 'list', p],
    queryFn: () => api.get(`/${resource}`, { params: p }).then((r) => r.data),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useItem(resource, id, options = {}) {
  return useQuery({
    queryKey: [resource, 'item', String(id)],
    queryFn: () => api.get(`/${resource}/${id}`).then((r) => r.data),
    enabled: !!id,
    ...options,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    staleTime: 10 * 60_000,
  })
}

/** Products for selects (all, unpaginated). */
export function useProductOptions(params = {}) {
  return useList('products', { all: 1, ...params }, { staleTime: 15_000 })
}

/**
 * Any write can change stock, cost, custody or dashboard numbers,
 * so refresh every cached query (except the logged-in user).
 */
export function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'users' })
}

export function useSave(resource) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, ...data }) =>
      (id ? api.put(`/${resource}/${id}`, data) : api.post(`/${resource}`, data)).then((r) => r.data),
    onSuccess: invalidate,
  })
}

export function useRemove(resource) {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (id) => api.delete(`/${resource}/${id}`),
    onSuccess: invalidate,
  })
}

export function useChangeOrderStatus() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/orders/${id}/status`, data).then((r) => r.data),
    onSuccess: invalidate,
  })
}
