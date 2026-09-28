export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  timeoutSeconds = 60,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Critix-Request": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = (data as any).detail;
      const message = Array.isArray(detail)
        ? detail.map((item: { msg: string }) => item.msg).join("; ")
        : detail || (response.status >= 500 ? "некорректный ответ сервера" : `Ошибка ${response.status}`);
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (e: any) {
    if (controller.signal.aborted) {
      throw new Error("Запрос мог быть выполнен или прерван по тайм-ауту. Проверьте актуальное состояние проекта.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
