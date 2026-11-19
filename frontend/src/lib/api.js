import axios from 'axios'

/**
 * Same-origin axios client. Sanctum SPA auth uses the session cookie + XSRF-TOKEN
 * cookie (axios copies it into the X-XSRF-TOKEN header automatically).
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
})

export const getCsrfCookie = () => axios.get('/sanctum/csrf-cookie', { withCredentials: true })

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const config = error.config

    // 419 = CSRF token expired → refresh the cookie and retry once.
    if (status === 419 && config && !config.__retried) {
      config.__retried = true
      await getCsrfCookie()
      return api(config)
    }

    if (status === 401 && !config?.url?.includes('/auth/login')) {
      onUnauthorized()
    }

    return Promise.reject(error)
  },
)

/** Human-readable Arabic message from any API error. */
export function errorMessage(error, fallback = 'حدث خطأ غير متوقع، حاول مرة أخرى.') {
  if (!error?.response) return 'تعذر الاتصال بالخادم. تأكد من تشغيل الكمبيوتر والاتصال بالشبكة.'
  const data = error.response.data
  if (data?.errors) {
    const first = Object.values(data.errors)[0]
    if (Array.isArray(first) && first[0]) return first[0]
  }
  if (error.response.status === 429) return 'محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً.'
  if (error.response.status >= 500) return 'خطأ في الخادم. راجع سجل Laravel (storage/logs).'
  return data?.message || fallback
}

/**
 * Copy Laravel 422 errors onto react-hook-form fields.
 * Laravel keys like "items.0.qty" match RHF field-array paths exactly.
 * Returns the messages that did not map to a field.
 */
export function applyServerErrors(error, setError, knownFields = []) {
  const errors = error?.response?.status === 422 ? error.response.data?.errors : null
  if (!errors) return [errorMessage(error)]
  const unmapped = []
  for (const [key, messages] of Object.entries(errors)) {
    const root = key.split('.')[0]
    if (knownFields.includes(root)) setError(key, { type: 'server', message: messages[0] })
    else unmapped.push(messages[0])
  }
  return unmapped
}
