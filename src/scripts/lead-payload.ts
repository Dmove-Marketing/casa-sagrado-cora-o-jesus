// Mapeamento normalizado para o padrão exato de chaves do n8n.
// Compartilhado entre forms.ts (formulário da página) e WhatsAppWidget para que
// todo formulário do site envie os mesmos nomes de campo ao webhook.
export const keyMap: Record<string, string> = {
  nome: 'Nome',
  email: 'E-mail',
  'e-mail': 'E-mail',
  telefone: 'WhatsApp',
  whatsapp: 'WhatsApp',
  data: 'Data do evento',
  data_evento: 'Data do evento',
  'data do evento': 'Data do evento',
  tipo_evento: 'Tipo de evento',
  'tipo de evento': 'Tipo de evento',
  convidados: 'Convidados',
  participantes: 'Participantes',
  empresa: 'Empresa',
  grupo: 'Igreja/Grupo',
  hospedagem: 'Hospedagem',
  mensagem: 'Mensagem',
  detalhes_adicionais: 'Mensagem',
  'detalhes adicionais': 'Mensagem',
};

// Opções de "Tipo de evento" — fonte única compartilhada entre os formulários
// normais (formulário da página) e o popup de WhatsApp, para que todos ofereçam
// exatamente a mesma lista. Não inclui o placeholder "Selecione...".
export const tipoEventoOptions: { value: string; label: string }[] = [
  { value: 'Retiro espiritual',                    label: 'Retiro espiritual' },
  { value: 'Casamento intimista / Bodas',          label: 'Casamento intimista / Bodas' },
  { value: 'Evento corporativo / Formação',        label: 'Evento corporativo / Formação' },
  { value: 'Imersão / Desenvolvimento humano',     label: 'Imersão / Desenvolvimento humano' },
  { value: 'Encontro educacional',                 label: 'Encontro educacional' },
  { value: 'Outro',                                label: 'Outro' },
];

export const trackingParamKeys = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
  'utm_content', 'utm_id', 'gclid', 'gbraid', 'wbraid',
  'fbclid', 'ttclid', 'msclkid', 'sck',
  'fbc', 'fbp', 'external_id', 'event_id',
];

// Rótulo de origem do lead ("Fonte" no payload): "Landing page/<slug>", com a raiz como "home".
// Os parâmetros de tracking vão em campos próprios do payload, não no Fonte.
export function getPageSource(pathname: string): string {
  const slug = pathname.replace(/\/$/, '').split('/').filter(Boolean)[0];
  return `Landing page/${slug || 'home'}`;
}
