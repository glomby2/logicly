/**
 * Запускает скачивание текстового файла через Blob и временную ссылку `a[download]`.
 * Исключение означает, что скачивание не началось. Выбор места сохранения и отмену
 * в диалоге браузера страница узнать не может.
 */
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Ссылку освобождаем после того, как браузер начал скачивание.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
