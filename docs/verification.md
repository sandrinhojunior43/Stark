# Verificação do STARK

Data: 3 de novembro de 2026. Versão 0.4.0: conversa por voz/texto, ideias, projetos, diário, memória e histórico.

## Verificações executadas

- `pnpm typecheck`: aprovado. `pnpm build`: aprovado.
- `pnpm test`: **53 testes** aprovados:
  - função de chat: configuração ausente, código errado, bloqueio por tentativas, limite por minuto, GET sem vazar segredos, validação do corpo, **voz nunca enviada ao modelo**, contexto e item em discussão, conversão de ferramentas em sugestões (e descarte de decisões em projetos inexistentes), tradução de falhas do serviço sem vazar a chave, tempo esgotado;
  - cliente: cabeçalho de acesso, mensagens de erro, cancelamento, texto para fala, formatação de datas, montagem do contexto;
  - dados: anotações, ideias, projetos (etapas, decisões, exclusão que preserva ideias), memória sem duplicatas, histórico, migração do formato anterior, backup completo de ida e volta, recusa de dados adulterados, e conteúdo idêntico ao trocar Wells ↔ Stark.
- **Teste de ponta a ponta no Chromium: 35 verificações aprovadas**, com a função de IA simulada e microfone e fala falsos que registram o que acontece:
  - teste de conexão; Wells e Stark falam com tons e ritmos diferentes; o volume chega à fala;
  - tocar na esfera liga o microfone; a fala vira mensagem; a resposta é exibida e falada com a voz escolhida;
  - o código de acesso e a conversa seguem na requisição, **sem a voz**; a memória e as ideias entram no contexto;
  - sugestão de ideia, projeto e decisão só são gravadas ao tocar em Salvar; memória automática avisa e é editável;
  - falha do serviço mostra o erro e "Tentar de novo" não duplica a pergunta no histórico;
  - ideias: busca, edição, ligação a projeto, transformação em projeto;
  - projetos: etapas, riscos, decisões; "Discutir" envia o projeto inteiro como contexto;
  - diário: criar, buscar, excluir; memória: adicionar, apagar; histórico lista e persiste após recarregar;
  - apagar dados zera tudo; sem código de acesso o app orienta e não chama a função;
  - navegador **sem reconhecimento de voz**: microfone escondido, aviso claro, conversa por texto funciona;
  - nenhum erro no console nos dois cenários.

## Erros encontrados e corrigidos nesta rodada

- O service worker interceptava `GET /api/chat` e devolvia a página inicial; passou a ignorar `/api/`.
- O cartão "Salvar como ideia" ficava cortado na tela de conversa; a área de respostas ganhou espaço.
- A gravação de dados ganhou uma fila: conversa, edições e preferências não se sobrescrevem.

## Limites desta validação (importante)

- **A chamada real à API da Anthropic não foi testada** (sem chave): o formato do pedido segue a API de Mensagens e foi verificado contra um servidor simulado. A primeira conversa real é o teste definitivo.
- **A função não foi publicada na Vercel**: não foi verificado o empacotamento de `api/chat.ts` nem as variáveis de ambiente lá. O botão "Testar conexão" existe para diagnosticar isso.
- **Firefox não foi testado** (indisponível no ambiente); o comportamento sem reconhecimento de voz foi simulado no Chromium.
- Microfone, reconhecimento e vozes reais não foram usados; a qualidade das vozes pt-BR e a diferença audível entre Wells e Stark dependem do sistema de quem usa.
- Não foi testado em celular, nem Safari; nenhuma medição de desempenho ou bateria.
- A qualidade e a "personalidade" das respostas do modelo não foram avaliadas, pois dependem do modelo real.
