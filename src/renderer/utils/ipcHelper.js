const IPC_TIMEOUT = 5000;

export async function safeCall(apiFn, fallback = null, timeout = IPC_TIMEOUT) {
  if (!apiFn) return fallback;

  const callPromise = new Promise((resolve, reject) => {
    try {
      const result = apiFn();
      Promise.resolve(result).then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('IPC 调用超时')), timeout),
  );

  return Promise.race([callPromise, timeoutPromise]).catch((err) => {
    console.error('[IPC] 调用失败:', err.message);
    return fallback;
  });
}
