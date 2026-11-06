// Eventos de mais de 1 dia: mostra "Data final" (obrigatória) e a data do evento vira "Data inicial".
// A data final não é campo do CRM: o forms.ts a anexa ao início da Mensagem.
// Marcação esperada no form: [data-label-data] (label da data), [data-campo-data-fim] (wrapper, com hidden)
// e input[name="data_fim"] (disabled), ambos com data-form-datepicker (chamar depois do flatpickr).
export function initMultiDia(multiTipos: string[]) {
  document.querySelectorAll<HTMLFormElement>('form[data-form-id]').forEach((form) => {
    const tipo = form.querySelector<HTMLSelectElement>('select[name="tipo_evento"]');
    const ini = form.querySelector<HTMLInputElement>('input[name="data_evento"]');
    const fim = form.querySelector<HTMLInputElement>('input[name="data_fim"]');
    const wrap = form.querySelector<HTMLElement>('[data-campo-data-fim]');
    const lbl = form.querySelector<HTMLElement>('[data-label-data]');
    if (!tipo || !ini || !fim || !wrap || !lbl) return;
    const original = lbl.textContent || 'Data do evento';
    const fpIni = (ini as any)._flatpickr;
    const fpFim = (fim as any)._flatpickr;
    const syncMin = () => {
      const d = fpIni?.selectedDates?.[0];
      fpFim?.set('minDate', d || 'today');
      if (d && fpFim?.selectedDates?.[0] && fpFim.selectedDates[0] < d) fpFim.clear();
    };
    const toggle = () => {
      const multi = multiTipos.includes(tipo.value);
      wrap.hidden = !multi;
      fim.disabled = !multi;
      fim.required = multi;
      lbl.textContent = multi ? 'Data inicial' : original;
      if (!multi) fpFim?.clear();
    };
    tipo.addEventListener('change', toggle);
    ini.addEventListener('change', syncMin);
    toggle();
  });
}
