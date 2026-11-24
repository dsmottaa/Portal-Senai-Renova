/**
 * =============================================================================
 * RENOVA SENAI - AVALIAÇÕES E NOTAS (notas.js)
 * Design System Oficial:
 * - Sub-abas: Avaliações (cadastro, lançamento e validação estrita por teto)
 *             vs Médias (seleção por checkboxes, modo de cálculo, Soma e Média Final)
 * - Bloqueio automático de edição quando o Diário está em AGUARDANDO ou APROVADO
 * =============================================================================
 */

class NotasController {
  constructor() {
    this.turmaId = 1;
    this.ucId = 1;
    this.subturma = 'TODOS';
    this.termoBusca = '';
    this.termoBuscaMedias = '';
    this.abaAtiva = 'avaliacoes';
    this.notasLocais = {}; // { [alunoId]: number | '' }
    this.avaliacaoAtivaId = null;
    this.avaliacoesSelecionadas = null; // Array<number> | null
    this.modoCalculo = 'ponderada'; // 'aritmetica' | 'ponderada' | 'soma'
  }

  init() {
    if (window.app && window.app.turmaAtiva) {
      this.turmaId = Number(window.app.turmaAtiva.id) || 1;
      this.ucId = Number(window.app.turmaAtiva.ucId) || 1;
    }
    this.carregarConfigMedias();
    this.alternarAba(this.abaAtiva);
  }

  isDiarioBloqueado() {
    if (!window.db) return false;
    const turma = (window.db.data.turmas || []).find(t => t.id === Number(this.turmaId));
    if (turma && (turma.status === 'CONCLUIDA' || turma.diarioFechado === true)) {
      return true;
    }
    if (window.db.getStatusDiario) {
      const status = window.db.getStatusDiario(this.turmaId);
      return status === 'AGUARDANDO' || status === 'APROVADO';
    }
    return false;
  }

  getNotaMaximaAvaliacao(avaliacao) {
    if (!avaliacao) return 100;
    const maxVal = Number(avaliacao.notaMaxima ?? avaliacao.valorMaximo);
    return (!isNaN(maxVal) && maxVal > 0) ? maxVal : 100;
  }

  formatarTipoAvaliacao(tipo) {
    const mapa = {
      PRATICA: 'Prática',
      TEORICA: 'Teórica',
      PROVA: 'Prova Escrita',
      PROJETO: 'Projeto',
      TRABALHO: 'Trabalho',
      SEMINARIO: 'Seminário'
    };
    return mapa[tipo] || tipo || '—';
  }

  formatarNumero(valor, casas = 1) {
    if (valor === null || valor === undefined || isNaN(valor)) return '—';
    return Number(valor).toFixed(casas).replace('.', ',');
  }

  carregarAvaliacoes() {
    this.carregarConfigMedias();
    if (this.abaAtiva === 'avaliacoes') {
      this.renderizarAvaliacoes();
    } else {
      this.renderizarMedias();
    }
  }

  carregarConfigMedias() {
    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    const idsExistentes = avaliacoes.map(a => Number(a.id));

    if (window.db && window.db.getConfigMediasUC) {
      const cfg = window.db.getConfigMediasUC(this.turmaId, this.ucId);
      if (cfg) {
        this.modoCalculo = cfg.modoCalculo || 'ponderada';
        this.avaliacoesSelecionadas = (cfg.avaliacoesSelecionadas || [])
          .map(Number)
          .filter(id => idsExistentes.includes(id));
        return;
      }
    }

    this.modoCalculo = 'ponderada';
    this.avaliacoesSelecionadas = [...idsExistentes];
  }

  persistirConfigMedias() {
    if (window.db && window.db.salvarConfigMediasUC) {
      window.db.salvarConfigMediasUC(this.turmaId, this.ucId, {
        modoCalculo: this.modoCalculo,
        avaliacoesSelecionadas: this.avaliacoesSelecionadas || []
      });
    }
  }

