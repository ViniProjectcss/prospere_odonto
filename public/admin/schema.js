/**
 * Esquema do painel: quais seções existem e quais campos cada uma edita.
 * Para editar mais um texto do site, é só acrescentar uma linha aqui
 * (e garantir que o servidor — server/render.js — mostra esse campo).
 *
 * Tipos de campo:
 *  text | title (aceita *destaque*) | textarea | phone | url | select
 *  strings (lista de textos) | group (campos aninhados) | list (lista de itens com campos)
 */

const help = {
  title: 'Dica: coloque *asteriscos* em volta de uma palavra para destacá-la em itálico dourado.',
  anchor: 'Para rolar até uma parte do site use #sobre, #tratamentos ou #contato.',
};

const SIDE = [{ value: 'left', label: 'Esquerda' }, { value: 'right', label: 'Direita' }];
const CTA_TYPE = [{ value: 'link', label: 'Abrir um link' }, { value: 'whatsapp', label: 'Abrir o WhatsApp da clínica' }];

const POS = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
];
const POS_LABEL = { left: 'Esquerda', center: 'Centro', right: 'Direita' };

// etapas (1 a 4) com o nome do capítulo, lido do próprio conteúdo
const sceneOptions = (ctx) => [1, 2, 3, 4].map((n) => ({
  value: n,
  label: `Etapa ${n} — ${ctx.content.hero.chapters[n - 1]?.eyebrow || ''}`,
}));

/* ---------- campos de um cartão do vídeo ---------- */
export const CARD_FIELDS = [
  { key: 'scene', label: 'Em qual etapa do vídeo aparece', type: 'select', numeric: true, options: sceneOptions, redraw: true },
  { key: 'side', label: 'Lado da tela', type: 'select', options: SIDE },
  { key: 'icon', label: 'Ícone', type: 'select', optionsFrom: 'icons' },
  { key: 'eyebrow', label: 'Rótulo pequeno (acima do título)', type: 'text', max: 60 },
  { key: 'title', label: 'Título do cartão', type: 'text', max: 120 },
  { key: 'text', label: 'Texto (opcional)', type: 'textarea', rows: 3, max: 400 },
  { key: 'items', label: 'Lista de tópicos (opcional)', type: 'strings', itemLabel: 'Tópico', max: 8, itemMax: 120 },
  {
    key: 'cta', label: 'Botão (opcional)', type: 'group',
    help: 'Deixe o texto do botão vazio para o cartão não ter botão.',
    fields: [
      { key: 'label', label: 'Texto do botão', type: 'text', max: 40 },
      { key: 'type', label: 'O que o botão faz', type: 'select', options: CTA_TYPE },
      { key: 'url', label: 'Endereço do link (só se o botão abre um link)', type: 'url', placeholder: 'https://…' },
    ],
  },
];

export const newCard = (scene) => ({
  id: 'card-' + Math.random().toString(36).slice(2, 8),
  scene, side: 'left', icon: 'star', eyebrow: '', title: 'Novo cartão', text: '', items: [],
  cta: { label: '', type: 'link', url: '' },
});

export const SCENE_NOTES = [
  'Aparece logo que o site abre. O primeiro cartão desta etapa já está visível no topo.',
  'O vídeo PARA nesta etapa — é o melhor momento para passar informações.',
  'O vídeo PARA de novo aqui — ótimo para mais uma sequência de informações.',
  'Final do vídeo. O último cartão desta etapa fica na tela até o fim.',
];

