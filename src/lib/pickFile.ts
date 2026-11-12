/**
 * Открывает системный диалог выбора файла через временный `<input type="file">`.
 * Возвращает выбранный файл или `null`, если выбор отменён. Вызывается из обработчика
 * действия пользователя (клик, нажатие клавиши) — иначе браузер не покажет диалог.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    const finish = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input);
    input.click();
  });
}
