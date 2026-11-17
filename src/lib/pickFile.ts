/**
 * Открывает системный диалог выбора файла через временный `<input type="file">`.
 * Возвращает выбранный файл или `null`, если выбор отменён. Вызывается из обработчика
 * действия пользователя (клик, нажатие клавиши) — иначе браузер не покажет диалог.
 *
 * Результат не зависит от порядка событий `change` и `cancel`: браузер может прислать
 * `cancel` раньше `change` того же выбора. Поэтому `cancel` не завершает выбор сразу:
 * если файл уже выбран — возвращается он, иначе `null` откладывается до следующей
 * макрозадачи, и пришедший следом `change` побеждает.
 */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const selected = () => input.files?.[0] ?? null;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(selected()), { once: true });
    input.addEventListener(
      'cancel',
      () => {
        const file = selected();
        if (file) finish(file);
        else setTimeout(() => finish(selected()), 0);
      },
      { once: true },
    );
    document.body.append(input);
    input.click();
  });
}