  alternarAba(aba) {
    this.abaAtiva = aba;
    const btnAv = document.getElementById('btnNotasTabAvaliacoes');
    const btnMed = document.getElementById('btnNotasTabMedias');
    const viewAv = document.getElementById('notasSubViewAvaliacoes');
    const viewMed = document.getElementById('notasSubViewMedias');

    if (aba === 'avaliacoes') {
      if (btnAv) btnAv.classList.add('active');
      if (btnMed) btnMed.classList.remove('active');
      if (viewAv) viewAv.style.display = 'block';
      if (viewMed) viewMed.style.display = 'none';
      this.renderizarAvaliacoes();
    } else {
      if (btnAv) btnAv.classList.remove('active');
      if (btnMed) btnMed.classList.add('active');
      if (viewAv) viewAv.style.display = 'none';
      if (viewMed) viewMed.style.display = 'block';
      this.carregarConfigMedias();
      this.renderizarMedias();
    }
  }

  onSubturmaChange(sub) {
    this.subturma = sub;
    const selAv = document.getElementById('selectNotasSubturmaFigma');
    const selMed = document.getElementById('selectMediasSubturma');
    if (selAv) selAv.value = sub;
    if (selMed) selMed.value = sub;

    if (this.abaAtiva === 'avaliacoes') {
      this.renderizarAvaliacoes();
    } else {
      this.renderizarMedias();
    }
  }

  onTurmaChange(turmaId, ucId) {
    this.turmaId = Number(turmaId);
    this.ucId = Number(ucId) || 1;
    this.avaliacaoAtivaId = null;
    this.notasLocais = {};
    this.carregarConfigMedias();
    if (this.abaAtiva === 'avaliacoes') {
      this.renderizarAvaliacoes();
    } else {
      this.renderizarMedias();
    }
  }

  onTurmaUcChange(turmaId, ucId) {
    this.onTurmaChange(turmaId, ucId);
  }

  filtrarPorNome(termo) {
    this.termoBusca = (termo || '').toLowerCase().trim();
    this.renderizarAvaliacoes();
  }

  filtrarMedias(termo) {
    this.termoBuscaMedias = (termo || '').toLowerCase().trim();
    this.renderizarMedias();
  }