/* ---------- seções do painel ---------- */
export const SECTIONS = [
  { id: 'inicio', label: 'Início', title: 'Início', custom: 'home' },

  {
    id: 'geral', label: 'Geral', title: 'Informações gerais',
    description: 'Nome, Google, menu, tela de carregamento e rodapé.',
    blocks: [
      {
        title: 'Site e Google', path: 'site',
        description: 'O título e a descrição aparecem na aba do navegador e nos resultados de busca.',
        fields: [
          { key: 'name', label: 'Nome da clínica', type: 'text', max: 80 },
          { key: 'logo', label: 'Logotipo (topo do site e tela de carregamento)', type: 'title', max: 60 },
          { key: 'seoTitle', label: 'Título no Google e na aba', type: 'text', max: 70, counter: true },
          { key: 'seoDescription', label: 'Descrição no Google', type: 'textarea', rows: 3, max: 160 },
        ],
      },
      { title: 'Tela de carregamento', path: 'loader', fields: [{ key: 'text', label: 'Texto', type: 'text', max: 80 }] },
      {
        title: 'Menu do topo', path: 'nav',
        fields: [
          { key: 'cta', label: 'Texto do botão do menu', type: 'text', max: 30 },
          {
            key: 'links', label: 'Links do menu', type: 'list', itemLabel: 'Link', min: 1, max: 8,
            summary: (l) => l.label,
            newItem: () => ({ label: 'Novo link', href: '#contato' }),
            fields: [
              { key: 'label', label: 'Texto', type: 'text', max: 30 },
              { key: 'href', label: 'Para onde leva', type: 'url', help: help.anchor },
            ],
          },
        ],
      },
      {
        title: 'Rodapé', path: 'footer',
        fields: [
          { key: 'text', label: 'Texto de direitos', type: 'text', max: 160, help: 'Escreva {ano} onde o ano atual deve aparecer.' },
          { key: 'privacyLabel', label: 'Texto do link da Política de Privacidade', type: 'text', max: 40 },
          { key: 'backToTop', label: 'Texto do link de voltar ao topo', type: 'text', max: 40 },
        ],
      },
    ],
  },

  {
    id: 'capitulos', label: 'Vídeo: títulos', title: 'Títulos do vídeo',
    description: 'Os 4 textos grandes que aparecem durante o vídeo, na ordem do scroll. O vídeo e os frames não podem ser alterados.',
    blocks: [{
      title: 'Capítulos', path: 'hero',
      fields: [
        {
          key: 'chapters', label: 'Os 4 capítulos', type: 'list', itemLabel: 'Capítulo', fixed: true,
          summary: (c, i) => `${i + 1} · ${c.eyebrow}`,
          fields: [
            { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 40 },
            { key: 'title', label: 'Título grande', type: 'title', max: 120 },
          ],
        },
        { key: 'hint', label: 'Descrição da seta "role para baixo" (leitores de tela)', type: 'text', max: 60 },
      ],
    }],
  },

  { id: 'cartoes', label: 'Vídeo: cartões', title: 'Cartões do vídeo', custom: 'cards',
    description: 'Os cartões de informação que aparecem sobre o vídeo. Você pode editar, criar e apagar. O vídeo, os frames e as pausas continuam travados.' },

  {
    id: 'lab', label: 'Seção 3D', title: 'Seção do scan 3D',
    description: 'A seção com o desenho da arcada dentária sendo escaneada.',
    blocks: [
      {
        title: 'Textos principais', path: 'lab',
        fields: [
          { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 60 },
          { key: 'title', label: 'Título', type: 'title', max: 120 },
          { key: 'lead', label: 'Texto de apoio', type: 'textarea', rows: 3, max: 300 },
          {
            key: 'steps', label: 'Os 4 passos', type: 'list', itemLabel: 'Passo', fixed: true,
            summary: (s, i) => `${i + 1} · ${s.title}`,
            fields: [
              { key: 'title', label: 'Título do passo', type: 'text', max: 60 },
              { key: 'text', label: 'Descrição', type: 'textarea', rows: 2, max: 200 },
            ],
          },
        ],
      },
      {
        title: 'Painel do scan (dentro da imagem)', path: 'lab',
        fields: [
          { key: 'imageDescription', label: 'Descrição da imagem (leitores de tela)', type: 'text', max: 160 },
          { key: 'tagLeft', label: 'Etiqueta da esquerda', type: 'text', max: 40 },
          { key: 'tagRight', label: 'Etiqueta da direita', type: 'text', max: 40 },
          {
            key: 'metrics', label: 'Nomes dos 3 indicadores', type: 'group',
            fields: [
              { key: 'teeth', label: 'Indicador 1 (dentes)', type: 'text', max: 30 },
              { key: 'precision', label: 'Indicador 2 (precisão)', type: 'text', max: 30 },
              { key: 'status', label: 'Indicador 3 (situação)', type: 'text', max: 30 },
            ],
          },
          { key: 'precisionValue', label: 'Valor mostrado em "precisão"', type: 'text', max: 30 },
          {
            key: 'statuses', label: 'Situação durante o scan (na ordem em que aparecem)', type: 'strings',
            itemLabel: 'Situação', fixed: true, itemMax: 40,
          },
        ],
      },
    ],
  },

  {
    id: 'sobre', label: 'A clínica', title: 'Seção "A clínica"',
    blocks: [{
      title: 'Texto e números', path: 'about',
      fields: [
        { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 40 },
        { key: 'title', label: 'Título', type: 'title', max: 140 },
        { key: 'text', label: 'Texto sobre a clínica', type: 'textarea', rows: 6, max: 1200 },
        {
          key: 'stats', label: 'Números de destaque', type: 'list', itemLabel: 'Número', min: 0, max: 6,
          summary: (s) => `${s.value} — ${s.label}`,
          newItem: () => ({ value: '0', label: 'Descrição' }),
          fields: [
            { key: 'value', label: 'Número ou valor (ex.: 12 anos, 100%)', type: 'text', max: 20 },
            { key: 'label', label: 'Descrição', type: 'text', max: 60 },
          ],
        },
      ],
    }],
  },

  {
    id: 'tratamentos', label: 'Tratamentos', title: 'Tratamentos',
    blocks: [{
      title: 'Seção de tratamentos', path: 'services',
      fields: [
        { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 40 },
        { key: 'title', label: 'Título', type: 'title', max: 140 },
        {
          key: 'items', label: 'Tratamentos', type: 'list', itemLabel: 'Tratamento', min: 1, max: 12,
          summary: (s) => s.title,
          newItem: () => ({ title: 'Novo tratamento', text: '' }),
          fields: [
            { key: 'title', label: 'Nome', type: 'text', max: 60 },
            { key: 'text', label: 'Descrição', type: 'textarea', rows: 3, max: 240 },
          ],
        },
      ],
    }],
  },

  {
    id: 'galeria', label: 'Galeria', title: 'Galeria de pacientes',
    description: 'Fotos, GIFs e vídeos curtos (sem som) que passam em carrossel no site. A seção só aparece quando há pelo menos uma mídia visível.',
    blocks: [{
      title: 'Textos da seção', path: 'differentials',
      fields: [
        { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 40 },
        { key: 'title', label: 'Título', type: 'title', max: 140 },
      ],
    }],
  },

  {
    id: 'contato', label: 'Seção contato', title: 'Seção "Contato" do site',
    blocks: [
      {
        title: 'Chamada', path: 'contact',
        fields: [
          { key: 'eyebrow', label: 'Rótulo pequeno', type: 'text', max: 40 },
          { key: 'title', label: 'Título', type: 'title', max: 140 },
          { key: 'lead', label: 'Texto', type: 'textarea', rows: 2, max: 240 },
          { key: 'button', label: 'Texto do botão', type: 'text', max: 40 },
        ],
      },
      {
        title: 'WhatsApp', path: 'contact.whatsapp',
        description: 'Todos os botões "Agendar" do site abrem este WhatsApp.',
        fields: [
          { key: 'number', label: 'Número (só dígitos, com 55 + DDD)', type: 'phone', max: 15, help: 'Exemplo: 5511999999999' },
          { key: 'message', label: 'Mensagem que já vem escrita', type: 'textarea', rows: 2, max: 240 },
        ],
      },
      {
        title: 'Endereço', path: 'contact',
        fields: [
          { key: 'addressTitle', label: 'Título do bloco', type: 'text', max: 40 },
          {
            key: 'address', label: 'Endereço', type: 'group',
            fields: [
              { key: 'line1', label: 'Linha 1 (rua, número, sala)', type: 'text', max: 120 },
              { key: 'line2', label: 'Linha 2 (bairro, cidade/UF)', type: 'text', max: 120 },
            ],
          },
        ],
      },
      {
        title: 'Horários', path: 'contact',
        fields: [
          { key: 'hoursTitle', label: 'Título do bloco', type: 'text', max: 40 },
          {
            key: 'hours', label: 'Horários de atendimento', type: 'list', itemLabel: 'Horário', min: 0, max: 10,
            summary: (h) => `${h.days} — ${h.time}`,
            newItem: () => ({ days: 'Dia(s)', time: '00h às 00h' }),
            fields: [
              { key: 'days', label: 'Dias', type: 'text', max: 40 },
              { key: 'time', label: 'Horário', type: 'text', max: 40 },
            ],
          },
        ],
      },
      {
        title: 'Instagram', path: 'contact.instagram',
        fields: [
          { key: 'handle', label: 'Usuário (sem @)', type: 'text', max: 40 },
          { key: 'url', label: 'Link do perfil', type: 'url', placeholder: 'https://www.instagram.com/…' },
        ],
      },
    ],
  },

  { id: 'contatos', label: 'Contatos recebidos', title: 'Contatos recebidos', custom: 'leads',
    description: 'Pessoas que preencheram o cartão de contato do site. Os dados ficam criptografados e são apagados automaticamente.' },

  {
       id: 'cartao', label: 'Cartão de contato', title: 'Cartão de contato (formulário flutuante)',
    
    description: 'O cartão discreto que acompanha o scroll e pede nome, e-mail e telefone. Aqui você escolhe onde ele fica em cada etapa do vídeo e edita todos os textos.',
    blocks: [
      {
        title: 'Posição durante o vídeo', path: 'leadCard',
        fields: [{
          key: 'positions', label: 'Onde o cartão fica em cada etapa', type: 'list', itemLabel: 'Etapa', fixed: true,
          help: 'Escolha o lado livre em cada etapa, de acordo com onde estão os cartões do vídeo. Entre uma etapa e outra ele desliza sozinho.',
          summary: (p, i) => `Etapa ${i + 1} · ${POS_LABEL[p.side] || ''}`,
          fields: [{ key: 'side', label: 'Posição do cartão', type: 'select', options: POS }],
        }],
      },
      {
        
        title: 'Ativação e textos', path: 'leadCard',
        fields: [
          { key: 'enabled', label: 'Mostrar o cartão no site', type: 'checkbox', help: 'Ele só aparece se tudo da LGPD estiver preenchido (veja o aviso no topo).' },
          { key: 'pill', label: 'Texto da pílula (cartão fechado)', type: 'text', max: 40 },
          { key: 'title', label: 'Título do formulário', type: 'text', max: 80 },
          { key: 'lead', label: 'Texto de apoio', type: 'textarea', rows: 2, max: 200 },
          {
            key: 'fields', label: 'Nomes dos campos', type: 'group',
            fields: [
              { key: 'name', label: 'Campo nome', type: 'text', max: 30 },
              { key: 'email', label: 'Campo e-mail', type: 'text', max: 30 },
              { key: 'phone', label: 'Campo telefone', type: 'text', max: 30 },
            ],
          },
          { key: 'submit', label: 'Texto do botão enviar', type: 'text', max: 30 },
          { key: 'sending', label: 'Texto do botão enquanto envia', type: 'text', max: 30 },
        ],
      },
      {
        title: 'Aceite da Política de Privacidade', path: 'leadCard',
        description: 'Este é o texto da caixa que a pessoa precisa marcar. Ele fica gravado junto com cada contato, como prova do consentimento.',
        fields: [
          { key: 'consentText', label: 'Texto do aceite', type: 'textarea', rows: 3, max: 400, help: 'Obrigatório conter {politica}: é onde aparece o link para a Política de Privacidade.' },
          { key: 'policyLinkLabel', label: 'Texto do link da política', type: 'text', max: 40 },
        ],
      },
      {
        title: 'Mensagem de sucesso', path: 'leadCard.success',
        fields: [
          { key: 'title', label: 'Título', type: 'text', max: 80 },
          { key: 'text', label: 'Texto', type: 'textarea', rows: 2, max: 200 },
        ],
      },
      {
        title: 'Mensagens de erro e botões', path: 'leadCard',
        fields: [
          { key: 'close', label: 'Descrição do botão de fechar (leitores de tela)', type: 'text', max: 40 },
          { key: 'dismiss', label: 'Descrição do "×" que dispensa o cartão', type: 'text', max: 60 },
          {
            key: 'errors', label: 'Mensagens de erro', type: 'group',
            fields: [
              { key: 'name', label: 'Nome inválido', type: 'text', max: 100 },
              { key: 'email', label: 'E-mail inválido', type: 'text', max: 100 },
              { key: 'phone', label: 'Telefone inválido', type: 'text', max: 100 },
              { key: 'consent', label: 'Faltou aceitar a política', type: 'text', max: 140 },
              { key: 'captcha', label: 'Anti-robô não confirmado', type: 'text', max: 100 },
              { key: 'generic', label: 'Erro geral', type: 'text', max: 140 },
              { key: 'rate', label: 'Muitas tentativas', type: 'text', max: 140 },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'privacidade', label: 'Privacidade (LGPD)', title: 'Política de Privacidade',
    description: 'Dados da clínica que aparecem na página /privacidade. O resto do texto (o que é coletado, por quanto tempo, direitos) é montado pelo sistema a partir do que ele realmente faz.',
    warning: 'Este é um texto-base. Antes de publicar, peça a revisão de um advogado ou do encarregado de dados da clínica. O cartão de contato só vai ao ar com razão social, CNPJ e e-mail do encarregado preenchidos.',
    blocks: [
      {
        title: 'Quem é o controlador dos dados', path: 'privacy',
        fields: [
          {
            key: 'controller', label: 'Clínica', type: 'group',
            fields: [
              { key: 'legalName', label: 'Razão social', type: 'text', max: 140 },
              { key: 'cnpj', label: 'CNPJ', type: 'text', max: 30 },
              { key: 'address', label: 'Endereço da sede', type: 'text', max: 200 },
            ],
          },
          {
            key: 'dpo', label: 'Encarregado pelo tratamento de dados (DPO)', type: 'group',
            help: 'Pessoa de contato para pedidos dos titulares. Pode ser o próprio dono da clínica.',
            fields: [
              { key: 'name', label: 'Nome (opcional)', type: 'text', max: 100 },
              { key: 'email', label: 'E-mail', type: 'text', max: 120 },
            ],
          },
        ],
      },
      {
        title: 'Versão e informações adicionais', path: 'privacy',
        fields: [
          { key: 'version', label: 'Versão da política', type: 'text', max: 40, help: 'Mude (ex.: 1.1) sempre que alterar o conteúdo. Cada contato guarda a versão que a pessoa aceitou.' },
          { key: 'updatedAt', label: 'Data da última atualização', type: 'text', max: 30 },
          { key: 'processors', label: 'Outras empresas que acessam os dados (hospedagem, etc.)', type: 'textarea', rows: 3, max: 600, help: 'Uma frase. Apague tudo se não houver outras.' },
          { key: 'extra', label: 'Informações adicionais (opcional)', type: 'textarea', rows: 5, max: 3000, help: 'Aparece no final da página. Separe parágrafos com uma linha em branco.' },
        ],
      },
    ],
  },

  { id: 'historico', label: 'Histórico', title: 'Histórico de versões', custom: 'versions',
    description: 'Cada vez que você salva, uma cópia é guardada (as últimas 100). Dá para voltar a qualquer uma.' },

  
];
