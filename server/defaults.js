'use strict';
/**
 * Conteúdo padrão do site (usado só na PRIMEIRA vez, para popular o banco).
 * Junta os textos que estavam no index.html com os dados do config/clinic.json.
 *
 * Convenção nos títulos: *palavra* = destaque em itálico dourado.
 * No texto do rodapé, {ano} vira o ano atual.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadClinic() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'clinic.json'), 'utf8'));
  } catch {
    return {};
  }
}

function buildDefaults() {
  const c = loadClinic();
  const name = c.name || 'Prospere Odonto';
  const tagline = c.tagline || 'Sorrir é cuidar de você';
  const insta = c.instagram || { handle: 'prospere.odonto', url: 'https://www.instagram.com/prospere.odonto/' };
  const wa = c.whatsapp || { number: '5500000000000', message: 'Olá! Vim pelo site e gostaria de agendar uma avaliação.' };

  return {
    version: 1,

    site: {
      name,
      logo: 'Prospere *Odonto*',
      tagline,
      seoTitle: `${name} — ${tagline}`,
      seoDescription: 'Conheça a Prospere Odonto: um espaço acolhedor, tecnologia e cuidado para o seu sorriso.',
    },

    loader: { text: 'Preparando a experiência' },

    nav: {
      links: [
        { label: 'A clínica', href: '#sobre' },
        { label: 'Tratamentos', href: '#tratamentos' },
        { label: 'Contato', href: '#contato' },
      ],
      cta: 'Agendar',
    },

    /* ----- Vídeo do scroll: 4 capítulos fixos + cartões editáveis ----- */
    hero: {
      hint: 'Role para baixo',
      chapters: [
        { eyebrow: 'Bem-vindo', title: 'Seu sorriso começa *aqui*' },
        { eyebrow: 'Acolhimento', title: 'A vida é melhor quando você *sorri*' },
        { eyebrow: 'Ambiente', title: 'Cada detalhe pensado para o seu *conforto*' },
        { eyebrow: 'Cuidado', title: 'Atenção individual, do início ao *sorriso final*' },
      ],
      // scene = em qual capítulo (1 a 4) o cartão aparece | side = left | right
      cards: [
        {
          id: 'card-instagram', scene: 1, side: 'right', icon: 'instagram',
          eyebrow: 'Instagram', title: `@${insta.handle}`,
          text: 'Acompanhe os bastidores, os resultados e as novidades da clínica.',
          items: [],
          cta: { label: 'Seguir no Instagram', type: 'link', url: insta.url },
        },
        {
          id: 'card-raio-x', scene: 2, side: 'left', icon: 'xray',
          eyebrow: 'Diagnóstico por imagem', title: 'Raio-X na própria clínica',
          text: 'O exame é feito no mesmo lugar do atendimento: mais praticidade para você e um plano de tratamento mais preciso.',
          items: [], cta: { label: '', type: 'link', url: '' },
        },
        {
          id: 'card-historia', scene: 2, side: 'right', icon: 'shield',
          eyebrow: 'Nossa história', title: '+12 anos cuidando de sorrisos',
          text: '',
          items: ['Mais de 5.000 pacientes atendidos', 'Equipe de 8 especialistas', 'Seg a Sáb, das 8h às 19h'],
          cta: { label: '', type: 'link', url: '' },
        },
        {
          id: 'card-estrutura', scene: 3, side: 'right', icon: 'shield',
          eyebrow: 'Estrutura', title: 'Pensada para o seu conforto',
          text: '',
          items: ['Raio-X no local', 'Planejamento individual do tratamento', 'Acompanhamento do início ao fim'],
          cta: { label: '', type: 'link', url: '' },
        },
        {
          id: 'card-tratamentos', scene: 3, side: 'left', icon: 'plus',
          eyebrow: 'Tratamentos', title: 'Do check-up ao sorriso novo',
          text: '',
          items: ['Limpeza e prevenção', 'Clareamento dental', 'Ortodontia e implantes'],
          cta: { label: '', type: 'link', url: '' },
        },
        {
          id: 'card-pagamento', scene: 3, side: 'left', icon: 'card',
          eyebrow: 'Pagamento', title: 'Cuidar do sorriso cabe no seu bolso',
          text: '',
          items: ['Parcelamento no cartão', 'Pix e débito', 'Orçamento claro antes de começar'],
          cta: { label: '', type: 'link', url: '' },
        },
        {
          id: 'card-agendamento', scene: 4, side: 'right', icon: 'calendar',
          eyebrow: 'Agendamento', title: 'Agende sua avaliação',
          text: 'Fale com a gente pelo WhatsApp e escolha o melhor horário para você.',
          items: [],
          cta: { label: 'Agendar pelo WhatsApp', type: 'whatsapp', url: '' },
        },
      ],
    },

    /* ----- Seção do scan 3D ----- */
    lab: {
      eyebrow: 'Tecnologia e precisão',
      title: 'Seu sorriso, mapeado em *3D*.',
      lead: 'Diagnóstico digital, simulação do resultado e um plano feito sob medida para você.',
      steps: [
        { title: 'Escaneamento digital', text: 'Mapeamos toda a arcada com precisão milimétrica, de forma rápida e confortável.' },
        { title: 'Diagnóstico por dente', text: 'Posição, formato, desgaste e saúde analisados um a um.' },
        { title: 'Simulação do resultado', text: 'Visualize tom e formato antes de iniciar qualquer tratamento.' },
        { title: 'Seu sorriso, no seu ritmo', text: 'Um plano personalizado, acompanhado do início ao fim.' },
      ],
      imageDescription: 'Modelo 3D de uma arcada dentária sendo escaneada',
      tagLeft: 'Arcada · 32 dentes',
      tagRight: 'Scan 3D',
      metrics: { teeth: 'Mapeados', precision: 'Precisão', status: 'Status' },
      precisionValue: '±0,02 mm',
      statuses: ['Escaneando', 'Atenção 26 · 36', 'Simulando', 'Sorriso ideal'],
    },

    about: {
      eyebrow: 'A clínica',
      title: c.about?.title || 'Um espaço pensado para você sorrir sem medo.',
      text: c.about?.text || '',
      stats: c.stats || [
        { value: '100%', label: 'Atendimento humanizado' },
      ],
    },

    services: {
      eyebrow: 'Tratamentos',
      title: 'Cuidado completo para *todas* as fases do sorriso',
      items: c.services || [],
    },

    differentials: {
      eyebrow: 'Nossos pacientes',
      title: 'Sorrisos que *cuidamos*',
      items: c.differentials || [],
    },

    contact: {
      eyebrow: 'Contato',
      title: 'Vamos cuidar do seu *sorriso*?',
      lead: 'Agende sua avaliação pelo WhatsApp. Respondemos o mais rápido possível.',
      button: 'Agendar pelo WhatsApp',
      addressTitle: 'Onde estamos',
      address: c.address || { line1: '', line2: '', mapsUrl: '' },
      hoursTitle: 'Horários',
      hours: c.hours || [],
      whatsapp: wa,
      instagram: insta,
    },

    footer: {
      text: `© {ano} ${name}. Todos os direitos reservados.`,
      privacyLabel: 'Política de Privacidade',
      backToTop: 'Voltar ao topo ↑',
    },

    /* ----- Cartão flutuante de contato (formulário) ----- */
    leadCard: {
      enabled: true,
            // onde o cartão fica em cada etapa do vídeo (1 a 4): left | center | right
      positions: [
        { side: 'right' },
        { side: 'left' },
        { side: 'right' },
        { side: 'right' },
      ],
      pill: 'Fale com a gente',
      title: 'Quer que a gente entre em contato?',
      lead: 'Deixe seus dados e retornamos para agendar a sua avaliação.',
      fields: { name: 'Nome', email: 'E-mail', phone: 'Telefone com DDD' },
      consentText: 'Li e concordo com a {politica} e autorizo a clínica a usar meus dados para entrar em contato comigo.',
      policyLinkLabel: 'Política de Privacidade',
      submit: 'Enviar',
      sending: 'Enviando…',
      success: { title: 'Recebemos o seu contato!', text: 'Em breve nossa equipe fala com você.' },
      close: 'Fechar',
      dismiss: 'Não mostrar de novo nesta visita',
      errors: {
        name: 'Informe seu nome.',
        email: 'Informe um e-mail válido.',
        phone: 'Informe um telefone com DDD.',
        consent: 'Para enviar, você precisa aceitar a Política de Privacidade.',
        captcha: 'Confirme que você não é um robô.',
        generic: 'Não conseguimos enviar agora. Tente novamente em instantes.',
        rate: 'Muitas tentativas. Tente de novo mais tarde.',
      },
    },

    /* ----- Política de Privacidade (LGPD) ----- */
    privacy: {
      version: '1.0',
      updatedAt: new Date().toLocaleDateString('pt-BR'),
      controller: { legalName: '[EDITAR] Razão social da clínica', cnpj: '[EDITAR] 00.000.000/0000-00', address: '[EDITAR] Endereço completo da sede' },
      dpo: { name: '', email: '[EDITAR] email-do-encarregado@dominio.com.br' },
      processors: '[EDITAR] Hospedagem do site e banco de dados: nome da empresa (país). Remova esta linha se não se aplicar.',
      extra: '',
    },
  };
}

module.exports = { buildDefaults };
