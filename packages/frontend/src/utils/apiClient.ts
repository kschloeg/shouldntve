export async function apiFetch(
  url: string,
  options?: RequestInit & { skipAuthRedirect?: boolean }
): Promise<Response> {
  const { skipAuthRedirect, ...fetchOptions } = options || {};

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
  });

  // If token expired (401), alert user and redirect to login
  // Skip redirect for auth endpoints (login, verify-otp) where 401 is expected
  if (response.status === 401 && !skipAuthRedirect) {
    alert('Your session has expired. Please log in again.');
    window.location.href = '/login';
  }

  return response;
}
