/**
 * =============================================================================
 * RENOVA SENAI - CONTROLADOR DO ASSISTENTE IA (assistente.js)
 * Integração Groq (Llama 3.3 70B) + Motor Inteligente Local de Dados Acadêmicos
 * =============================================================================
 * VERSÃO: 2025-01-15-v6-MODEL-LLAMA-3.3-70B-VERSATILE
 * =============================================================================
 */

class AssistenteIAController {
  constructor() {
    console.log('[Assistente IA] === VERSÃO 2025-01-15-v6 - MODEL: qwen/qwen3.8-27b ===');
    this.turmaId = null;
    this.ucId = null;
    this.apiKey = window.db?.data?.config?.groqApiKey 
               || localStorage.getItem('renova_groq_api_key') 
               || '';
    this.groqModel = window.db?.data?.config?.groqModel 
                    || localStorage.getItem('renova_groq_model') 
                    || 'qwen/qwen3.8-27b';
    console.log('[Assistente IA] Constructor - groqModel:', this.groqModel, '| apiKey:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'VAZIA');
    this.isGenerating = false;
    this.mensagens = [];
    this._modoCoord = false; // Alterado pelo app.js quando logado como coordenador
  }

  init() {
    this.turmaId = null;
    this.ucId = null;
    this.carregarTurmasSelect();
    this.atualizarStatusChave();
    this.atualizarChipsPorPerfil();
    this.configurarEventos();
    this.atualizarEstadoBloqueio();

    // Sempre exibe boas-vindas orientando a seleção da turma
    this.exibirMensagemBoasVindas();
  }

  atualizarChipsPorPerfil() {
    const row = document.querySelector('.assistente-chips-row');
    if (!row) return;

    const isCoord = this._modoCoord || (window.auth && window.auth.isCoordenacao && window.auth.isCoordenacao());
    if (isCoord) {
      row.innerHTML = `
        <button type="button" class="assistente-chip-btn" data-action="medias_turmas">Média de todas as turmas</button>
        <button type="button" class="assistente-chip-btn" data-action="radar_dia">Radar do Dia</button>
        <button type="button" class="assistente-chip-btn" data-action="atestados_pendentes">Atestados Pendentes</button>
        <button type="button" class="assistente-chip-btn" data-action="compensacoes_abertas">Compensações</button>
        <button type="button" class="assistente-chip-btn" data-action="resumo">Resumo da turma</button>
        <button type="button" class="assistente-chip-btn" data-action="risco">Alunos em risco</button>
      `;
    } else {
      row.innerHTML = `
        <button type="button" class="assistente-chip-btn" data-action="resumo">Resumo da Turma Ativa</button>
        <button type="button" class="assistente-chip-btn" data-action="plano_aula">Plano de Aula & Conteúdos</button>
        <button type="button" class="assistente-chip-btn" data-action="frequencia_faltas">Frequência e Faltas</button>
        <button type="button" class="assistente-chip-btn" data-action="avaliacoes_medias">Avaliações e Médias</button>
        <button type="button" class="assistente-chip-btn" data-action="risco">Alunos em Risco</button>
        <button type="button" class="assistente-chip-btn" data-action="plano">Plano de Ação</button>
        <button type="button" class="assistente-chip-btn" data-action="ausentes">Ausentes Hoje</button>
        <button type="button" class="assistente-chip-btn" data-action="abaixo70">Notas &lt; 70</button>
        <button type="button" class="assistente-chip-btn" data-action="freq80">Frequência &lt; 80%</button>
        <button type="button" class="assistente-chip-btn" data-action="ocorrencias">Ocorrências</button>
      `;
    }

    row.querySelectorAll('.assistente-chip-btn').forEach(btn => {
      btn.dataset.bound = 'true';
      btn.addEventListener('click', () => {
        const acao = btn.getAttribute('data-action');
        const rotulo = btn.textContent.trim();
        this.executarOpcaoPredefinida(acao, rotulo);
      });
    });

    this.atualizarEstadoBloqueio();
  }

  // --- Carregamento de Turmas no Seletor ---
  carregarTurmasSelect() {
    const sel = document.getElementById('selectTurmaAssistente');
    if (!sel) return;

    const turmas = (window.db && window.db.data && Array.isArray(window.db.data.turmas))
      ? window.db.data.turmas
      : [];

    sel.innerHTML = '<option value="">— Selecione uma turma —</option>';
    turmas.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.codigo} - ${t.nome}`;
      sel.appendChild(opt);
    });

    sel.value = this.turmaId ? String(this.turmaId) : '';

    if (this.turmaId) {
      const ucs = window.db.getUCsPorTurma(this.turmaId);
      if (ucs.length > 0) {
        this.ucId = ucs[0].id;
      }
    } else {
      this.ucId = null;
    }
  }

  aoMudarTurma(novaTurmaId) {
    if (!novaTurmaId) {
      this.turmaId = null;
      this.ucId = null;
      this.atualizarEstadoBloqueio();
      this.adicionarMensagem('bot', '⚠️ **Nenhuma turma selecionada.** Selecione uma turma real no seletor acima antes de iniciar o atendimento com a IA.');
      return;
    }

    this.turmaId = Number(novaTurmaId);
    const ucs = window.db.getUCsPorTurma(this.turmaId);
    this.ucId = ucs.length > 0 ? ucs[0].id : null;
    this.atualizarEstadoBloqueio();

    const turma = window.db.getTurmaById(this.turmaId);
    const msgContexto = `🔄 **Turma selecionada: ${turma?.codigo || ''} - ${turma?.nome || ''}**.\nO chat e os botões rápidos foram liberados com os dados reais desta turma. Como posso ajudar?`;
    this.adicionarMensagem('bot', msgContexto);
  }

  atualizarEstadoBloqueio() {
    const temTurma = Boolean(this.turmaId);
    const liberado = temTurma && !this.isGenerating;

    const input = document.getElementById('inputAssistenteMsg');
    const btnSend = document.getElementById('btnAssistenteEnviar');
    if (input) {
      input.disabled = !liberado;
      input.placeholder = temTurma
        ? 'Digite sua pergunta sobre a turma...'
        : 'Selecione uma turma real acima para iniciar...';
    }
    if (btnSend) {
      btnSend.disabled = !liberado;
      btnSend.style.opacity = liberado ? '' : '0.55';
      btnSend.style.cursor = liberado ? 'pointer' : 'not-allowed';
    }

    document.querySelectorAll('.assistente-quick-card, .assistente-chip-btn').forEach(btn => {
      btn.disabled = !liberado;
      btn.style.opacity = liberado ? '' : '0.55';
      btn.style.cursor = liberado ? 'pointer' : 'not-allowed';
    });
  }

// --- Recarregar Chave do localStorage ---
  recarregarChaveDoStorage() {
    const storedKey = localStorage.getItem('renova_groq_api_key');
    if (storedKey && !storedKey.startsWith('gsk_')) {
      localStorage.removeItem('renova_groq_api_key');
    }
    const storedModel = localStorage.getItem('renova_groq_model');
    if (storedModel && (storedModel === 'llama-3.3-70b-versatile' || storedModel === 'llama-3.1-8b-instant')) {
      localStorage.removeItem('renova_groq_model');
    }
    this.apiKey = window.db?.data?.config?.groqApiKey 
               || localStorage.getItem('renova_groq_api_key') 
               || '';
    this.groqModel = window.db?.data?.config?.groqModel 
                    || localStorage.getItem('renova_groq_model') 
                    || 'qwen/qwen3.8-27b';
  }

  // --- Atualizar Indicador de Chave Groq ---
  atualizarStatusChave() {
    this.recarregarChaveDoStorage();
    const btn = document.getElementById('btnConfigGroq');
    if (!btn) return;

    const isValidKey = this.apiKey && this.apiKey.trim().startsWith('gsk_');

    if (isValidKey) {
      btn.classList.add('key-connected');
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5l9 4.5v13l-9 4.5-9-4.5v-13L16 4.5z" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M16 8.5v15" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 8.5l-9 4.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 8.5l9 4.5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span>Groq Conectado</span>
      `;
    } else {
      btn.classList.remove('key-connected');
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5l9 4.5v13l-9 4.5-9-4.5v-13L16 4.5z" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M16 8.5v15" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 8.5l-9 4.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 8.5l9 4.5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <span>Chave Groq API</span>
      `;
    }
  }

  // --- Modal de Configuração da API Key Groq ---
  abrirModalGroqKey() {
    const input = document.getElementById('inputGroqApiKey');
    if (input) input.value = this.apiKey;
    const modal = document.getElementById('modalConfigGroq');
    if (modal) modal.style.display = 'flex';
  }

  salvarGroqKey() {
    const input = document.getElementById('inputGroqApiKey');
    const valor = input ? input.value.trim() : '';

    if (valor && !valor.startsWith('gsk_')) {
      window.app.mostrarToast('Formato inválido. Chaves da Groq devem começar com "gsk_..."', 'error');
      return;
    }

    this.apiKey = valor;
    localStorage.setItem('renova_groq_api_key', valor);
    this.atualizarStatusChave();
    window.app.fecharModal('modalConfigGroq');

    if (valor) {
      window.app.mostrarToast('Chave Groq salva com sucesso! O assistente agora usará IA generativa em tempo real.', 'success');
      this.adicionarMensagem('bot', '✨ **Chave Groq ativada!** Agora estou conectado aos modelos Llama 3.1 para análises aprofundadas com raciocínio pedagógico.');
    } else {
      window.app.mostrarToast('Modo Local Inteligente ativado (sem API Key).', 'info');
    }
  }

  removerGroqKey() {
    this.apiKey = '';
    localStorage.removeItem('renova_groq_api_key');
    const input = document.getElementById('inputGroqApiKey');
    if (input) input.value = '';
    this.atualizarStatusChave();
    window.app.fecharModal('modalConfigGroq');
    window.app.mostrarToast('Chave removida. Operando no Motor Local Inteligente.', 'info');
  }

  // --- Configuração dos Eventos de UI ---
  configurarEventos() {
    const inputMsg = document.getElementById('inputAssistenteMsg');
    const btnSend = document.getElementById('btnAssistenteEnviar');
    const btnLimpar = document.getElementById('btnAssistenteLimpar');
    const selTurma = document.getElementById('selectTurmaAssistente');

    if (inputMsg && !inputMsg.dataset.bound) {
      inputMsg.dataset.bound = 'true';
      inputMsg.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.enviarMensagemInput();
        }
      });
    }

    if (btnSend && !btnSend.dataset.bound) {
      btnSend.dataset.bound = 'true';
      btnSend.addEventListener('click', () => {
        this.enviarMensagemInput();
      });
    }

    if (btnLimpar && !btnLimpar.dataset.bound) {
      btnLimpar.dataset.bound = 'true';
      btnLimpar.addEventListener('click', () => {
        this.limparConversa();
      });
    }

    if (selTurma && !selTurma.dataset.bound) {
      selTurma.dataset.bound = 'true';
      selTurma.addEventListener('change', (e) => {
        this.aoMudarTurma(e.target.value);
      });
    }

    // Configuração dos Chips / Pré-Opções
    document.querySelectorAll('.assistente-chip-btn').forEach(btn => {
      if (!btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
          const acao = btn.getAttribute('data-action');
          const rotulo = btn.textContent.trim();
          this.executarOpcaoPredefinida(acao, rotulo);
        });
      }
    });
  }

  // --- Mensagem Inicial de Boas-Vindas (Idêntica à Imagem) ---
  exibirMensagemBoasVindas() {
    const container = document.getElementById('assistenteChatMessages');
    if (!container) return;

    container.innerHTML = '';
    this.mensagens = [];

    const isCoord = this._modoCoord || (window.auth && window.auth.isCoordenacao && window.auth.isCoordenacao());
    const turma = window.db ? window.db.getTurmaById(this.turmaId) : null;
    const ucs = window.db ? window.db.getUCsPorTurma(this.turmaId) : [];
    const ucAtual = ucs.find(u => Number(u.id) === Number(this.ucId)) || ucs[0];

    if (!this.turmaId) {
      this.adicionarMensagem(
        'bot',
        '⚠️ **Selecione uma turma real** no campo **"Turma:"** acima antes de iniciar o atendimento com a IA.\n\nO campo de perguntas e os botões de sugestões rápidas serão liberados automaticamente assim que uma turma for selecionada.',
        false
      );
      return;
    }

    const textoBoasVindas = isCoord
      ? 'Olá! Sou o Assistente Técnico Pedagógico da Coordenação SENAI. Posso analisar o desempenho da turma selecionada, índices de evasão, comparativos de frequência e relatórios operacionais. Como posso ajudar?'
      : `Olá! Sou o Assistente Pedagógico do Portal do Professor. Estou acompanhando a turma **${turma ? turma.codigo : 'Selecionada'}** (${ucAtual ? ucAtual.nome : 'Unidade Curricular'}).\n\nPosso ajudar com **plano de aula e conteúdos**, **frequência e faltas**, **avaliações e médias** ou sugestões de recuperação paralela. Como posso ajudar?`;
    this.adicionarMensagem('bot', textoBoasVindas, false);
  }

  limparConversa() {
    this.exibirMensagemBoasVindas();
    window.app.mostrarToast('Conversa reiniciada com sucesso.', 'info');
  }

  // --- Envio de Mensagem Escrita pelo Usuário ---
  enviarMensagemInput() {
    if (!this.turmaId) {
      window.app.mostrarToast('Selecione uma turma real antes de usar o Assistente IA.', 'warning');
      this.atualizarEstadoBloqueio();
      return;
    }
    const input = document.getElementById('inputAssistenteMsg');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto || this.isGenerating) return;

    input.value = '';
    this.processarMensagem(texto);
  }

  // --- Execução de Pré-Opções Rápidas ---
  executarOpcaoPredefinida(acao, rotulo) {
    if (!this.turmaId) {
      window.app.mostrarToast('Selecione uma turma real antes de usar as sugestões rápidas.', 'warning');
      this.atualizarEstadoBloqueio();
      return;
    }
    if (this.isGenerating) return;
    this.processarMensagem(rotulo, acao);
  }

  // --- Fluxo Geral de Processamento ---
  async processarMensagem(textoUsuario, acaoTipo = null) {
    if (!this.turmaId) {
      window.app.mostrarToast('Selecione uma turma real antes de iniciar o atendimento com a IA.', 'warning');
      this.atualizarEstadoBloqueio();
      return;
    }
    // Garante que a chave está atualizada (prioridade: db.config > localStorage válido)
    this.recarregarChaveDoStorage();
    console.log('[Assistente IA] API Key:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'VAZIA');
    
    this.isGenerating = true;
    this.toggleBotoes(false);

    // 1. Renderiza mensagem do usuário no chat
    this.adicionarMensagem('user', textoUsuario);

    // 2. Exibe indicador de digitação
    this.mostrarIndicadorDigitacao();

    try {
      // SEMPRE: Resposta imediata do Motor Local Inteligente
      const respostaLocal = this.gerarRespostaLocal(acaoTipo, textoUsuario);
      this.removerIndicadorDigitacao();
      const msgIndex = this.adicionarMensagem('bot', respostaLocal);

      // SE chave válida (gsk_...): Tenta melhorar com Groq em background
      if (this.apiKey && this.apiKey.trim().startsWith('gsk_')) {
        console.log('[Assistente IA] Chave válida detectada, chamando Groq...');
        try {
          const respostaGroq = await this.chamarGroqAPI(textoUsuario, acaoTipo);
          console.log('[Assistente IA] Resposta Groq recebida, substituindo mensagem...');
          // Substitui a mensagem local pela resposta do Groq
          this.substituirMensagem(msgIndex, respostaGroq);
        } catch (err) {
          console.warn('[Assistente IA] Groq indisponível, mantendo resposta local:', err.message);
          // Mantém resposta local - sem erro visível para o usuário
        }
      } else {
        console.log('[Assistente IA] Chave inválida ou ausente, usando apenas motor local');
      }
    } catch (e) {
      console.error(e);
      this.removerIndicadorDigitacao();
      this.adicionarMensagem('bot', 'Desculpe, ocorreu um erro ao processar sua consulta. Por favor, tente novamente.');
    } finally {
      this.isGenerating = false;
      this.toggleBotoes(true);
      const input = document.getElementById('inputAssistenteMsg');
      if (input) input.focus();
    }
  }

  async chamarGroqAPI(pergunta, acaoTipo) {
    const dadosContexto = this.compilarContextoTurma();

    // --- System prompt adaptado ao perfil ---
    let systemPrompt;
    if (this._modoCoord) {
      // Dados de TODAS as turmas para o coordenador
      const todasTurmas = (window.db.data.turmas || []).filter(t => t.status === 'EM_ANDAMENTO').map(t => {
        const sintese = window.db.getSinteseConsolidada(t.id, null);
        const alunos = sintese?.alunos || [];
        const medias = alunos.filter(a => a.media > 0).map(a => a.media);
        const freqs = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO').map(a => a.freqPorcentagem);
        const emRisco = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO' && (a.media < 70 || a.freqPorcentagem < 75)).length;
        return {
          codigo: t.codigo, nome: t.nome, periodo: t.periodo,
          totalAlunos: t.totalAlunos,
          mediaGeral: medias.length ? (medias.reduce((s,v)=>s+v,0)/medias.length).toFixed(1) : null,
          freqMedia: freqs.length ? (freqs.reduce((s,v)=>s+v,0)/freqs.length).toFixed(1) : null,
          alunosEmRisco: emRisco
        };
      });
      const solicitacoes = (window.db.data.solicitacoesFechamento || []).filter(s => s.status === 'AGUARDANDO').length;
      systemPrompt = `Você é o Assistente Técnico Pedagógico da Coordenação SENAI São Paulo.
Seu papel é apoiar o coordenador pedagógico com análises estratégicas e operacionais.

Diretrizes SENAI-SP:
- Média mínima de aprovação: 70 pontos (escala 0-100).
- Frequência mínima obrigatória: 75%. Abaixo disso o aluno é retido por faltas.
- 5 atrasos geram obrigação de compensação formal.
- Foco: evasão, desempenho por turma, risco pedagógico e relatórios operacionais.
- Use linguagem técnica e direta, com tabelas comparativas quando útil.
- Sugira intervenções pedagógicas e ações de gestão quando necessário.

DADOS CONSOLIDADOS DE TODAS AS TURMAS ATIVAS:
${JSON.stringify(todasTurmas, null, 2)}

DIÁRIOS AGUARDANDO APROVAÇÃO DE FECHAMENTO: ${solicitacoes}`;
    } else {
      systemPrompt = `Você é o Assistente de Inteligência Artificial integrado ao Portal do Docente do SENAI São Paulo.
Seu papel é atuar como assessor pedagógico e analista de dados acadêmicos para o professor da turma.

Regras e Diretrizes do SENAI-SP:
- Média de aprovação: 70 pontos (escala 0-100). Notas abaixo de 70 exigem recuperação paralela.
- Frequência mínima obrigatória por lei e regimento: 75%. Abaixo de 75% o aluno é retido por faltas.
- Acúmulo de 5 atrasos gera obrigação de compensação de ausência e notificação formal à coordenação.
- Alunos com status TRANCADO ou CANCELADO têm lançamentos bloqueados (Status X).
- Mantenha sempre um tom profissional, cordial, altamente pedagógico, claro e resolutivo.
- Utilize markdown rico: tópicos com hífen (-), destaques em negrito (**), listas e subtítulos para facilitar leitura rápida do docente em sala de aula.
- Caso o professor pergunte sobre planos de ação ou recuperação, sugira intervenções práticas compatíveis com cursos técnicos do SENAI.

DADOS REAIS E ATUAIS DA TURMA E DIÁRIO DE CLASSE:
${JSON.stringify(dadosContexto, null, 2)}`;
    }

    const promptFinal = acaoTipo 
      ? `Ação solicitada: [${acaoTipo}]. Pergunta/Comando do docente: "${pergunta}". Analise os dados fornecidos e gere a resposta correspondente.`
      : pergunta;

    if (!this.apiKey || !this.apiKey.trim().startsWith('gsk_')) {
      throw new Error('Chave Groq inválida: deve começar com gsk_');
    }

    const url = 'https://api.groq.com/openai/v1/chat/completions';

    console.log('[Assistente IA] DEBUG - this.groqModel:', this.groqModel, '| window.db?.data?.config?.groqModel:', window.db?.data?.config?.groqModel, '| localStorage renova_groq_model:', localStorage.getItem('renova_groq_model'));
    const payload = {
      model: this.groqModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptFinal }
      ],
      temperature: 0.4,
      max_tokens: 2048
    };

    console.log('[Assistente IA] Chamando Groq API...', { url, model: this.groqModel });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    console.log('[Assistente IA] Groq response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msgErro = errorData?.error?.message || `Erro HTTP ${response.status}`;
      console.error('[Assistente IA] Groq API error:', msgErro);
      throw new Error(msgErro);
    }

    const data = await response.json();
    console.log('[Assistente IA] Groq response data:', data);
    const textoGerado = data?.choices?.[0]?.message?.content;
    if (!textoGerado) {
      throw new Error('Resposta vazia retornada pelo modelo Groq.');
    }

    return textoGerado;
  }

  // --- Compilação de Dados da Turma para a IA ---
  compilarContextoTurma() {
    const turma = window.db.getTurmaById(this.turmaId);
    const ucs = window.db.getUCsPorTurma(this.turmaId);
    const ucAtual = ucs.find(u => u.id === this.ucId) || ucs[0];
    const sintese = window.db.getSinteseConsolidada(this.turmaId, this.ucId);
    const ocorrencias = window.db.getOcorrencias('TODAS');
    const compensacoes = window.db.getCompensacoes(this.turmaId);
    const justificativas = window.db.getJustificativas();
    const avaliacoes = window.db.getAvaliacoesPorUC ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    const aulasMinistradas = (window.db.data.aulas || [])
      .filter(a => Number(a.turmaId) === Number(this.turmaId) && Number(a.ucId) === Number(this.ucId))
      .slice(-6)
      .map(a => ({ data: a.data, conteudo: a.conteudoMinistrado || a.conteudo || '' }));

    return {
      turma: {
        id: turma?.id,
        codigo: turma?.codigo,
        nome: turma?.nome,
        periodo: turma?.periodo,
        semestre: turma?.semestre,
        status: turma?.status,
        totalAlunos: turma?.totalAlunos
      },
      unidadeCurricularAtual: {
        id: ucAtual?.id,
        codigo: ucAtual?.codigo,
        nome: ucAtual?.nome,
        cargaHoraria: ucAtual?.cargaHoraria,
        conteudosProgramados: ucAtual?.conteudosProgramados || []
      },
      aulasMinistradasRecentes: aulasMinistradas,
      avaliacoesCadastradas: avaliacoes.map(a => ({
        id: a.id,
        titulo: a.titulo,
        tipo: a.tipo,
        peso: a.peso,
        data: a.data
      })),
      resumoAcademico: {
        totalAulasDadas: sintese?.totalAulasDadas,
        totalAlunosTurma: sintese?.totalAlunos,
        alunos: (sintese?.alunos || []).map(item => ({
          id: item.aluno.id,
          nome: item.aluno.nome,
          matricula: item.aluno.matricula,
          statusMatricula: item.aluno.statusMatricula,
          presencas: item.presencas,
          faltas: item.faltas,
          atrasos: item.atrasos,
          dispensas: item.dispensas,
          freqPorcentagem: item.freqPorcentagem,
          media: item.media,
          situacaoFinal: item.situacaoFinal
        }))
      },
      ocorrenciasRecentes: ocorrencias.slice(0, 8),
      compensacoesAtrasos: compensacoes.slice(0, 6),
      justificativasAtestados: justificativas.slice(0, 6)
    };
  }

  // --- Motor Local Inteligente (Executado quando sem API Key ou Offline) ---
  gerarRespostaLocal(acaoTipo, textoUsuario) {
    const turma = window.db.getTurmaById(this.turmaId);
    const ucs = window.db.getUCsPorTurma(this.turmaId);
    const ucAtual = ucs.find(u => u.id === this.ucId) || ucs[0];
    const sintese = window.db.getSinteseConsolidada(this.turmaId, this.ucId);
    const alunos = sintese?.alunos || [];

    const acao = acaoTipo || this.inferirAcaoPorTexto(textoUsuario);

    switch (acao) {
      // --- PROFESSOR: PLANO DE AULA & CONTEÚDOS ---
      case 'plano_aula': {
        const conteudosPtd = ucAtual && Array.isArray(ucAtual.conteudosProgramados) ? ucAtual.conteudosProgramados : [];
        const aulasRecentes = (window.db.data.aulas || [])
          .filter(a => Number(a.turmaId) === Number(this.turmaId) && Number(a.ucId) === Number(this.ucId))
          .slice(-5);

        let resp = `**Plano de Aula e Conteúdos — ${turma?.codigo || ''} (${ucAtual?.nome || 'UC'})**\n\n`;
        if (conteudosPtd.length > 0) {
          resp += `**Conteúdos Programados (PTD):**\n` + conteudosPtd.map((c, i) => `- ${i + 1}. **${c.tema || c.titulo || 'Tópico'}:** ${c.conteudo || c.descricao || ''}`).join('\n') + '\n\n';
        } else {
          resp += `Nenhum tópico do PTD cadastrado diretamente na UC ainda. Você pode editar ou importar o PTD no painel.\n\n`;
        }
        if (aulasRecentes.length > 0) {
          resp += `**Últimas Aulas Ministradas:**\n` + aulasRecentes.map(a => `- **${a.data}:** ${a.conteudoMinistrado || a.conteudo || 'Registro de chamada sem descrição'}`).join('\n');
        } else {
          resp += `**Últimas Aulas Ministradas:** Ainda não há registros de conteúdo ministrado lançados no Diário para esta UC.`;
        }
        return resp;
      }

      // --- PROFESSOR: FREQUÊNCIA E FALTAS ---
      case 'frequencia_faltas': {
        const ativos = alunos.filter(a => a.aluno && a.aluno.statusMatricula === 'ATIVO');
        const freqMedia = ativos.length ? (ativos.reduce((s, a) => s + Number(a.freqPorcentagem || 0), 0) / ativos.length).toFixed(1) : '100.0';
        const criticos = ativos.filter(a => a.freqPorcentagem < 75);
        const alerta = ativos.filter(a => a.freqPorcentagem >= 75 && a.freqPorcentagem < 85);

        let resp = `**Panorama de Frequência e Faltas — ${turma?.codigo || ''}**\n\n`;
        resp += `- **Frequência Média da Turma:** ${freqMedia}%\n`;
        resp += `- **Total de Alunos Ativos:** ${ativos.length}\n`;
        resp += `- **Em Situação Crítica (< 75%):** ${criticos.length} aluno(s)\n`;
        resp += `- **Em Zona de Atenção (75% a 84,9%):** ${alerta.length} aluno(s)\n\n`;

        if (criticos.length > 0) {
          resp += `**Alunos Críticos (< 75%):**\n` + criticos.map(a => `- **${a.aluno.nome}** — ${a.freqPorcentagem.toFixed(1)}% (${a.faltas} falta(s))`).join('\n');
        } else {
          resp += `Todos os alunos ativos estão acima do limite mínimo regimental de 75% de presença.`;
        }
        return resp;
      }

      // --- PROFESSOR: AVALIAÇÕES E MÉDIAS DA UC ---
      case 'avaliacoes_medias': {
        const avals = window.db.getAvaliacoesPorUC ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
        const somaPesos = avals.reduce((s, a) => s + (Number(a.peso) || 1), 0);
        const ativos = alunos.filter(a => a.aluno && a.aluno.statusMatricula === 'ATIVO');
        const comMedia = ativos.filter(a => a.media > 0);
        const mediaTurma = comMedia.length ? (comMedia.reduce((s, a) => s + a.media, 0) / comMedia.length).toFixed(1) : '—';
        const abaixo70 = comMedia.filter(a => a.media < 70);

        let resp = `**Avaliações e Médias — ${turma?.codigo || ''} (${ucAtual?.nome || 'UC'})**\n\n`;
        resp += `- **Avaliações Cadastradas na UC:** ${avals.length} (Soma dos Pesos: ${somaPesos.toFixed(1)})\n`;
        resp += `- **Média Geral da Turma:** ${mediaTurma} / 100\n`;
        resp += `- **Abaixo da Média (< 70):** ${abaixo70.length} aluno(s)\n\n`;

        if (avals.length > 0) {
          resp += `**Instrumentos Avaliativos:**\n` + avals.map(a => `- **${a.titulo}** (${a.tipo}) • Peso: ${a.peso || 1} • Data: ${a.data || '—'}`).join('\n') + '\n\n';
        }
        if (abaixo70.length > 0) {
          resp += `**Estudantes para Recuperação Paralela (< 70):**\n` + abaixo70.map(a => `- **${a.aluno.nome}** — Média: ${a.media.toFixed(1)}`).join('\n');
        }
        return resp;
      }

      // --- COORDENADOR: MÉDIA DE TODAS AS TURMAS ---
      case 'medias_turmas': {
        const turmas = (window.db.data.turmas || []).filter(t => t.status === 'EM_ANDAMENTO');
        if (turmas.length === 0) {
          return '📊 Não há turmas em andamento registradas no sistema no momento.';
        }

        let somaGlobal = 0;
        let countGlobal = 0;
        let somaFreqGlobal = 0;
        let countAlunosGlobal = 0;

        let tabelaMd = '| Turma | Curso | Alunos | Média Geral | Frequência | Situação |\n| :--- | :--- | :---: | :---: | :---: | :---: |\n';

        turmas.forEach(t => {
          const sint = window.db.getSinteseConsolidada(t.id, null);
          const alunosT = (sint && sint.alunos) || [];
          const totalAtivos = alunosT.filter(a => a.aluno.statusMatricula === 'ATIVO').length;
          countAlunosGlobal += totalAtivos;

          let somaMedias = 0;
          let countMedias = 0;
          let somaFreq = 0;

          alunosT.forEach(a => {
            if (a.aluno.statusMatricula === 'ATIVO') {
              if (a.media > 0) {
                somaMedias += a.media;
                countMedias++;
                somaGlobal += a.media;
                countGlobal++;
              }
              somaFreq += a.freqPorcentagem;
              somaFreqGlobal += a.freqPorcentagem;
            }
          });

          const mTurma = countMedias > 0 ? (somaMedias / countMedias).toFixed(1) : '—';
          const fTurma = totalAtivos > 0 ? (somaFreq / totalAtivos).toFixed(1) + '%' : '100%';
          const sit = (Number(mTurma) >= 70 && parseFloat(fTurma) >= 75) ? '✅ Adequada' : '⚠️ Atenção';

          tabelaMd += `| **${t.codigo}** | ${t.nome.split('-')[0].trim()} | ${totalAtivos} | **${mTurma}** | ${fTurma} | ${sit} |\n`;
        });

        const mediaEscola = countGlobal > 0 ? (somaGlobal / countGlobal).toFixed(1) : '78.5';
        const freqEscola = countAlunosGlobal > 0 ? (somaFreqGlobal / countAlunosGlobal).toFixed(1) : '86.2';

        return `🏆 **Média Consolidada de Todas as Turmas em Andamento**\n**Escola SENAI ROBERTO SIMONSEN**\n\n` +
          tabelaMd +
          `\n📌 **Síntese Institucional:**\n` +
          `- **Total de Turmas Analisadas:** ${turmas.length} turmas ativas (${countAlunosGlobal} estudantes matriculados)\n` +
          `- **Média Global da Escola:** **${mediaEscola}** / 100 pts (Meta Regimental: 70.0 pts)\n` +
          `- **Frequência Média Escolar:** **${freqEscola}%** (Mínimo obrigatório: 75.0%)\n\n` +
          `💡 *Recomendação da Coordenação:* Concentrar intervenções pedagógicas e suporte psicopedagógico nas turmas sinalizadas com alerta de frequência ou nota média abaixo de 75.0.`;
      }

      // --- ORIENTADOR: RADAR DO DIA & PRIORIDADES ---
      case 'radar_dia': {
        const radar = window.db.getRadarOrientador ? window.db.getRadarOrientador(this.turmaId) : null;
        if (!radar) return '🚨 Dados do Radar do Dia não disponíveis para esta turma.';

        const kpis = radar.kpis;
        const fila = radar.filaUrgencia || [];

        let resposta = `🚨 **Radar do Dia — Prioridades da Orientação Educacional**\n` +
          `**SENAI ROBERTO SIMONSEN** • Turma: **${turma?.codigo || 'TDS'}**\n\n` +
          `📊 **Indicadores do Dia:**\n` +
          `- **Faltas sem Justificativa:** **${kpis.faltasSemJustificativa} ausências** não abonadas\n` +
          `- **Alunos com 5+ Atrasos:** **${kpis.alunosCom5Atrasos} estudantes** reincidentes\n` +
          `- **Atestados Aguardando Validação:** **${kpis.atestadosAguardando} solicitações**\n` +
          `- **Compensações em Aberto:** **${kpis.compensacoesEmAberto} planos** pendentes\n\n`;

        if (fila.length > 0) {
          resposta += `📋 **Casos Prioritários na Fila de Urgência (${fila.length} identificados):**\n`;
          fila.slice(0, 5).forEach((item, idx) => {
            const statusC = item.contatoHoje ? `✅ Contato feito (${item.contatoHoje.canal})` : '⚠️ Sem contato hoje';
            resposta += `${idx + 1}. **${item.aluno.nome}** (Freq: ${item.hist?.freqPorcentagem || 100}%)\n` +
              `   • Motivo: *${item.motivoUrgencia}*\n` +
              `   • Situação de Contato: ${statusC}\n`;
          });
        } else {
          resposta += '✅ **Nenhum caso urgente hoje!** Todas as ausências estão justificadas e compensações em dia.';
        }

        return resposta;
      }

      // --- ORIENTADOR: ATESTADOS PENDENTES ---
      case 'atestados_pendentes': {
        const justs = (window.db.data.justificativas || []).filter(j => j.status === 'PENDENTE');
        if (justs.length === 0) {
          return '✅ **Nenhum atestado pendente!** Todas as justificativas enviadas pelos alunos foram homologadas ou arquivadas.';
        }

        let resp = `📄 **Atestados Médicos e Declarações Aguardando Homologação (${justs.length} pendentes)**\n\n`;
        justs.forEach((j, idx) => {
          resp += `${idx + 1}. **${j.alunoNome}** (Período: ${j.dataInicio} a ${j.dataFim})\n` +
            `   • Motivo: *${j.tipo}*\n` +
            `   • Comprovante: ${j.documento || 'atestado_medico.pdf'}\n` +
            `   • Observação do Aluno: ${j.motivo || 'Sem observações'}\n\n`;
        });
        resp += '💡 *Ação:* Acesse a aba **Faltas & Atestados** para homologar o abono ou converter em compensação pedagógica.';
        return resp;
      }

      // --- ORIENTADOR: COMPENSAÇÕES EM ABERTO ---
      case 'compensacoes_abertas': {
        const comps = (window.db.data.compensacoes || []).filter(c => c.status !== 'CUMPRIDO');
        if (comps.length === 0) {
          return '✅ **Todas as compensações cumpridas!** Não há reposições de ausência pendentes na unidade.';
        }

        let resp = `🔄 **Compensações de Ausência em Aberto (${comps.length} planos)**\n\n`;
        comps.forEach((c, idx) => {
          resp += `${idx + 1}. **${c.alunoNome}** — **${c.horasObrigacao}h** de obrigação\n` +
            `   • Data Agendada: **${c.dataAgendada || c.dataLimite}** (${c.turno || 'Contraturno'})\n` +
            `   • Atividade: ${c.atividadeDescricao || 'Atividade de reposição'}\n` +
            `   • Status: ${c.status === 'AGENDADA' ? '📅 Agendada' : '⏳ Pendente'}\n\n`;
        });
        return resp;
      }

      case 'resumo': {
        const total = alunos.length;
        const ativos = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO').length;
        const trancados = alunos.filter(a => a.aluno.statusMatricula === 'TRANCADO' || a.aluno.statusMatricula === 'CANCELADO').length;
        
        let somaMedias = 0;
        let countMedias = 0;
        let somaFreq = 0;
        let countRisco = 0;

        alunos.forEach(a => {
          if (a.aluno.statusMatricula === 'ATIVO') {
            if (a.media > 0) {
              somaMedias += a.media;
              countMedias++;
            }
            somaFreq += a.freqPorcentagem;
            if (a.media < 70 || a.freqPorcentagem < 80) {
              countRisco++;
            }
          }
        });

        const mediaGeral = countMedias > 0 ? (somaMedias / countMedias).toFixed(1) : '75.0';
        const freqGeral = ativos > 0 ? (somaFreq / ativos).toFixed(1) : '85.0';

        return `📊 **Resumo Geral da Turma**\n**${turma?.codigo || ''} - ${turma?.nome || ''}**\n**Unidade Curricular:** ${ucAtual?.nome || 'Desenvolvimento Web'}\n\n` +
          `- **Total de Estudantes:** ${total} matriculados (${ativos} ativos, ${trancados} com status especial/trancado)\n` +
          `- **Média Geral da Turma:** **${mediaGeral}** / 100 pts (Meta Regimental SENAI: 70.0 pts)\n` +
          `- **Frequência Média:** **${freqGeral}%** (Mínimo obrigatório: 75.0%)\n` +
          `- **Aulas Ministradas até o momento:** ${sintese?.totalAulasDadas || 28} horas-aula\n` +
          `- **Alunos em Situação de Alerta/Risco:** **${countRisco} estudantes** com pendências de nota ou frequência.\n\n` +
          `💡 *Dica:* Clique em **"Alunos em risco"** ou **"Plano de ação"** para ver a lista nominal e intervenções recomendadas.`;
      }

      case 'risco': {
        const emRisco = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO' && (a.media < 70 || a.freqPorcentagem < 80));

        if (emRisco.length === 0) {
          return `✅ **Excelente notícia!** Não há alunos em situação de risco na turma **${turma?.codigo}** no momento. Todos estão com média ≥ 70 e frequência ≥ 80%.`;
        }

        let txt = `⚠️ **Diagnóstico de Alunos em Risco (${emRisco.length} identificados)**\n` +
          `Turma: ${turma?.codigo} • Critérios: Nota < 70 ou Frequência < 80%\n\n`;

        emRisco.forEach((item, idx) => {
          const alertaNota = item.media < 70 ? `❌ Nota: **${item.media}** (Abaixo de 70)` : `✅ Nota: ${item.media}`;
          const alertaFreq = item.freqPorcentagem < 75 
            ? `🚨 Freq: **${item.freqPorcentagem}%** (Retenção Iminente)` 
            : (item.freqPorcentagem < 80 ? `⚠️ Freq: **${item.freqPorcentagem}%** (Zona de Alerta)` : `✅ Freq: ${item.freqPorcentagem}%`);
          
          txt += `${idx + 1}. **${item.aluno.nome}** (Matrícula: ${item.aluno.matricula})\n` +
            `   • ${alertaNota} | ${alertaFreq}\n` +
            `   • Faltas acumuladas: ${item.faltas} | Atrasos: ${item.atrasos}\n` +
            `   • Situação: *${item.situacaoFinal}*\n\n`;
        });

        txt += `📌 **Recomendação do Assistente:** Agendar recuperação paralela nos critérios de menor pontuação e acionar a coordenação pedagógica para acolhimento dos estudantes com baixa frequência.`;
        return txt;
      }

      case 'plano': {
        return `📋 **Plano de Ação Pedagógica Recomendado**\n**Turma:** ${turma?.codigo} - ${turma?.nome}\n\n` +
          `Com base nos dados atuais da turma, estruturei um plano de intervenção em 3 etapas:\n\n` +
          `**1. Eixo Recuperação de Aprendizagem (Notas < 70):**\n` +
          `- **Oficina Prática Guiada:** Aplicação de exercício de fixação focado nos critérios não atingidos na última avaliação prática.\n` +
          `- **Instrumento de Nova Oportunidade:** Aplicação de instrumento avaliativo de recuperação paralela conforme regimento SENAI-SP.\n\n` +
          `**2. Eixo Prevenção de Faltas e Evasão (Frequência < 80%):**\n` +
          `- **Alinhamento com Secretaria/Coordenação:** Notificar formalmente os responsáveis dos alunos com frequência abaixo de 78%.\n` +
          `- **Compensação de Ausências:** Agendar atividades complementares de 2 horas para alunos que acumularam atrasos ou faltas justificadas.\n\n` +
          `**3. Eixo Metodologias Ativas:**\n` +
          `- **Pareamento Colaborativo:** Formar duplas de laboratório mesclando alunos de alto rendimento com alunos que necessitam de apoio nos conceitos práticos.`;
      }

      case 'ausentes': {
        const ultimasAulas = window.db.data.aulas
          .filter(a => a.turmaId === this.turmaId)
          .sort((a, b) => new Date(b.data) - new Date(a.data));

        const aulaRecente = ultimasAulas[0];
        if (!aulaRecente || !aulaRecente.frequencias) {
          return `📅 Não foram localizados registros de chamada recentes para a turma **${turma?.codigo}**. Realize a chamada no módulo Diário de Classe.`;
        }

        const ausentes = [];
        const atrasados = [];
        const dispensados = [];

        Object.entries(aulaRecente.frequencias).forEach(([alunoId, listaStatus]) => {
          const aluno = window.db.getAlunoById(alunoId);
          if (!aluno) return;

          if (listaStatus.includes('F')) {
            ausentes.push(aluno.nome);
          } else if (listaStatus.includes('A')) {
            atrasados.push(aluno.nome);
          } else if (listaStatus.includes('D')) {
            dispensados.push(aluno.nome);
          }
        });

        let txt = `📅 **Relatório de Frequência da Última Aula (${aulaRecente.data})**\n` +
          `Turma: ${turma?.codigo} • Período: ${aulaRecente.periodo || 'Tarde'}\n\n`;

        if (ausentes.length > 0) {
          txt += `❌ **Ausentes / Faltas (${ausentes.length}):**\n` + ausentes.map(n => `- ${n}`).join('\n') + `\n\n`;
        } else {
          txt += `✅ **Nenhuma falta não justificada registrada nesta data!**\n\n`;
        }

        if (atrasados.length > 0) {
          txt += `⏰ **Atrasos Registrados (${atrasados.length}):**\n` + atrasados.map(n => `- ${n} (A)`).join('\n') + `\n\n`;
        }

        if (dispensados.length > 0) {
          txt += `🏥 **Dispensas / Atestados Homologados (${dispensados.length}):**\n` + dispensados.map(n => `- ${n} [Atestado homologado pela coordenação]`).join('\n') + `\n\n`;
        }

        return txt;
      }

      case 'media': {
        const notasValidas = alunos
          .filter(a => a.aluno.statusMatricula === 'ATIVO' && a.media > 0)
          .map(a => a.media);

        if (notasValidas.length === 0) {
          return `📈 Ainda não há avaliações consolidadas lançadas no sistema para a turma **${turma?.codigo}**. Acesse a aba **Notas** para lançar instrumentos avaliativos.`;
        }

        const soma = notasValidas.reduce((acc, v) => acc + v, 0);
        const mediaGeral = (soma / notasValidas.length).toFixed(1);
        const maior = Math.max(...notasValidas).toFixed(1);
        const menor = Math.min(...notasValidas).toFixed(1);

        const acimaMeta = notasValidas.filter(n => n >= 70).length;
        const abaixoMeta = notasValidas.filter(n => n < 70).length;

        return `📈 **Estatísticas de Rendimento e Média da Turma**\n**${turma?.codigo} - ${turma?.nome}**\n\n` +
          `- **Média Aritmética Geral:** **${mediaGeral} pts** (Meta SENAI: 70.0)\n` +
          `- **Maior Nota Registrada:** **${maior} pts**\n` +
          `- **Menor Nota Registrada:** **${menor} pts**\n` +
          `- **Distribuição:**\n` +
          `  • ✅ Alunos com média ≥ 70: **${acimaMeta}** (${Math.round((acimaMeta / notasValidas.length) * 100)}%)\n` +
          `  • ⚠️ Alunos com média < 70: **${abaixoMeta}** (${Math.round((abaixoMeta / notasValidas.length) * 100)}%)\n\n` +
          `O rendimento global da turma é considerado **${mediaGeral >= 75 ? 'SATISFATÓRIO' : 'EM ATENÇÃO'}**.`;
      }

      case 'abaixo70': {
        const reprovados = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO' && a.media < 70);

        if (reprovados.length === 0) {
          return `🎉 **Parabéns!** Nenhum aluno ativo da turma **${turma?.codigo}** está com média abaixo de 70. Todos atingiram a meta mínima de aprovação!`;
        }

        let txt = `📉 **Alunos com Notas Abaixo de 70 (${reprovados.length} encontrados):**\n` +
          `Turma: ${turma?.codigo} • Meta de aprovação SENAI: 70.0 pts\n\n`;

        reprovados.forEach((item, i) => {
          const deficit = (70 - item.media).toFixed(1);
          txt += `${i + 1}. **${item.aluno.nome}** (Matrícula: ${item.aluno.matricula})\n` +
            `   • Média Atual: **${item.media} pts** (Necessita de +${deficit} pts para aprovação)\n` +
            `   • Situação: *${item.situacaoFinal}*\n\n`;
        });

        txt += `💡 *Ação Sugerida:* Realizar plantão de dúvidas focado e disponibilizar lista de exercícios complementares para recuperação de nota.`;
        return txt;
      }

      case 'freq80': {
        const baixaFreq = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO' && a.freqPorcentagem < 80);

        if (baixaFreq.length === 0) {
          return `🌟 Excelente! Todos os alunos da turma **${turma?.codigo}** estão com presença igual ou superior a **80%**.`;
        }

        let txt = `🚨 **Alunos com Frequência Crítica (< 80%):**\n` +
          `Turma: ${turma?.codigo} • Limite regimental para reprovação direta por faltas: 75.0%\n\n`;

        baixaFreq.forEach((item, i) => {
          const statusFalta = item.freqPorcentagem < 75 
            ? '🔴 **RETENÇÃO POR FALTA ATINGIDA**' 
            : '🟡 **EM ALERTA VERMELHO (Próximo dos 75%)**';

          txt += `${i + 1}. **${item.aluno.nome}**\n` +
            `   • Percentual de Presença: **${item.freqPorcentagem}%**\n` +
            `   • Status: ${statusFalta}\n` +
            `   • Faltas Registradas: ${item.faltas} | Atrasos: ${item.atrasos}\n\n`;
        });

        txt += `⚠️ *Aviso Regimental:* Conforme norma do SENAI-SP, alunos com frequência inferior a 75% não obtêm aprovação no componente curricular, salvo compensação formal aprovada pela coordenação.`;
        return txt;
      }

      case 'observacoes': {
        const justificativas = window.db.getJustificativas();
        const trancados = alunos.filter(a => a.aluno.statusMatricula === 'TRANCADO' || a.aluno.statusMatricula === 'CANCELADO');

        return `📝 **Observações Pedagógicas Consolidadas**\n**Turma:** ${turma?.codigo} - ${turma?.nome}\n\n` +
          `- **Atestados Médicos e Dispensas Ativas:** ${justificativas.length} registros homologados pela coordenação na secretaria escolar.\n` +
          `- **Status Especial de Matrícula (Status X):** ${trancados.length} estudantes com matrícula trancada ou cancelada (frequência bloqueada conforme regimento).\n` +
          `- **Prazo Regimental de Alteração:** O prazo para alteração histórica de presenças e notas está configurado em **${window.db.data.config.prazoEdicaoDias || 7} dias**.\n` +
          `- **Clima de Sala de Aula:** Boa participação geral nas aulas práticas de desenvolvimento e laboratório.`;
      }

      case 'ocorrencias': {
        const ocorrencias = window.db.getOcorrencias('TODAS');
        if (ocorrencias.length === 0) {
          return `ℹ️ Não há ocorrências disciplinares ou pedagógicas registradas no sistema para a turma **${turma?.codigo}**.`;
        }

        let txt = `📋 **Relatório de Ocorrências Registradas (${ocorrencias.length})**\n\n`;
        ocorrencias.slice(0, 6).forEach((oc, i) => {
          const aluno = window.db.getAlunoById(oc.alunoId);
          txt += `${i + 1}. **[${oc.tipo}]** Aluno: **${aluno ? aluno.nome : 'Geral'}**\n` +
            `   • Data: ${oc.data} | Origem: ${oc.origem}\n` +
            `   • Descrição: "${oc.descricao}"\n\n`;
        });

        return txt;
      }

      case 'reservas': {
        return `🏛️ **Status de Ambientes e Recursos da Turma**\n**Turma:** ${turma?.codigo}\n\n` +
          `- **Sala de Aula Teórica:** Sala 204 - Bloco A (Equipada com Projetor Interativo)\n` +
          `- **Laboratório Principal:** Lab de Informática 03 (32 máquinas com VS Code, Node.js e Docker)\n` +
          `- **Status da Reserva Atual:** ✅ Confirmada e Ativa para as aulas regulares de ${turma?.periodo || 'Tarde'}\n` +
          `- **Próximas Reservas de Eventos:** Auditório Principal pré-agendado para a apresentação dos TCCs ao final do semestre.`;
      }

      case 'destaques': {
        const destaques = alunos
          .filter(a => a.aluno.statusMatricula === 'ATIVO' && a.media >= 85 && a.freqPorcentagem >= 90)
          .sort((a, b) => b.media - a.media);

        if (destaques.length === 0) {
          return `👏 Há vários alunos com bom desempenho, porém nenhum atingiu simultaneamente média ≥ 85 e presença ≥ 90% nesta etapa.`;
        }

        let txt = `🏆 **Alunos Destaque da Turma (${destaques.length} estudantes):**\n` +
          `Critérios: Média ≥ 85 pts e Frequência ≥ 90%\n\n`;

        destaques.forEach((item, i) => {
          txt += `${i + 1}. ⭐ **${item.aluno.nome}** (Matrícula: ${item.aluno.matricula})\n` +
            `   • Média Acadêmica: **${item.media} pts**\n` +
            `   • Frequência Excepcional: **${item.freqPorcentagem}%**\n` +
            `   • Perfil: Alto engajamento técnico, assiduidade e colaboração em equipe.\n\n`;
        });

        txt += `💡 *Sugestão:* Convidar esses alunos para atuar como monitores auxiliares nas atividades práticas de nivelamento da turma.`;
        return txt;
      }

      default: {
        // Resposta para texto livre sem API Key
        // Tenta achar aluno mencionado pelo nome
        const nomeEncontrado = alunos.find(a => textoUsuario.toLowerCase().includes(a.aluno.nome.toLowerCase().split(' ')[0]));
        if (nomeEncontrado) {
          return `🔍 **Dados Localizados do Aluno:**\n` +
            `**Nome:** ${nomeEncontrado.aluno.nome}\n` +
            `**Matrícula:** ${nomeEncontrado.aluno.matricula}\n` +
            `**Média Atual:** ${nomeEncontrado.media} pts\n` +
            `**Frequência:** ${nomeEncontrado.freqPorcentagem}% (Faltas: ${nomeEncontrado.faltas}, Atrasos: ${nomeEncontrado.atrasos})\n` +
            `**Situação Regimental:** *${nomeEncontrado.situacaoFinal}*\n\n` +
            `Precisa de um plano de recuperação ou mais detalhes sobre este estudante?`;
        }

        // Verificação inteligente de consulta nominal a alunos na base local
        const todosAlunos = (window.db.data.alunos || []);
        const tLower = (textoUsuario || '').toLowerCase();
        const alunoEncontrado = todosAlunos.find(a => tLower.includes((a.nome || '').toLowerCase().split(' ')[0]));
        if (alunoEncontrado) {
          const sint = window.db.getSinteseConsolidada(alunoEncontrado.turmaId, null);
          const hist = (sint?.alunos || []).find(i => i.aluno.id === alunoEncontrado.id) || { faltas: 0, atrasos: 0, freqPorcentagem: 100, media: 80 };
          const justsAluno = (window.db.data.justificativas || []).filter(j => j.alunoId === alunoEncontrado.id);
          const compsAluno = (window.db.data.compensacoes || []).filter(c => c.alunoId === alunoEncontrado.id);
          const contsAluno = (window.db.data.contatosOrientacao || []).filter(c => c.alunoId === alunoEncontrado.id);

          return `👤 **Ficha Pedagógica & Assiduidade: ${alunoEncontrado.nome}**\n` +
            `Matrícula: ${alunoEncontrado.ra || 'RA' + alunoEncontrado.id} • Turma: ${alunoEncontrado.turmaId}\n\n` +
            `- **Frequência Geral:** **${hist.freqPorcentagem}%** (${hist.faltas} faltas registradas, ${hist.atrasos} atrasos)\n` +
            `- **Média Acadêmica:** **${hist.media}** / 100 pts\n` +
            `- **Atestados:** ${justsAluno.length} enviados (${justsAluno.filter(j => j.status === 'PENDENTE').length} aguardando validação)\n` +
            `- **Compensações:** ${compsAluno.length} registradas (${compsAluno.filter(c => c.status !== 'CUMPRIDO').length} pendentes)\n` +
            `- **Último Contato Realizado:** ${contsAluno.length > 0 ? (contsAluno[0].data + ' via ' + contsAluno[0].canal) : 'Sem contato registrado'}\n\n` +
            `📌 *Parecer do Assistente:* ${hist.freqPorcentagem < 75 ? '⚠️ ATENÇÃO: Estudante com risco de retenção por falta. Recomendada busca ativa imediata.' : '✅ Aluno com frequência e desempenho regulares.'}`;
        }

        return `🤖 Analisei os registros reais da turma **${turma?.codigo || ''} - ${turma?.nome || ''}**.\n\n` +
          `Você pode consultar instantaneamente pelos botões rápidos abaixo (Alunos em risco, Médias, Frequência, Plano de Aula, Ausentes, Ocorrências) ou perguntar diretamente pelo nome de um estudante desta turma.`;
      }
    }
  }

  inferirAcaoPorTexto(texto) {
    const t = texto.toLowerCase();
    if (t.includes('conteúdo') || t.includes('conteudo') || t.includes('plano de aula') || t.includes('ptd') || t.includes('ministrad')) return 'plano_aula';
    if (t.includes('avaliaç') || t.includes('avaliac') || t.includes('prova') || t.includes('peso')) return 'avaliacoes_medias';
    if (t.includes('frequência e faltas') || t.includes('frequencia e faltas')) return 'frequencia_faltas';
    if (t.includes('resumo') || t.includes('geral') || t.includes('panorama')) return 'resumo';
    if (t.includes('risco') || t.includes('perigo') || t.includes('alerta')) return 'risco';
    if (t.includes('plano') || t.includes('ação') || t.includes('interven')) return 'plano';
    if (t.includes('ausente') || t.includes('falta') || t.includes('hoje')) return 'ausentes';
    if (t.includes('média') || t.includes('media') || t.includes('desempenho')) return 'media';
    if (t.includes('abaixo de 70') || t.includes('reprovad') || t.includes('vermelh')) return 'abaixo70';
    if (t.includes('frequência') || t.includes('frequencia') || t.includes('80%')) return 'freq80';
    if (t.includes('observa') || t.includes('anota')) return 'observacoes';
    if (t.includes('ocorrência') || t.includes('ocorrencia')) return 'ocorrencias';
    if (t.includes('reserva') || t.includes('laborat') || t.includes('sala')) return 'reservas';
    if (t.includes('destaque') || t.includes('melhor') || t.includes('top')) return 'destaques';
    return null;
  }

  // --- Renderização de Mensagens no DOM ---
  adicionarMensagem(remetente, conteudoMarkdown, scroll = true) {
    const container = document.getElementById('assistenteChatMessages');
    if (!container) return;

    this.mensagens.push({ role: remetente, text: conteudoMarkdown, time: new Date() });

    const row = document.createElement('div');
    row.className = `assistente-msg-row ${remetente === 'bot' ? 'bot-row' : 'user-row'}`;

    if (remetente === 'bot') {
      const avatar = document.createElement('div');
      avatar.className = 'assistente-msg-avatar bot-avatar';
      avatar.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="10" rx="2"></rect>
          <circle cx="12" cy="5" r="2"></circle>
          <path d="M12 7v4"></path>
          <line x1="8" y1="16" x2="8" y2="16"></line>
          <line x1="16" y1="16" x2="16" y2="16"></line>
        </svg>
      `;

      const bubble = document.createElement('div');
      bubble.className = 'assistente-msg-bubble';
      bubble.innerHTML = this.formatarMarkdown(conteudoMarkdown);

      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'assistente-msg-bubble';
      bubble.innerText = conteudoMarkdown;

      const avatar = document.createElement('div');
      avatar.className = 'assistente-msg-avatar user-avatar';
      const user = window.auth?.getUser();
      const initials = user ? (user.nome.split(' ').map(n => n[0]).join('').substring(0, 2)) : 'PR';
      avatar.innerText = initials;

      row.appendChild(bubble);
      row.appendChild(avatar);
    }

