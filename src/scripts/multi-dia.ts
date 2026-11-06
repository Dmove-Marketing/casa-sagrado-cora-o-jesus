// Eventos que podem durar mais de 1 dia: todo formulário tem "Data inicial" + "Data final" (opcional).
// O CRM só aceita uma data, então a data final não é campo próprio: o forms.ts a anexa ao início da Mensagem.
// Chamar depois de iniciar o flatpickr. A data final só aceita datas a partir da inicial.
export function initMultiDia() {
  document.querySelectorAll<HTMLFormElement>('form[data-form-id]').forEach((form) => {
    const ini = form.querySelector<HTMLInputElement>('input[name="data_evento"]');
    const fim = form.querySelector<HTMLInputElement>('input[name="data_fim"]');
    if (!ini || !fim) return;
    const fpIni = (ini as any)._flatpickr;
    const fpFim = (fim as any)._flatpickr;
    ini.addEventListener('change', () => {
      const d = fpIni?.selectedDates?.[0];
      fpFim?.set('minDate', d || 'today');
      if (d && fpFim?.selectedDates?.[0] && fpFim.selectedDates[0] < d) fpFim.clear();
    });
  });
}
