// ============================================================
// PADRÃO DE FORMULÁRIO DMOVE — fonte única dos campos
// ============================================================
// Catálogo de campos + presets por funil. Os `name` aqui são
// CANÔNICOS e batem com o keyMap do webhook (lead-payload.ts).
// Uma página só escolhe o preset (via config.json > forms.lead-form.preset);
// nunca redefine campo por campo → nome nunca chega torto no n8n.

import { tipoEventoOptions } from './lead-payload';

export interface PresetFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
  selected?: boolean;
}

export interface PresetField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
  /** ocupa a linha inteira no grid de 2 colunas */
  full?: boolean;
  /** ativa o Flatpickr (calendário pt-BR) */
  datepicker?: boolean;
  /** texto de apoio no label, ex.: "não obrigatório" */
  hint?: string;
  options?: PresetFieldOption[];
}

// —— Campo "Tipo de evento": sempre TODAS as opções do WhatsApp ——
const tipoEvento: PresetField = {
  name: 'tipo_evento',
  type: 'select',
  label: 'Tipo de evento',
  required: true,
  options: [
    { value: '', label: 'Selecione o tipo de evento', disabled: true, selected: true },
    ...tipoEventoOptions,
  ],
};

// —— Campo "Nome da empresa": só no funil corporativo, sempre 1º ——
const empresa: PresetField = {
  name: 'empresa',
  type: 'text',
  label: 'Nome da empresa',
  placeholder: 'Nome da sua empresa',
  required: true,
  full: true,
};

// —— Campo "Detalhes do evento": ÚNICO opcional; fora do WhatsApp ——
const detalhes: PresetField = {
  name: 'detalhes_adicionais',
  type: 'textarea',
  label: 'Detalhes do evento',
  hint: 'não obrigatório',
  required: false,
  full: true,
};

// Núcleo comum (ordem pensada p/ o grid de 2 colunas fluir em pares:
// nome|telefone · email|tipo_evento · data|convidados)
const nucleo: PresetField[] = [
  { name: 'nome',      type: 'text',   label: 'Nome',                  placeholder: 'Seu nome completo',  required: true },
  { name: 'telefone',  type: 'tel',    label: 'Telefone',              placeholder: '(11) 00000-0000',    required: true },
  { name: 'email',     type: 'email',  label: 'E-mail',                placeholder: 'voce@empresa.com.br', required: true },
  tipoEvento,
  { name: 'data_evento', type: 'text', label: 'Data do evento',        placeholder: 'dd/mm/aaaa', datepicker: true, required: true },
  { name: 'convidados', type: 'number', label: 'Número de convidados', placeholder: 'Ex: 150',            required: true },
  detalhes,
];

// Preset CSCJ — labels e placeholders fiéis ao site original (cscjeventos.com.br)
const nucloCscj: PresetField[] = [
  { name: 'nome',        type: 'text',    label: 'Nome completo',        placeholder: 'Como podemos chamar você?',                    required: true },
  { name: 'email',       type: 'email',   label: 'E-mail',               placeholder: 'voce@email.com',                               required: true },
  { name: 'telefone',    type: 'tel',     label: 'WhatsApp / Telefone',  placeholder: '(11) 90000-0000',                              required: true },
  {
    name: 'tipo_evento', type: 'select',  label: 'Tipo de evento',       required: false,
    options: [
      { value: '', label: 'Selecione...', disabled: true, selected: true },
      ...tipoEventoOptions,
    ],
  },
  { name: 'data_evento', type: 'text',    label: 'Data desejada',        placeholder: 'dd/mm/aaaa', datepicker: true,                 required: false },
  { name: 'convidados',  type: 'number',  label: 'Nº de participantes',  placeholder: 'Ex.: 30',                                      required: false },
  {
    name: 'detalhes_adicionais', type: 'textarea', label: 'Mensagem',    placeholder: 'Conte-nos um pouco sobre seu evento ou retiro...', required: false, full: true,
  },
];

export const formPresets: Record<'social' | 'corporativo' | 'cscj', PresetField[]> = {
  social: nucleo,
  corporativo: [empresa, ...nucleo],
  cscj: nucloCscj,
};

// Mapa de funil (slug) → preset. Corporativos ganham o campo "empresa".
export const funnelPreset: Record<string, keyof typeof formPresets> = {
  casamentos: 'social',
  debutantes: 'social',
  aniversarios: 'social',
  formaturas: 'social',
  'eventos-corporativos': 'corporativo',
  'eventos-corporativos-confraternizacoes': 'corporativo',
};

export function getPreset(name?: string): PresetField[] {
  const key = (name as keyof typeof formPresets) || 'cscj';
  return formPresets[key] || formPresets.cscj;
}