  renderizarAvaliacoes() {
    const tbody = document.getElementById('notasFigmaTableBody');
    if (!tbody) return;

    const bloqueado = this.isDiarioBloqueado();

    let alunos = window.db ? window.db.getAlunosPorTurma(this.turmaId, this.subturma) : [];
    if (this.termoBusca) {
      alunos = alunos.filter(a => a.nome.toLowerCase().includes(this.termoBusca) || a.ra.includes(this.termoBusca));
    }

    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    this.preencherSelectAvaliacoes(avaliacoes);

    const avaliacaoId = this.avaliacaoAtivaId || (avaliacoes.length > 0 ? avaliacoes[0].id : null);
    const avaliacaoAtiva = avaliacoes.find(a => Number(a.id) === Number(avaliacaoId)) || null;
    const notaMax = this.getNotaMaximaAvaliacao(avaliacaoAtiva);
    const somaPesos = avaliacoes.reduce((acc, a) => acc + (Number(a.peso) || 0), 0);
    this.atualizarPillsAvaliacao(avaliacaoAtiva, avaliacoes.length, somaPesos);

    const thNota = document.getElementById('thNotaAvaliacaoAtiva');
    if (thNota) {
      const maxStr = this.formatarNumero(notaMax, 1);
      thNota.textContent = avaliacaoAtiva ? `NOTA (0 - ${maxStr})` : 'NOTA';
      thNota.title = avaliacaoAtiva ? avaliacaoAtiva.titulo : '';
    }

    if (!avaliacaoAtiva) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 28px; color: #64748b;">
            Nenhuma avaliação cadastrada nesta Unidade Curricular. Clique em <strong>+ Nova Avaliação</strong> para começar.
          </td>
        </tr>
      `;
      this.atualizarFooterAvaliacoes([], notaMax, 0);
      return;
    }

    const notasLancadas = [];

    tbody.innerHTML = alunos.map((aluno, idx) => {
      const numero = idx + 1;
      const avatarSrc = aluno.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=0284c7&color=fff`;

      const notaDb = window.db ? window.db.getNota(avaliacaoId, aluno.id) : null;
      let notaValor = '';
      if (this.notasLocais[aluno.id] !== undefined) {
        notaValor = this.notasLocais[aluno.id] === '' ? '' : String(this.notasLocais[aluno.id]);
      } else if (notaDb !== null && !isNaN(notaDb)) {
        const clamped = Math.max(0, Math.min(notaMax, Number(notaDb)));
        notaValor = Number.isInteger(clamped) ? String(clamped) : clamped.toFixed(1);
      }

      if (notaValor !== '' && !isNaN(Number(notaValor))) {
        notasLancadas.push(Number(notaValor));
      }

      return `
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748b;">${numero}</td>
          <td>
            <div class="aluno-cell-figma">
              <img src="${avatarSrc}" alt="${aluno.nome}" class="aluno-avatar-figma" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=0284c7&color=fff'">
              <span class="aluno-nome-figma">${aluno.nome}</span>
            </div>
          </td>
          <td style="color: #64748b; font-size: 13px;">${aluno.ra}</td>
          <td style="text-align: center;">
            <span class="badge-comp registrado" style="font-size: 11.5px; padding: 3px 8px;">Ativo</span>
          </td>
          <td style="text-align: center;">
            <input type="number" class="notas-input-field" value="${notaValor}" placeholder="0-${notaMax}" min="0" max="${notaMax}" step="0.1"
              ${bloqueado ? 'disabled readonly title="Diário fechado ou aguardando aprovação"' : ''}
              style="width: 82px; text-align: center; font-weight: 700; ${bloqueado ? 'background:#f1f5f9;cursor:not-allowed;' : ''}"
              oninput="window.notasController.validarInputNota(this, ${aluno.id}, ${notaMax})"
              onchange="window.notasController.atualizarNotaAluno(${aluno.id}, this.value, ${notaMax}, this)">
          </td>
          <td style="text-align: center;"></td>
        </tr>
      `;
    }).join('');

    this.atualizarFooterAvaliacoes(notasLancadas, notaMax, alunos.length);
  }

  atualizarFooterAvaliacoes(notasLancadas, notaMax, totalAlunos) {
    const footer = document.getElementById('avaliacoesFooterStats');
    if (!footer) return;

    if (!notasLancadas.length) {
      footer.innerHTML = `
        <span class="resumo-stats-item">Média da Turma: <strong>—</strong></span>
        <span class="resumo-stats-item">Maior Nota: <strong>—</strong></span>
        <span class="resumo-stats-item">Menor Nota: <strong>—</strong></span>
        <span class="resumo-stats-item">Lançadas: <strong>0 / ${totalAlunos}</strong></span>
      `;
      return;
    }

    const soma = notasLancadas.reduce((acc, n) => acc + n, 0);
    const media = soma / notasLancadas.length;
    const maior = Math.max(...notasLancadas);
    const menor = Math.min(...notasLancadas);

    footer.innerHTML = `
      <span class="resumo-stats-item">Média da Turma (0–${this.formatarNumero(notaMax, 0)}): <strong>${this.formatarNumero(media, 1)}</strong></span>
      <span class="resumo-stats-item">Maior Nota: <strong>${this.formatarNumero(maior, 1)}</strong></span>
      <span class="resumo-stats-item">Menor Nota: <strong>${this.formatarNumero(menor, 1)}</strong></span>
      <span class="resumo-stats-item">Lançadas: <strong>${notasLancadas.length} / ${totalAlunos}</strong></span>
    `;
  }

  preencherSelectAvaliacoes(avaliacoes) {
    const select = document.getElementById('selectAvaliacaoAtiva');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Selecione uma avaliação...</option>' +
      avaliacoes.map(a => {
        const maxVal = this.getNotaMaximaAvaliacao(a);
        return `<option value="${a.id}">${a.titulo} (${this.formatarTipoAvaliacao(a.tipo)} • Máx: ${maxVal} • Peso: ${a.peso || 1})</option>`;
      }).join('');
    if (this.avaliacaoAtivaId && avaliacoes.some(a => Number(a.id) === Number(this.avaliacaoAtivaId))) {
      select.value = String(this.avaliacaoAtivaId);
    } else if (currentValue && avaliacoes.some(a => String(a.id) === currentValue)) {
      select.value = currentValue;
      this.avaliacaoAtivaId = Number(currentValue);
    } else if (avaliacoes.length > 0) {
      select.value = String(avaliacoes[0].id);
      this.avaliacaoAtivaId = Number(avaliacoes[0].id);
    } else {
      select.value = '';
      this.avaliacaoAtivaId = null;
    }
  }

  atualizarPillsAvaliacao(avaliacao, totalAvaliacoes = 0, somaPesos = 0) {
    const pillTotal = document.getElementById('pillAvaliacoesTotal');
    const pillSomaPesos = document.getElementById('pillAvaliacoesSomaPesos');
    const pillTipo = document.getElementById('pillAvaliacaoTipo');
    const pillPeso = document.getElementById('pillAvaliacaoPeso');
    const pillData = document.getElementById('pillAvaliacaoData');

    if (pillTotal) pillTotal.innerHTML = `Avaliações na UC: <strong>${totalAvaliacoes}</strong>`;
    if (pillSomaPesos) pillSomaPesos.innerHTML = `Soma dos Pesos: <strong>${somaPesos.toFixed(1)}</strong>`;

    if (avaliacao) {
      if (pillTipo) pillTipo.innerHTML = `Tipo: <strong>${this.formatarTipoAvaliacao(avaliacao.tipo)}</strong>`;
      if (pillPeso) pillPeso.innerHTML = `Peso: <strong>${avaliacao.peso || 1}</strong>`;
      if (pillData) pillData.innerHTML = `Data: <strong>${avaliacao.data ? new Date(avaliacao.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</strong>`;
    } else {
      if (pillTipo) pillTipo.innerHTML = 'Tipo: <strong>—</strong>';
      if (pillPeso) pillPeso.innerHTML = 'Peso: <strong>—</strong>';
      if (pillData) pillData.innerHTML = 'Data: <strong>—</strong>';
    }
  }

  onAvaliacaoChange(value) {
    this.avaliacaoAtivaId = value ? Number(value) : null;
    this.notasLocais = {};
    this.renderizarAvaliacoes();
  }

  validarInputNota(inputEl, alunoId, notaMax) {
    if (!inputEl) return;
    const raw = inputEl.value;
    if (raw === '') {
      this.notasLocais[alunoId] = '';
      return;
    }

    let val = parseFloat(raw);
    if (isNaN(val)) return;

    if (val < 0) {
      val = 0;
      inputEl.value = '0';
      if (window.app && window.app.mostrarToast) {
        window.app.mostrarToast('A nota não pode ser menor que 0.', 'warning');
      }
    } else if (val > notaMax) {
      val = notaMax;
      inputEl.value = String(notaMax);
      if (window.app && window.app.mostrarToast) {
        window.app.mostrarToast(`A nota não pode ultrapassar o máximo (${notaMax}) definido para esta avaliação.`, 'warning');
      }
    }
    this.notasLocais[alunoId] = val;
  }

  atualizarNotaAluno(alunoId, valor, notaMax = 100, inputEl = null) {
    if (valor === '' || valor === null || valor === undefined) {
      this.notasLocais[alunoId] = '';
      return;
    }
    let val = parseFloat(valor);
    if (isNaN(val)) {
      this.notasLocais[alunoId] = '';
      if (inputEl) inputEl.value = '';
      return;
    }
    if (val < 0) val = 0;
    if (val > notaMax) val = notaMax;
    if (inputEl) inputEl.value = String(val);
    this.notasLocais[alunoId] = val;
  }

  // =========================================================================
  // ABA 2: MÉDIAS (SELEÇÃO DE AVALIAÇÕES, SOMA E CÁLCULO AUTOMÁTICO)
  // =========================================================================

  renderizarCheckboxesMedias(avaliacoes) {
    const container = document.getElementById('mediasAvaliacoesCheckboxes');
    if (!container) return;

    if (!avaliacoes.length) {
      container.innerHTML = '<span style="color: #64748b; font-size: 13px;">Nenhuma avaliação cadastrada nesta turma/UC.</span>';
      return;
    }

    const selecionadas = new Set((this.avaliacoesSelecionadas || []).map(Number));

    container.innerHTML = avaliacoes.map(av => {
      const checked = selecionadas.has(Number(av.id));
      const maxVal = this.getNotaMaximaAvaliacao(av);
      return `
        <label class="notas-av-checkbox-pill ${checked ? 'selected' : ''}">
          <input type="checkbox" ${checked ? 'checked' : ''}
            onchange="window.notasController.toggleAvaliacaoMedia(${av.id}, this.checked)">
          <span>${av.titulo}</span>
          <span class="notas-av-checkbox-meta">(${this.formatarTipoAvaliacao(av.tipo)} • Peso ${av.peso || 1} • Máx ${maxVal})</span>
        </label>
      `;
    }).join('');
  }

  toggleAvaliacaoMedia(avaliacaoId, checked) {
    const id = Number(avaliacaoId);
    if (!Array.isArray(this.avaliacoesSelecionadas)) {
      this.avaliacoesSelecionadas = [];
    }
    if (checked) {
      if (!this.avaliacoesSelecionadas.includes(id)) {
        this.avaliacoesSelecionadas.push(id);
      }
    } else {
      this.avaliacoesSelecionadas = this.avaliacoesSelecionadas.filter(item => item !== id);
    }
    this.persistirConfigMedias();
    this.renderizarMedias();
  }

  selecionarTodasAvaliacoes(marcar) {
    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    this.avaliacoesSelecionadas = marcar ? avaliacoes.map(a => Number(a.id)) : [];
    this.persistirConfigMedias();
    this.renderizarMedias();
  }

  onModoCalculoChange(modo) {
    this.modoCalculo = modo || 'ponderada';
    this.persistirConfigMedias();
    this.renderizarMedias();
  }

  calcularResumoAluno(alunoId, avaliacoesSelecionadas) {
    let soma = 0;
    let somaPonderada = 0;
    let somaPesos = 0;
    const notasPorAv = {};

    avaliacoesSelecionadas.forEach(av => {
      const notaDb = window.db ? window.db.getNota(av.id, alunoId) : null;
      const maxVal = this.getNotaMaximaAvaliacao(av);
      const notaNum = (notaDb !== null && !isNaN(notaDb))
        ? Math.max(0, Math.min(maxVal, Number(notaDb)))
        : null;
      notasPorAv[av.id] = notaNum;

      const valorParaCalculo = notaNum !== null ? notaNum : 0;
      const peso = Number(av.peso) || 1;
      soma += valorParaCalculo;
      somaPonderada += valorParaCalculo * peso;
      somaPesos += peso;
    });

    let mediaFinal = 0;
    if (avaliacoesSelecionadas.length > 0) {
      if (this.modoCalculo === 'aritmetica') {
        mediaFinal = soma / avaliacoesSelecionadas.length;
      } else if (this.modoCalculo === 'soma') {
        mediaFinal = soma;
      } else {
        mediaFinal = somaPesos > 0 ? (somaPonderada / somaPesos) : 0;
      }
    }

    return {
      notasPorAv,
      soma: Number(soma.toFixed(1)),
      mediaFinal: Number(mediaFinal.toFixed(1))
    };
  }

  renderizarMedias() {
    const thead = document.getElementById('mediasFigmaTableHead');
    const tbody = document.getElementById('mediasFigmaTableBody');
    if (!tbody) return;

    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    if (this.avaliacoesSelecionadas === null) {
      this.carregarConfigMedias();
    }

    const selectModo = document.getElementById('selectModoCalculoMedias');
    if (selectModo) selectModo.value = this.modoCalculo;

    this.renderizarCheckboxesMedias(avaliacoes);

    const selecionadasSet = new Set((this.avaliacoesSelecionadas || []).map(Number));
    const avaliacoesSelecionadas = avaliacoes.filter(a => selecionadasSet.has(Number(a.id)));

    if (thead) {
      const colsAv = avaliacoesSelecionadas.map(av => {
        const maxVal = this.getNotaMaximaAvaliacao(av);
        return `<th style="text-align: center; min-width: 110px;" title="${av.titulo} (Peso: ${av.peso || 1} | Máx: ${maxVal})">${av.titulo}<div style="font-size:10px; font-weight:500; opacity:0.85;">Peso ${av.peso || 1} • 0-${maxVal}</div></th>`;
      }).join('');

      thead.innerHTML = `
        <tr>
          <th style="width: 45px; text-align: center;">Nº</th>
          <th>FOTO / NOME DO ALUNO</th>
          <th>MATRÍCULA</th>
          ${colsAv}
          <th style="text-align: center; min-width: 90px;">SOMA</th>
          <th style="text-align: center; min-width: 115px;">MÉDIA FINAL</th>
        </tr>
      `;
    }

    let alunos = window.db ? window.db.getAlunosPorTurma(this.turmaId, this.subturma) : [];
    if (this.termoBuscaMedias) {
      alunos = alunos.filter(a => a.nome.toLowerCase().includes(this.termoBuscaMedias) || a.ra.includes(this.termoBuscaMedias));
    }

    const chave = `${this.turmaId}_${this.ucId}`;
    if (window.db && !window.db.data.mediasProfessor) {
      window.db.data.mediasProfessor = {};
    }
    if (window.db && !window.db.data.mediasProfessor[chave]) {
      window.db.data.mediasProfessor[chave] = {};
    }

    let somaMediasTurma = 0;

    tbody.innerHTML = alunos.map((aluno, idx) => {
      const numero = idx + 1;
      const avatarSrc = aluno.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=0284c7&color=fff`;

      const { notasPorAv, soma, mediaFinal } = this.calcularResumoAluno(aluno.id, avaliacoesSelecionadas);
      somaMediasTurma += mediaFinal;

      if (window.db && window.db.data.mediasProfessor[chave]) {
        window.db.data.mediasProfessor[chave][aluno.id] = mediaFinal;
      }

      const cellsAv = avaliacoesSelecionadas.map(av => {
        const val = notasPorAv[av.id];
        return `<td style="text-align: center; font-weight: 600; color: #334155;">${val !== null ? this.formatarNumero(val, 1) : '—'}</td>`;
      }).join('');

      return `
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748b;">${numero}</td>
          <td>
            <div class="aluno-cell-figma">
              <img src="${avatarSrc}" alt="${aluno.nome}" class="aluno-avatar-figma" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=0284c7&color=fff'">
              <span class="aluno-nome-figma">${aluno.nome}</span>
            </div>
          </td>
          <td style="color: #64748b; font-size: 13px;">${aluno.ra}</td>
          ${cellsAv}
          <td style="text-align: center; font-weight: 700; color: #475569; font-size: 13.5px;">${this.formatarNumero(soma, 1)}</td>
          <td style="text-align: center; font-weight: 800; color: #0284c7; font-size: 14.5px;">${this.formatarNumero(mediaFinal, 1)}</td>
        </tr>
      `;
    }).join('');

    if (window.db) {
      window.db.persist();
    }

    const mediaTurma = alunos.length > 0 ? (somaMediasTurma / alunos.length) : 0;
    const modoLabels = {
      aritmetica: 'Média Aritmética',
      ponderada: 'Média Ponderada',
      soma: 'Soma Simples'
    };

    const footerStats = document.getElementById('mediasFooterStats');
    if (footerStats) {
      footerStats.innerHTML = `
        <span class="resumo-stats-item">Média Final da Turma: <strong>${this.formatarNumero(mediaTurma, 1)}</strong></span>
        <span class="resumo-stats-item">Avaliações Selecionadas: <strong>${avaliacoesSelecionadas.length} / ${avaliacoes.length}</strong></span>
        <span class="resumo-stats-item">Modo: <strong>${modoLabels[this.modoCalculo] || 'Média Ponderada'}</strong></span>
      `;
    }
  }

  recalcularMedias() {
    this.persistirConfigMedias();
    this.renderizarMedias();
    if (window.app && window.app.mostrarToast) {
      window.app.mostrarToast('Médias recalculadas com base nas avaliações selecionadas!', 'success');
    }
  }

  salvarMedias() {
    if (this.isDiarioBloqueado()) {
      window.app.mostrarToast('O diário está fechado ou aguardando aprovação. Edição bloqueada.', 'warning');
      return;
    }
    if (window.auth && window.auth.isCoordenacao && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada para coordenação.', 'warning');
      return;
    }
    this.persistirConfigMedias();
    this.renderizarMedias();
    if (window.db) {
      window.db.persist();
    }
    window.app.mostrarToast('Configuração e médias finais salvas com sucesso!', 'success');
  }

  salvarNotasFigma() {
    if (this.isDiarioBloqueado()) {
      window.app.mostrarToast('O diário está fechado ou aguardando aprovação. Edição bloqueada.', 'warning');
      return;
    }
    if (window.auth && window.auth.isCoordenacao && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada para coordenação.', 'warning');
      return;
    }
    if (!this.avaliacaoAtivaId) {
      window.app.mostrarToast('Selecione uma avaliação antes de salvar.', 'warning');
      return;
    }

    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(this.turmaId, this.ucId) : [];
    const avaliacaoAtiva = avaliacoes.find(a => Number(a.id) === Number(this.avaliacaoAtivaId));
    const notaMax = this.getNotaMaximaAvaliacao(avaliacaoAtiva);

    for (const alunoId of Object.keys(this.notasLocais)) {
      const raw = this.notasLocais[alunoId];
      if (raw === '' || raw === null || raw === undefined) continue;
      const val = Number(raw);
      if (isNaN(val) || val < 0 || val > notaMax) {
        window.app.mostrarToast(`Nota inválida detectada. Respeite o intervalo de 0 a ${notaMax}.`, 'warning');
        return;
      }
    }

    if (window.db) {
      Object.keys(this.notasLocais).forEach(alunoId => {
        const raw = this.notasLocais[alunoId];
        window.db.salvarNota(this.avaliacaoAtivaId, alunoId, raw === '' ? NaN : Number(raw));
      });
      window.db.persist();
    }
    this.notasLocais = {};
    this.renderizarAvaliacoes();
    window.app.mostrarToast('Notas da avaliação consolidadas e salvas com sucesso!', 'success');
  }

  abrirModalNovaAvaliacao() {
    if (this.isDiarioBloqueado()) {
      window.app.mostrarToast('O diário está fechado ou aguardando aprovação. Não é possível cadastrar novas avaliações.', 'warning');
      return;
    }
    const inputTitulo = document.getElementById('inputNovaAvaliacaoTitulo');
    const selectTipo = document.getElementById('selectNovaAvaliacaoTipo');
    const inputPeso = document.getElementById('inputNovaAvaliacaoPeso');
    const inputData = document.getElementById('inputNovaAvaliacaoData');
    const inputMax = document.getElementById('inputNovaAvaliacaoValorMaximo');

    if (inputTitulo) inputTitulo.value = '';
    if (selectTipo) selectTipo.selectedIndex = 0;
    if (inputPeso) inputPeso.value = '1.0';
    if (inputData) inputData.value = new Date().toISOString().split('T')[0];
    if (inputMax) inputMax.value = '100';

    if (window.app && typeof window.app.abrirModal === 'function') {
      window.app.abrirModal('modalNovaAvaliacao');
    }
  }

  salvarNovaAvaliacao() {
    if (this.isDiarioBloqueado()) {
      window.app.mostrarToast('O diário está fechado ou aguardando aprovação. Não é possível cadastrar novas avaliações.', 'warning');
      return;
    }
    const titulo = document.getElementById('inputNovaAvaliacaoTitulo') ? document.getElementById('inputNovaAvaliacaoTitulo').value.trim() : '';
    const tipo = document.getElementById('selectNovaAvaliacaoTipo') ? document.getElementById('selectNovaAvaliacaoTipo').value : 'PRATICA';
    const pesoRaw = document.getElementById('inputNovaAvaliacaoPeso') ? document.getElementById('inputNovaAvaliacaoPeso').value.trim() : '';
    const peso = parseFloat(pesoRaw);
    const data = document.getElementById('inputNovaAvaliacaoData') ? document.getElementById('inputNovaAvaliacaoData').value : '';
    const valorMaxRaw = document.getElementById('inputNovaAvaliacaoValorMaximo') ? document.getElementById('inputNovaAvaliacaoValorMaximo').value.trim() : '';
    const valorMax = parseFloat(valorMaxRaw);

    if (!titulo) {
      window.app.mostrarToast('Informe o nome da avaliação.', 'warning');
      return;
    }

    if (!pesoRaw || isNaN(peso) || peso <= 0) {
      window.app.mostrarToast('O peso da avaliação é obrigatório e deve ser maior que zero (peso > 0).', 'warning');
      return;
    }

    if (!valorMaxRaw || isNaN(valorMax) || valorMax <= 0) {
      window.app.mostrarToast('A nota máxima deve ser maior que zero.', 'warning');
      return;
    }

    if (!data) {
      window.app.mostrarToast('Informe a data da avaliação.', 'warning');
      return;
    }

    const tId = Number(this.turmaId || (window.app && window.app.turmaAtiva ? window.app.turmaAtiva.id : 1));
    const uId = Number(this.ucId || (window.app && window.app.turmaAtiva ? window.app.turmaAtiva.ucId : 1));

    if (window.db && window.db.addAvaliacao) {
      const novaAvaliacao = window.db.addAvaliacao({
        turmaId: tId,
        ucId: uId,
        titulo: titulo,
        tipo: tipo,
        peso: peso,
        data: data,
        notaMaxima: valorMax,
        valorMaximo: valorMax
      });
      if (novaAvaliacao && novaAvaliacao.id) {
        this.avaliacaoAtivaId = Number(novaAvaliacao.id);
        this.notasLocais = {};
        if (Array.isArray(this.avaliacoesSelecionadas) && !this.avaliacoesSelecionadas.includes(Number(novaAvaliacao.id))) {
          this.avaliacoesSelecionadas.push(Number(novaAvaliacao.id));
        }
      }
      window.app.fecharModal('modalNovaAvaliacao');
      window.app.mostrarToast(`Avaliação "${titulo}" (Máx: ${valorMax} • Peso: ${peso}) cadastrada com sucesso!`, 'success');
      this.renderizarAvaliacoes();
      if (window.app && window.app.renderizarHomeProfessor) window.app.renderizarHomeProfessor();
    }
  }

  excluirAvaliacao(avaliacaoId) {
    if (this.isDiarioBloqueado()) {
      window.app.mostrarToast('O diário está fechado ou aguardando aprovação. Não é possível excluir avaliações.', 'warning');
      return;
    }
    if (!confirm('Deseja realmente excluir esta avaliação e suas notas associadas?')) return;

    const id = Number(avaliacaoId);
    if (window.db && window.db.data.avaliacoes) {
      window.db.data.avaliacoes = window.db.data.avaliacoes.filter(a => Number(a.id) !== id);
      if (window.db.data.notas) {
        window.db.data.notas = window.db.data.notas.filter(n => Number(n.avaliacaoId) !== id);
      }
      if (Array.isArray(this.avaliacoesSelecionadas)) {
        this.avaliacoesSelecionadas = this.avaliacoesSelecionadas.filter(item => item !== id);
        this.persistirConfigMedias();
      }
      window.db.persist();
      window.app.mostrarToast('Avaliação excluída com sucesso.', 'info');
      this.renderizarAvaliacoes();
      if (window.app && window.app.renderizarHomeProfessor) window.app.renderizarHomeProfessor();
    }
  }
}

window.notasController = new NotasController();