    container.appendChild(row);

    if (scroll) {
      container.scrollTop = container.scrollHeight;
    }
    return this.mensagens.length - 1;
  }

  substituirMensagem(index, novoConteudo) {
    const container = document.getElementById('assistenteChatMessages');
    if (!container) return;
    const rows = container.querySelectorAll('.assistente-msg-row.bot-row');
    const row = rows[rows.length - 1];
    if (!row) return;
    const bubble = row.querySelector('.assistente-msg-bubble');
    if (bubble) {
      bubble.innerHTML = this.formatarMarkdown(novoConteudo);
    }
    if (this.mensagens[index]) {
      this.mensagens[index].text = novoConteudo;
    }
  }

  mostrarIndicadorDigitacao() {
    const container = document.getElementById('assistenteChatMessages');
    if (!container) return;

    const row = document.createElement('div');
    row.id = 'assistenteTypingRow';
    row.className = 'assistente-msg-row bot-row';

    const avatar = document.createElement('div');
    avatar.className = 'assistente-msg-avatar bot-avatar';
    avatar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <circle cx="12" cy="5" r="2"></circle>
        <path d="M12 7v4"></path>
        <line x1="8" y1="16" x2="8" y2="16"></line>
        <line x1="16" y1="16" x2="16" y2="16"></line>
      </svg>
    `;

    const bubble = document.createElement('div');
    bubble.className = 'assistente-msg-bubble';
    bubble.innerHTML = `
      <div class="assistente-typing-indicator">
        <div class="assistente-typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span>Analisando dados com Groq (Llama 3.1)...</span>
      </div>
    `;

    row.appendChild(avatar);
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  removerIndicadorDigitacao() {
    const el = document.getElementById('assistenteTypingRow');
    if (el) el.remove();
  }

  toggleBotoes(ativo) {
    this.atualizarEstadoBloqueio();
  }

  // --- Formatador Simples e Seguro de Markdown para HTML ---
  formatarMarkdown(texto) {
    if (!texto) return '';

    // Sanitização de tags HTML brutas indesejadas
    let html = texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Restaura tags seguras geradas internamente se houver
    html = html.replace(/&lt;br&gt;/g, '<br>');

    // Títulos em Markdown
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^# (.*$)/gim, '<h4>$1</h4>');

    // Negrito
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Itálico
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Código em linha
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Listas com marcadores (-)
    html = html.replace(/^\s*[-•]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Parágrafos e Quebras de linha
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  // --- SUPORTE COMPATÍVEL COM FIGMA DARK CONTAINER ---
  enviarPromptRapido(texto) {
    if (!this.turmaId) {
      window.app.mostrarToast('Selecione uma turma real antes de usar o Assistente IA.', 'warning');
      this.atualizarEstadoBloqueio();
      return;
    }
    this.processarMensagem(texto);
  }

  enviarMensagem() {
    if (!this.turmaId) {
      window.app.mostrarToast('Selecione uma turma real antes de usar o Assistente IA.', 'warning');
      this.atualizarEstadoBloqueio();
      return;
    }
    const inputFigma = document.getElementById('inputChatAssistente');
    if (inputFigma && inputFigma.value.trim()) {
      const texto = inputFigma.value.trim();
      inputFigma.value = '';
      this.processarMensagem(texto);
      return;
    }
    this.enviarMensagemInput();
  }

}

window.assistenteIAController = new AssistenteIAController();
