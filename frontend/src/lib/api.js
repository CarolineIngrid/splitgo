async function readResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    const messages = []
    if (data && typeof data === 'object') {
      for (const value of Object.values(data)) {
        messages.push(...(Array.isArray(value) ? value : [value]))
      }
    }
    const errorMessages = messages.filter((value) => typeof value === 'string')
    throw new Error(errorMessages.join(' ') || 'Não foi possível concluir a solicitação.')
  }

  return data
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body } = options
  const headers = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfResponse = await fetch('/api/auth/csrf/', {
      credentials: 'same-origin',
    })
    const csrfData = await readResponse(csrfResponse)
    headers['X-CSRFToken'] = csrfData.csrfToken
  }

  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return readResponse(response)
}
