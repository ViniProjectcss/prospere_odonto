'use strict';
/**
 * Página /privacidade — Política de Privacidade.
 * O texto é gerado a partir do que o SISTEMA realmente faz (retenção, criptografia, anti-robô)
 * e dos dados da clínica preenchidos no painel (Privacidade). É um TEXTO-BASE: peça revisão
 * a um advogado ou ao encarregado antes de publicar.
 */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => MAP[c]);
const em = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const paragraphs = (text) => String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
const mail = (e) => (/^[^\s@<>"]+@[^\s@<>"]+$/.test(String(e || '')) ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : esc(e));

function renderPrivacy(c, { retentionDays }) {
  const p = c.privacy;
  const k = p.controller;
  const d = p.dpo;
  const name = c.site.name;

  const sections = [
    ['Quem é o responsável pelos seus dados', `
      <p><strong>${esc(k.legalName)}</strong>, inscrita no CNPJ sob o nº <strong>${esc(k.cnpj)}</strong>, com sede em ${esc(k.address)}
      (“Clínica”, “nós”), é a <strong>controladora</strong> dos dados pessoais tratados por meio do formulário de contato deste site,
      nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>`],

    ['Encarregado pelo tratamento de dados (DPO)', `
      <p>Para dúvidas, pedidos ou reclamações sobre esta Política ou sobre os seus dados, fale com ${d.name ? `<strong>${esc(d.name)}</strong>, ` : ''}
      encarregado(a) pelo tratamento de dados, pelo e-mail ${mail(d.email)}.</p>`],

    ['Quais dados coletamos', `
      <p>Pelo formulário de contato coletamos <strong>apenas</strong>: <strong>nome</strong>, <strong>e-mail</strong> e <strong>telefone</strong>,
      informados por você.</p>
      <p>Também registramos, para comprovar o seu consentimento e proteger o formulário contra abusos: a data e a hora do envio,
      a versão desta Política e o texto de consentimento que você aceitou, e uma “impressão digital” irreversível (hash) do seu endereço de IP.</p>
      <p><strong>Não pedimos dados sobre a sua saúde neste formulário. Por favor, não os informe.</strong>
      Informações de saúde são dados pessoais sensíveis e só são tratadas no atendimento, com as garantias próprias.</p>`],

    ['Para que usamos os seus dados', `
      <p>Usamos os seus dados <strong>exclusivamente</strong> para entrar em contato com você — por telefone, WhatsApp ou e-mail —
      para responder ao seu pedido e agendar uma avaliação. Não usamos esses dados para outras finalidades sem pedir um novo
      consentimento e <strong>não os vendemos</strong>.</p>`],

    ['Base legal', `
      <p>O tratamento é feito com base no seu <strong>consentimento</strong> (art. 7º, inciso I, da LGPD), dado ao marcar a caixa de
      aceite antes de enviar o formulário. Você pode <strong>revogar o consentimento a qualquer momento</strong>, de forma gratuita e
      facilitada, falando com o encarregado. A revogação não afeta os tratamentos feitos antes dela.</p>
      <p>Você não é obrigado(a) a preencher o formulário. Se preferir, pode entrar em contato com a clínica por outros canais.</p>`],

    ['Com quem os dados podem ser compartilhados', `
      <p>Não vendemos nem cedemos os seus dados. Eles podem ser acessados por empresas que nos ajudam a manter o site funcionando
      (“operadores”), sempre seguindo as nossas instruções:</p>
      <ul>
        <li><strong>Verificação anti-robô — Cloudflare Turnstile (Cloudflare, Inc.).</strong> Ao abrir o formulário, o seu navegador se conecta
        aos servidores da Cloudflare, que recebe dados técnicos (como endereço IP e informações do navegador) para distinguir pessoas de robôs.
        Isso pode envolver transferência internacional de dados (art. 33 da LGPD).</li>
        ${p.processors && p.processors.trim() ? `<li>${esc(p.processors).replace(/\n/g, '<br>')}</li>` : ''}
      </ul>
      <p>Também poderemos compartilhar dados com autoridades quando houver obrigação legal ou ordem judicial.</p>`],

    ['Como protegemos os seus dados', `
      <p>Nome, e-mail e telefone são armazenados <strong>criptografados</strong>. O acesso ao painel onde os contatos são vistos é restrito,
      protegido por usuário e senha, e limitado a pessoas autorizadas. A comunicação com o site é protegida por conexão segura (HTTPS).
      Registramos as ações de exportação e exclusão de contatos.</p>`],

    ['Por quanto tempo guardamos', `
      <p>Guardamos os seus dados por até <strong>${esc(retentionDays)} dias</strong> contados do envio do formulário. Depois disso, eles são
      <strong>eliminados automaticamente</strong>. Eliminamos antes se você pedir (veja “Seus direitos”) ou se revogar o consentimento,
      salvo se a lei exigir que guardemos por mais tempo.</p>`],

    ['Seus direitos', `
      <p>Nos termos do art. 18 da LGPD, você pode pedir, a qualquer momento:</p>
      <ul>
        <li>confirmação de que tratamos dados seus;</li>
        <li>acesso aos dados;</li>
        <li>correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
        <li>portabilidade dos dados;</li>
        <li>eliminação dos dados tratados com o seu consentimento;</li>
        <li>informação sobre com quem os dados foram compartilhados;</li>
        <li>informação sobre a possibilidade de não consentir e sobre as consequências da recusa;</li>
        <li>revogação do consentimento.</li>
      </ul>
      <p>Para exercer qualquer direito, escreva para ${mail(d.email)}. Responderemos no prazo previsto em lei
      (declaração completa em até 15 dias — art. 19). Você também pode apresentar reclamação à
      <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>.</p>`],

    ['Crianças e adolescentes', `
      <p>O formulário é destinado a pessoas maiores de 18 anos. O contato para atendimento de crianças e adolescentes deve ser feito por um
      de seus pais ou pelo responsável legal (art. 14 da LGPD).</p>`],

    ['Cookies e armazenamento no navegador', `
      <p>Este site <strong>não usa cookies de publicidade nem de rastreamento</strong>. Usamos apenas, durante a sua visita, o armazenamento
      de sessão do navegador para lembrar que você fechou o cartão de contato; essa informação não sai do seu aparelho e se apaga quando
      você fecha a aba. O serviço anti-robô da Cloudflare pode guardar dados técnicos no navegador para funcionar.</p>`],

    ['Mudanças nesta Política', `
      <p>Podemos atualizar esta Política. A versão e a data de atualização ficam indicadas nesta página. Se uma mudança exigir novo
      consentimento, vamos pedi-lo novamente.</p>`],
  ];

  if (p.extra && p.extra.trim()) sections.push(['Informações adicionais', paragraphs(p.extra)]);

  const body = sections.map(([title, html], i) => `
    <section>
      <h2><span>${String(i + 1).padStart(2, '0')}</span> ${esc(title)}</h2>
      ${html}
    </section>`).join('\n');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Política de Privacidade — ${esc(name)}</title>
  <meta name="description" content="Como a ${esc(name)} trata os dados pessoais enviados pelo formulário de contato.">
  <meta name="theme-color" content="#0f1f17">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/legal.css">
</head>
<body>
  <header class="legal__top">
    <a class="legal__logo" href="/">${em(c.site.logo)}</a>
    <a class="legal__back" href="/">← Voltar ao site</a>
  </header>
  <main class="legal">
    <p class="legal__eyebrow">Privacidade e proteção de dados</p>
    <h1>Política de Privacidade</h1>
    <p class="legal__meta">Versão ${esc(p.version)} · atualizada em ${esc(p.updatedAt)}</p>
    ${body}
  </main>
  <footer class="legal__foot">© ${new Date().getFullYear()} ${esc(name)}</footer>
</body>
</html>`;
}

module.exports = { renderPrivacy };
