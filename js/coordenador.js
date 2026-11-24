/**
 * =============================================================================
 * RENOVA SENAI — PORTAL DO COORDENADOR (coordenador.js)
 * Gestão de Turmas · Atribuição de Docentes · Fechamento de Diário
 * =============================================================================
 */

class CoordenadorController {
  constructor() {
    this._bound = false;
  }

  init() {
    this.renderDashboard();
    this.renderVisaoCurricular();
    this.renderListaTurmas(); this.renderVisaoCurricular();
    this.renderPainelFechamento();
    if (!this._bound) {
      this._bound = true;
      this._bindEvents();
    }
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  _getTurmas() {
    return window.db.data.turmas || [];
  }

  _getDocentes() {
    return (window.db.data.usuarios || []).filter(u =>
      u.perfil === 'PROFESSOR' || u.perfil === 'COORDENACAO'
    );
  }

  _getAtribuicoes() {
    if (!window.db.data.atribuicoes) window.db.data.atribuicoes = [];
    return window.db.data.atribuicoes;
  }

  _getSolicitacoes() {
    if (!window.db.data.solicitacoesFechamento) window.db.data.solicitacoesFechamento = [];
    return window.db.data.solicitacoesFechamento;
  }

  _persist() {
    window.db.persist();
  }

  // ─── DASHBOARD KPIs ─────────────────────────────────────────────────────────

  renderDashboard() {
    const el = document.getElementById('coordDashboardCards');
    if (!el) return;

    const turmas = this._getTurmas();
    const ativas = turmas.filter(t => t.status === 'EM_ANDAMENTO');
    const concluidas = turmas.filter(t => t.status === 'CONCLUIDA');
    const solicitacoes = this._getSolicitacoes().filter(s => s.status === 'AGUARDANDO');
    const totalAlunos = ativas.reduce((s, t) => s + (t.totalAlunos || 0), 0);

    el.innerHTML = `
      <div class="coord-kpi-card">
        <div class="kpi-icon kpi-icon-turmas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-value">${ativas.length}</span>
          <span class="kpi-label">Turmas Ativas</span>
        </div>
      </div>
      <div class="coord-kpi-card">
        <div class="kpi-icon kpi-icon-alunos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-value">${totalAlunos}</span>
          <span class="kpi-label">Alunos Matriculados</span>
        </div>
      </div>
      <div class="coord-kpi-card">
        <div class="kpi-icon kpi-icon-concluidas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-value">${concluidas.length}</span>
          <span class="kpi-label">Turmas Concluídas</span>
        </div>
      </div>
      <div class="coord-kpi-card ${solicitacoes.length > 0 ? 'kpi-alert' : ''}">
        <div class="kpi-icon kpi-icon-fechamento">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-value">${solicitacoes.length}</span>
          <span class="kpi-label">Diários Aguardando</span>
        </div>
      </div>
    `;

    // Alertas de Encaminhamentos da Orientação Educacional
    const encaminhados = (window.db && window.db.data && window.db.data.atendimentosOrientacao || [])
      .filter(a => a.encaminhamento === 'COORDENACAO');

    let elAlertas = document.getElementById('coordAlertasOrientacaoContainer');
    if (!elAlertas) {
      elAlertas = document.createElement('div');
      elAlertas.id = 'coordAlertasOrientacaoContainer';
      if (el.parentNode) {
        el.parentNode.insertBefore(elAlertas, el.nextSibling);
      }
    }

    if (elAlertas) {
      if (encaminhados.length > 0) {
        elAlertas.innerHTML = `
          <div style="background:#fffbeb; border:1px solid #fde68a; border-left:4px solid #f59e0b; border-radius:10px; padding:16px; margin:18px 0; box-shadow:0 1px 3px rgba(0,0,0,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <strong style="color:#92400e; font-size:13.5px;">Encaminhamentos da Orientação Educacional (${encaminhados.length})</strong>
              </div>
              <span style="font-size:11.5px; background:#fef3c7; color:#92400e; padding:3px 10px; border-radius:9999px; font-weight:700;">Ação Intersetorial Requerida</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
              ${encaminhados.map(enc => {
                const aluno = window.db.getAlunoById(enc.alunoId);
                const nome = aluno ? aluno.nome : `Aluno #${enc.alunoId}`;
                return `
                  <div style="background:#ffffff; border:1px solid #fef08a; border-radius:8px; padding:12px; font-size:12.5px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <strong style="color:#0f172a;">${nome}</strong>
                      <span style="font-size:11px; color:#64748b;">${enc.data}</span>
                    </div>
                    <div style="color:#64748b; font-size:11.5px; margin-bottom:6px;">Foco: <strong>${enc.foco}</strong> • Tipo: ${enc.tipo}</div>
                    <div style="color:#334155; margin-bottom:8px; line-height:1.4;"><em>"${enc.resumo}"</em></div>
                    ${enc.combinados ? `<div style="font-size:11px; color:#b45309; background:#fffdf5; padding:4px 8px; border-radius:4px; border:1px dashed #fde68a;"><strong>Combinados:</strong> ${enc.combinados}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
        elAlertas.style.display = 'block';
      } else {
        elAlertas.style.display = 'none';
        elAlertas.innerHTML = '';
      }
    }
  }

  // ─── LISTAGEM DE TURMAS ──────────────────────────────────────────────────────

  renderListaTurmas(filtro) {
    filtro = filtro || 'EM_ANDAMENTO';
    this._filtroAtualTurmas = filtro;
    const el = document.getElementById('coordTurmasLista');
    if (!el) return;

    const turmas = this._getTurmas().filter(function(t) {
      return filtro === 'TODOS' ? true : t.status === filtro;
    });
    const atribuicoes = this._getAtribuicoes();
    const self = this;

    if (!this.turmaSelecionadaId && turmas.length > 0) {
      this.turmaSelecionadaId = turmas[0].id;
    }
    this.renderTurmaSelecionadaDetalhe();

    if (turmas.length === 0) {
      el.innerHTML = '<div class="coord-empty-state"><p>Nenhuma turma encontrada.</p></div>';
      return;
    }

    const rows = turmas.map(function(t) {
      const at = atribuicoes.find(function(a) { return a.turmaId === t.id; });
      const docente = at ? (window.db.data.usuarios || []).find(function(u) { return u.id === at.docenteId; }) : null;
      const sol = self._getSolicitacoes().find(function(s) { return s.turmaId === t.id; });
      const isSelected = Number(self.turmaSelecionadaId) === Number(t.id);
      const statusDiario = sol
        ? (sol.status === 'APROVADO'
          ? '<span class="coord-badge badge-aprovado"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline-block; vertical-align:middle; margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Fechado</span>'
          : '<span class="coord-badge badge-aguardando"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:3px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Aguardando</span>')
        : '<span class="coord-badge badge-aberto">Aberto</span>';
      const statusTurma = t.status === 'EM_ANDAMENTO'
        ? '<span class="coord-badge badge-ativo">Em Andamento</span>'
        : '<span class="coord-badge badge-concluido">Concluída</span>';

      const nomeDocente = docente
        ? '<span style="font-size:12px; font-weight:600;">' + docente.nome.split(' ').slice(0,2).join(' ') + '</span>'
        : '<button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.coordenadorController.abrirModalAtribuirDocente(' + t.id + ')">+ Atribuir</button>';

      // Cálculo de progresso do diário de classe
      const aulasTurma = (window.db.data.aulas || []).filter(function(a) { return a.turmaId === t.id && a.status === 'FINALIZADA'; });
      const totalAulasDadas = aulasTurma.reduce(function(s, a) { return s + (a.quantidadeAulas || 1); }, 0);
      const metaAulas = 80;
      const pct = sol && sol.status === 'APROVADO' ? 100 : Math.min(100, Math.round((totalAulasDadas / metaAulas) * 100));

      const progressoDiarioHtml = '<div style="min-width:120px;">'
        + '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:11px;">'
        + statusDiario
        + '<span style="font-weight:700; color:var(--text-muted);">' + pct + '%</span>'
        + '</div>'
        + '<div style="height:6px; background:rgba(0,0,0,0.08); border-radius:3px; overflow:hidden;">'
        + '<div style="width:' + pct + '%; height:100%; background:var(--primary, #c3161c); border-radius:3px; transition:width 0.3s;"></div>'
        + '</div>'
        + '<div style="font-size:10px; color:var(--text-muted); margin-top:3px;">' + totalAulasDadas + ' de ' + metaAulas + ' aulas lançadas</div>'
        + '</div>';

      const rowClass = isSelected ? 'style="background:#f0f7ff; cursor:pointer;"' : 'style="cursor:pointer;"';

      return '<tr ' + rowClass + ' onclick="window.coordenadorController.selecionarTurmaVisualizacao(' + t.id + ')">'
        + '<td><div style="font-weight:700;font-size:13px;color:#005594;">' + t.codigo + (isSelected ? ' <span style="font-size:10px; background:#005594; color:#fff; padding:1px 6px; border-radius:4px;">Ativa</span>' : '') + '</div>'
        + '<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">' + (t.cursoNome || t.nome) + '</div></td>'
        + '<td><span class="coord-badge badge-periodo">' + t.periodo + ' &bull; ' + (t.turno || 'Diurno') + '</span></td>'
        + '<td><strong>' + t.totalAlunos + '</strong></td>'
        + '<td>' + nomeDocente + '</td>'
        + '<td>' + progressoDiarioHtml + '</td>'
        + '<td>' + statusTurma + '</td>'
        + '<td style="text-align:right">'
        + '<div style="display:inline-flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">'
        + '<button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.app.abrirDiarioComTurma(' + t.id + ')" title="Inspecionar Diário de Classe da Turma ' + t.codigo + '">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>Diário'
        + '</button>'
        + '<button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); window.app.abrirSinteseComTurma(' + t.id + ', ' + (t.ucId || 1) + ')" style="background:#005594; border-color:#005594;" title="Inspecionar Síntese da Turma ' + t.codigo + '">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>Síntese'
        + '</button>'
        + '<button type="button" class="btn btn-sm btn-outline" onclick="event.stopPropagation(); window.coordenadorController.abrirModalAtribuirDocente(' + t.id + ')" title="Gerenciar docente">Docente</button>'
        + '</div>'
        + '</td></tr>';
    }).join('');

    el.innerHTML = '<div class="coord-table-wrapper">'
      + '<table class="coord-table academic-table"><thead><tr>'
      + '<th>Turma / Curso</th><th>Período & Turno</th><th>Alunos</th><th>Docente</th><th>Progresso do Diário</th><th>Status</th><th style="text-align:right">Ações Integradas</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  selecionarTurmaVisualizacao(turmaId) {
    this.turmaSelecionadaId = turmaId ? Number(turmaId) : null;
    this.renderTurmaSelecionadaDetalhe();
    this.renderListaTurmas(this._filtroAtualTurmas || 'EM_ANDAMENTO');
  }

  renderTurmaSelecionadaDetalhe() {
    const container = document.getElementById('coordTurmaDetalheContainer');
    if (!container) return;

    if (!this.turmaSelecionadaId) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const turma = (window.db.data.turmas || []).find(t => t.id === this.turmaSelecionadaId);
    if (!turma) {
      container.style.display = 'none';
      return;
    }

    const ucs = window.db ? window.db.getUCsPorTurma(turma.id) : [];
    const ucPrincipal = ucs[0] || { id: 1, nome: turma.nome };
    const sintese = window.db ? window.db.getSinteseConsolidada(turma.id, ucPrincipal.id) : null;
    const alunos = (sintese && sintese.alunos) ? sintese.alunos : [];
    const freqs = alunos.filter(a => a.aluno.statusMatricula === 'ATIVO').map(a => a.freqPorcentagem);
    const freqMedia = freqs.length ? (freqs.reduce((s, v) => s + v, 0) / freqs.length).toFixed(1) : '—';
    const medias = alunos.filter(a => a.media > 0).map(a => a.media);
    const mediaGeral = medias.length ? (medias.reduce((s, v) => s + v, 0) / medias.length).toFixed(1) : '—';

    const statusBadge = turma.status === 'EM_ANDAMENTO'
      ? '<span class="coord-badge badge-ativo" style="font-size:12px; padding:4px 10px;">Em Andamento</span>'
      : '<span class="coord-badge badge-concluido" style="font-size:12px; padding:4px 10px;">Concluída</span>';

    container.style.display = 'block';
    container.innerHTML = `
      <div class="coord-turma-selected-banner" style="background:#ffffff; border:1px solid #cbd5e1; border-left:5px solid #005594; border-radius:10px; padding:18px 20px; margin-bottom:18px; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <span style="font-size:12px; font-weight:700; color:#005594; background:#f0f7ff; padding:2px 8px; border-radius:4px; border:1px solid #bae6fd;">TURMA EM FOCO</span>
              ${statusBadge}
            </div>
            <h3 style="margin:0 0 4px 0; font-size:18px; font-weight:800; color:#0f172a;">${turma.codigo} • ${turma.nome}</h3>
            <div style="font-size:13px; color:#475569; display:flex; gap:16px; flex-wrap:wrap; margin-top:6px;">
              <span><strong>Curso:</strong> ${turma.cursoNome || turma.nome}</span>
              <span><strong>Período:</strong> ${turma.periodo || '2026/1'}</span>
              <span><strong>Turno:</strong> ${turma.turno || 'Diurno'}</span>
              <span><strong>Alunos:</strong> ${turma.totalAlunos} matriculados</span>
              <span><strong>Freq. Média:</strong> ${freqMedia}%</span>
              <span><strong>Média Geral:</strong> ${mediaGeral}</span>
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <button type="button" class="btn btn-outline" onclick="window.app.abrirDiarioComTurma(${turma.id})" style="border-color:#005594; color:#005594; font-weight:700; padding:8px 14px; font-size:13px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Acessar Diário
            </button>
            <button type="button" class="btn btn-primary" onclick="window.app.abrirSinteseComTurma(${turma.id}, ${ucPrincipal.id})" style="background:#005594; border-color:#005594; font-weight:700; padding:8px 14px; font-size:13px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
              Acessar Síntese
            </button>
            <button type="button" class="btn btn-outline" onclick="window.coordenadorController.abrirModalAtribuirDocente(${turma.id})" style="padding:8px 12px; font-size:13px;" title="Atribuir ou alterar docente">
              Docente
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.coordenadorController.selecionarTurmaVisualizacao(null)" style="padding:8px 10px;" title="Fechar seleção">
              &times;
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── PAINEL DE FECHAMENTO ────────────────────────────────────────────────────

  renderPainelFechamento() {
    const el = document.getElementById('coordFechamentoLista');
    if (!el) return;

    const self = this;
    const turmas = window.db.data.turmas || [];
    const solicitacoes = this._getSolicitacoes();

    if (turmas.length === 0) {
      el.innerHTML = '<div class="coord-empty-state" style="padding:32px 0;"><p>Nenhuma turma cadastrada no sistema.</p></div>';
      return;
    }

    let cardsHtml = '';

    turmas.forEach(function(turma) {
      const sol = solicitacoes.find(function(s) { return s.turmaId === turma.id; });
      const docente = (window.db.data.usuarios || []).find(function(u) { return u.id === (sol ? sol.docenteId : turma.docenteId); });
      const sintese = window.db.getSinteseConsolidada ? window.db.getSinteseConsolidada(turma.id, null) : null;
      const alunos = (sintese && sintese.alunos) ? sintese.alunos : [];
      const totalAtivos = alunos.filter(function(a) { return a.aluno && a.aluno.statusMatricula === 'ATIVO'; }).length || turma.totalAlunos || 0;
      const medias = alunos.filter(function(a) { return a.media > 0; }).map(function(a) { return a.media; });
      const mediaGeral = medias.length ? (medias.reduce(function(s,v) { return s+v; }, 0) / medias.length).toFixed(1) : '—';
      const freqs = alunos.filter(function(a) { return a.aluno && a.aluno.statusMatricula === 'ATIVO'; }).map(function(a) { return a.freqPorcentagem; });
      const freqMedia = freqs.length ? (freqs.reduce(function(s,v) { return s+v; }, 0) / freqs.length).toFixed(1) : '—';
      const emRisco = alunos.filter(function(a) { return a.aluno && a.aluno.statusMatricula === 'ATIVO' && (a.media < 70 || a.freqPorcentagem < 75); }).length;

      const isFechado = turma.status === 'CONCLUIDA' || turma.diarioFechado === true || (sol && sol.status === 'APROVADO');
      const isAguardando = sol && sol.status === 'AGUARDANDO';

      let statusBadge = '';
      let actionButtons = '';

      if (isFechado) {
        statusBadge = '<span class="coord-badge badge-aprovado" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;">Diário Fechado e Homologado</span>';
        actionButtons = `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.coordenadorController.reabrirDiario(${turma.id})" style="border-color:#0284c7; color:#0284c7; font-weight:600;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
            </svg>
            Reabrir Diário
          </button>
        `;
      } else if (isAguardando) {
        statusBadge = '<span class="coord-badge badge-aguardando" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;">Aguardando Homologação (100% Docente)</span>';
        actionButtons = `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.coordenadorController.recusarFechamento(${sol.id})">Devolver para Ajustes</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.coordenadorController.aprovarFechamento(${sol.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:2px;"><polyline points="20 6 9 17 4 12"/></svg>
            Autorizar Fechamento
          </button>
        `;
      } else {
        statusBadge = '<span class="coord-badge badge-aberto" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;">Diário Aberto • Em Lançamento</span>';
        actionButtons = `
          <button type="button" class="btn btn-outline btn-sm" onclick="window.app.abrirDiarioComTurma(${turma.id})">Inspecionar Aulas</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.coordenadorController.fecharDiarioDireto(${turma.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Fechar Diário
          </button>
        `;
      }

      // Checklist de professores
      const profsResponsaveis = (turma && turma.professoresResponsaveis) ? turma.professoresResponsaveis : [];
      const checklistHtml = profsResponsaveis.length ? `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; margin:10px 0; font-size:12px;">
          <strong style="color:#0f172a; display:block; margin-bottom:4px;">Docentes Vinculados:</strong>
          <div style="display:flex; flex-direction:column; gap:4px;">
            ${profsResponsaveis.map(p => `
              <div style="display:flex; align-items:center; justify-content:space-between;">
                <span>${p.nome} <em style="color:#64748b;">(${p.papel || 'Docente'})</em></span>
                <span class="badge ${p.fechado ? 'bg-success text-white' : 'bg-secondary text-white'}" style="font-size:10px; padding:2px 6px; border-radius:4px;">
                  ${p.fechado ? 'Etapa Concluída' : 'Em Andamento'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '';

      cardsHtml += `
        <div class="coord-fechamento-card" style="margin-bottom:14px; border:1px solid ${isFechado ? '#bbf7d0' : '#e2e8f0'}; background:${isFechado ? '#fcfdfd' : '#ffffff'};">
          <div class="fechamento-card-header">
            <div>
              <div class="fechamento-turma-code">${turma.codigo}</div>
              <div class="fechamento-turma-nome">${turma.nome}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                Semestre: <strong>${turma.periodo || '2026/1'}</strong> &bull; Turno: <strong>${turma.turno || 'Diurno'}</strong>
              </div>
            </div>
            ${statusBadge}
          </div>
          ${checklistHtml}
          <div class="fechamento-metricas">
            <div class="fechamento-metrica"><span class="metrica-val">${totalAtivos}</span><span class="metrica-label">Alunos Ativos</span></div>
            <div class="fechamento-metrica"><span class="metrica-val">${mediaGeral}</span><span class="metrica-label">Média Geral</span></div>
            <div class="fechamento-metrica"><span class="metrica-val">${freqMedia}%</span><span class="metrica-label">Freq. Média</span></div>
            <div class="fechamento-metrica ${emRisco > 0 ? 'metrica-alerta' : ''}"><span class="metrica-val">${emRisco}</span><span class="metrica-label">Em Risco</span></div>
          </div>
          ${(sol && sol.observacao) ? `<div class="fechamento-obs"><em>"${sol.observacao}"</em></div>` : ''}
          <div class="fechamento-actions">
            ${actionButtons}
          </div>
        </div>
      `;
    });

    el.innerHTML = cardsHtml;
  }

  // Fechamento direto efetuado pela Coordenação
  fecharDiarioDireto(turmaId) {
    const turmas = window.db.data.turmas || [];
    const turma = turmas.find(t => t.id === Number(turmaId));
    if (!turma) return;

    turma.status = 'CONCLUIDA';
    turma.diarioFechado = true;

    // Atualiza ou insere solicitação como APROVADO
    const solicitacoes = this._getSolicitacoes();
    let sol = solicitacoes.find(s => s.turmaId === Number(turmaId));
    if (sol) {
      sol.status = 'APROVADO';
      sol.dataAprovacao = new Date().toLocaleDateString('pt-BR');
    } else {
      sol = {
        id: Date.now(),
        turmaId: Number(turmaId),
        docenteId: turma.docenteId || 1,
        status: 'APROVADO',
        data: new Date().toLocaleDateString('pt-BR'),
        dataAprovacao: new Date().toLocaleDateString('pt-BR'),
        observacao: 'Fechamento oficial realizado pela Coordenação Pedagógica.'
      };
      solicitacoes.push(sol);
    }
    window.db.data.solicitacoesFechamento = solicitacoes;

    // Marca etapas docentes como concluídas
    if (turma.professoresResponsaveis && Array.isArray(turma.professoresResponsaveis)) {
      turma.professoresResponsaveis.forEach(p => { p.fechado = true; });
    }

    this._persist();

    if (window.db && typeof window.db.adicionarNotificacao === 'function') {
      window.db.adicionarNotificacao(
        'APROVACAO',
        `Diário Fechado • ${turma.codigo}`,
        `A coordenação oficializou o fechamento do diário de classe da turma ${turma.codigo}. As edições docentes foram bloqueadas.`,
        'Coordenação Pedagógica'
      );
    }

    window.app.mostrarToast(`Diário da turma ${turma.codigo} fechado e homologado com sucesso! Edições bloqueadas.`, 'success');
    this.renderDashboard();
    this.renderListaTurmas();
    this.renderVisaoCurricular();
    this.renderPainelFechamento();
  }

  // Reabertura do diário para ajustes docentes
  reabrirDiario(turmaId) {
    const turmas = window.db.data.turmas || [];
    const turma = turmas.find(t => t.id === Number(turmaId));
    if (!turma) return;

    turma.status = 'EM_ANDAMENTO';
    turma.diarioFechado = false;

    // Reabre solicitação
    const solicitacoes = this._getSolicitacoes();
    const sol = solicitacoes.find(s => s.turmaId === Number(turmaId));
    if (sol) {
      sol.status = 'DEVOLVIDO';
      sol.motivoDevolucao = 'Diário reaberto pela coordenação para novos lançamentos e correções docentes.';
      sol.dataDevolucao = new Date().toLocaleDateString('pt-BR');
    }
    window.db.data.solicitacoesFechamento = solicitacoes;

    // Reabre etapas docentes
    if (turma.professoresResponsaveis && Array.isArray(turma.professoresResponsaveis)) {
      turma.professoresResponsaveis.forEach(p => { p.fechado = false; });
    }

    this._persist();

    if (window.db && typeof window.db.adicionarNotificacao === 'function') {
      window.db.adicionarNotificacao(
        'DEVOLUCAO',
        `Diário Reaberto • ${turma.codigo}`,
        `A coordenação reabriu o diário de classe da turma ${turma.codigo}. Edições de frequências, notas e conteúdos estão liberadas.`,
        'Coordenação Pedagógica'
      );
    }

    window.app.mostrarToast(`Diário da turma ${turma.codigo} reaberto com sucesso! Edições liberadas para os professores.`, 'info');
    this.renderDashboard();
    this.renderListaTurmas();
    this.renderVisaoCurricular();
    this.renderPainelFechamento();
  }

  // ─── CRIAR NOVA TURMA ────────────────────────────────────────────────────────

  abrirModalNovaTurma() {
    const modal = document.getElementById('modalCoordenadorNovaTurma');
    if (!modal) return;

    const selectCurso = document.getElementById('novaTurmaCurso');
    if (selectCurso) {
      selectCurso.innerHTML = (window.db.data.cursos || []).map(function(c) {
        return '<option value="' + c.id + '">' + c.nome + '</option>';
      }).join('');
    }

    ['novaTurmaNome','novaTurmaLimiteVagas'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const selectTurno = document.getElementById('novaTurmaTurno');
    if (selectTurno) selectTurno.value = 'Manhã';
    const selectSem = document.getElementById('novaTurmaSemestre');
    if (selectSem) selectSem.value = new Date().getFullYear() + '-1';

    modal.classList.add('open');
  }

  salvarNovaTurma() {
    const nome = document.getElementById('novaTurmaNome') ? document.getElementById('novaTurmaNome').value.trim() : '';
    const cursoId = Number(document.getElementById('novaTurmaCurso') ? document.getElementById('novaTurmaCurso').value : 0);
    const turno = document.getElementById('novaTurmaTurno') ? document.getElementById('novaTurmaTurno').value : 'Manhã';
    const semVal = document.getElementById('novaTurmaSemestre') ? document.getElementById('novaTurmaSemestre').value : '';
    const vagas = Number(document.getElementById('novaTurmaLimiteVagas') ? document.getElementById('novaTurmaLimiteVagas').value : 0);

    if (!nome || !cursoId || !vagas) {
      window.app.mostrarToast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    const parts = semVal.split('-');
    const ano = parts[0] || String(new Date().getFullYear());
    const semestre = parts[1] || '1';
    const curso = (window.db.data.cursos || []).find(function(c) { return c.id === cursoId; });
    const sigla = curso ? curso.codigo.split('-')[0] : 'TDS';
    const letraTurno = turno === 'Tarde' ? 'T' : turno === 'Noite' ? 'N' : 'M';

    const ids = (window.db.data.turmas || []).map(function(t) { return t.id; });
    const newId = ids.length > 0 ? Math.max.apply(null, ids) + 1 : 20;

    const novaTurma = {
      id: newId,
      cursoId: cursoId,
      escolaId: 1,
      codigo: sigla + '-' + ano + '-' + semestre + letraTurno,
      nome: nome,
      ano: Number(ano),
      semestre: Number(semestre),
      periodo: turno,
      status: 'EM_ANDAMENTO',
      dataInicio: ano + '-02-01',
      dataFim: ano + '-12-15',
      totalAlunos: 0,
      limiteVagas: vagas
    };

    if (!window.db.data.turmas) window.db.data.turmas = [];
    window.db.data.turmas.push(novaTurma);

    // Cria atribuições iniciais de UCs para a nova turma baseadas no curso
    const ucsCurso = (window.db.data.unidadesCurriculares || []).filter(function(uc) {
      return uc.cursoId === cursoId;
    });

    if (!window.db.data.atribuicoes) window.db.data.atribuicoes = [];
    ucsCurso.forEach(function(uc) {
      const existeAtr = window.db.data.atribuicoes.some(function(a) {
        return a.turmaId === newId && a.unidadeCurricularId === uc.id;
      });
      if (!existeAtr) {
        const atrIds = window.db.data.atribuicoes.map(function(a) { return a.id; });
        const newAtrId = atrIds.length > 0 ? Math.max.apply(null, atrIds) + 1 : 1;
        window.db.data.atribuicoes.push({
          id: newAtrId,
          turmaId: newId,
          unidadeCurricularId: uc.id,
          docenteId: 1, // Atribui docente inicial padrão
          status: 'EM_ANDAMENTO'
        });
      }
    });

    if (typeof window.db.persist === 'function') {
      window.db.persist();
    } else {
      this._persist();
    }

    // Notifica atualização global de turmas para Coordenação, Professor e Orientadores
    if (typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('turmas-atualizadas', { detail: { turma: novaTurma } }));
      } catch (e) {}
    }

    // Se o controller da coordenação, orientadores ou professor tiver seletores ativos, atualiza-os
    if (window.portalOrientadorController && typeof window.portalOrientadorController.carregarTurmas === 'function') {
      try { window.portalOrientadorController.carregarTurmas(); } catch (e) {}
    }
    if (window.app && typeof window.app.renderizarCursos === 'function') {
      try { window.app.renderizarCursos(); } catch (e) {}
    }

    window.app.fecharModal('modalCoordenadorNovaTurma');
    window.app.mostrarToast('Turma "' + novaTurma.codigo + '" criada com sucesso!', 'success');
    this.renderDashboard();
    this.renderListaTurmas();
    this.renderVisaoCurricular();
  }

  // ─── ATRIBUIÇÃO DE DOCENTES ──────────────────────────────────────────────────

  abrirModalAtribuirDocente(turmaId) {
    this._turmaIdAtribuicao = turmaId;
    const turma = (window.db.data.turmas || []).find(function(t) { return t.id === turmaId; });
    const modal = document.getElementById('modalAtribuirDocente');
    if (!modal || !turma) return;

    const label = document.getElementById('atribuirDocenteTurmaLabel');
    if (label) label.textContent = turma.codigo + ' — ' + turma.periodo;

    const select = document.getElementById('selectAtribuirDocente');
    const atribuicoes = this._getAtribuicoes();
    const self = this;

    if (select) {
      select.innerHTML = '<option value="">— Selecione um docente —</option>'
        + (window.db.data.usuarios || [])
          .filter(function(u) { return u.perfil === 'PROFESSOR'; })
          .map(function(u) {
            const conflito = atribuicoes.find(function(a) {
              if (a.docenteId !== u.id || a.turmaId === turmaId) return false;
              const outra = (window.db.data.turmas || []).find(function(t) { return t.id === a.turmaId; });
              return outra && outra.periodo === turma.periodo && outra.status === 'EM_ANDAMENTO';
            });
            return '<option value="' + u.id + '">' + u.nome + (conflito ? ' [Conflito de Turno]' : '') + '</option>';
          }).join('');

      const checkConflitoLive = function() {
        const docId = Number(select.value);
        const alerta = document.getElementById('atribuirConflitoAlerta');
        const texto = document.getElementById('atribuirConflitoTexto');
        if (!alerta) return;
        if (!docId) {
          alerta.style.display = 'none';
          return;
        }
        const conflito = atribuicoes.find(function(a) {
          if (a.docenteId !== docId || a.turmaId === turmaId) return false;
          const outra = (window.db.data.turmas || []).find(function(t) { return t.id === a.turmaId; });
          return outra && outra.periodo === turma.periodo && outra.status === 'EM_ANDAMENTO';
        });
        if (conflito) {
          const outra = (window.db.data.turmas || []).find(function(t) { return t.id === conflito.turmaId; });
          alerta.style.display = 'block';
          if (texto) {
            texto.innerHTML = 'O docente já leciona na turma <strong>' + (outra ? outra.codigo : '') + '</strong> no turno <strong>' + turma.periodo + '</strong>.';
          }
        } else {
          alerta.style.display = 'none';
        }
      };

      select.onchange = checkConflitoLive;

      const atAtual = atribuicoes.find(function(a) { return a.turmaId === turmaId; });
      if (atAtual) select.value = atAtual.docenteId;
      checkConflitoLive();
    }

    modal.classList.add('open');
  }

  confirmarAtribuicaoDocente() {
    const turmaId = this._turmaIdAtribuicao;
    const docenteId = Number(document.getElementById('selectAtribuirDocente') ? document.getElementById('selectAtribuirDocente').value : 0);

    if (!docenteId) {
      window.app.mostrarToast('Selecione um docente.', 'warning');
      return;
    }

    const turma = (window.db.data.turmas || []).find(function(t) { return t.id === turmaId; });
    const docente = (window.db.data.usuarios || []).find(function(u) { return u.id === docenteId; });
    const atribuicoes = this._getAtribuicoes();

    // ── TRAVA DE CONFLITO DE TURNO ─────────────────────────────────────────────
    const conflito = atribuicoes.find(function(a) {
      if (a.docenteId !== docenteId || a.turmaId === turmaId) return false;
      const outra = (window.db.data.turmas || []).find(function(t) { return t.id === a.turmaId; });
      return outra && outra.periodo === turma.periodo && outra.status === 'EM_ANDAMENTO';
    });

    if (conflito) {
      const outra = (window.db.data.turmas || []).find(function(t) { return t.id === conflito.turmaId; });
      const ok = confirm(
        'CONFLITO DE HORARIO DETECTADO!\n\n'
        + 'O docente "' + (docente ? docente.nome : '') + '" ja esta atribuido a turma "' + (outra ? outra.codigo : '') + '" '
        + 'no mesmo turno (' + (turma ? turma.periodo : '') + ').\n\n'
        + 'Isso pode gerar sobreposicao de horarios. Deseja confirmar mesmo assim?'
      );
      if (!ok) return;
    }
    // ──────────────────────────────────────────────────────────────────────────

    const idx = atribuicoes.findIndex(function(a) { return a.turmaId === turmaId; });
    if (idx >= 0) atribuicoes.splice(idx, 1);
    atribuicoes.push({
      turmaId: turmaId,
      docenteId: docenteId,
      data: new Date().toISOString().split('T')[0]
    });
    window.db.data.atribuicoes = atribuicoes;
    this._persist();

    window.app.fecharModal('modalAtribuirDocente');
    window.app.mostrarToast((docente ? docente.nome.split(' ')[0] : 'Docente') + ' atribuído à turma ' + (turma ? turma.codigo : '') + '!', 'success');
    this.renderListaTurmas(); this.renderVisaoCurricular();
  }

  // ─── SOLICITAR FECHAMENTO (DOCENTE) ─────────────────────────────────────────

  abrirModalSolicitarFechamento(turmaIdPreselecionada) {
    const user = window.auth.getUser();
    if (!user) return;
    const modal = document.getElementById('modalSolicitarFechamento');
    if (!modal) return;

    const atribuicoes = this._getAtribuicoes().filter(function(a) { return a.docenteId === user.id; });
    const solicitadas = this._getSolicitacoes()
      .filter(function(s) { return s.status === 'AGUARDANDO' || s.status === 'APROVADO'; })
      .map(function(s) { return s.turmaId; });

    const select = document.getElementById('selectFechamentoTurma');
    if (select) {
      const disponiveis = (window.db.data.turmas || []).filter(function(t) {
        if (t.status !== 'EM_ANDAMENTO') return false;
        if (user.perfil === 'PROFESSOR') {
          const at = atribuicoes.find(function(a) { return a.turmaId === t.id; });
          if (!at) return false;
        }
        return solicitadas.indexOf(t.id) === -1;
      });

      select.innerHTML = disponiveis.length
        ? disponiveis.map(function(t) {
            return '<option value="' + t.id + '">' + t.codigo + ' — ' + t.nome.substring(0,40) + '</option>';
          }).join('')
        : '<option value="">Nenhuma turma disponível para fechamento</option>';

      if (turmaIdPreselecionada && disponiveis.some(function(t) { return t.id === Number(turmaIdPreselecionada); })) {
        select.value = turmaIdPreselecionada;
      }
    }

    const obs = document.getElementById('inputFechamentoObs');
    if (obs) obs.value = '';
    modal.classList.add('open');
  }

  confirmarSolicitacaoFechamento() {
    const user = window.auth.getUser();
    const select = document.getElementById('selectFechamentoTurma');
    const turmaId = select ? Number(select.value) : 0;
    const obs = document.getElementById('inputFechamentoObs') ? document.getElementById('inputFechamentoObs').value.trim() : '';

    if (!turmaId) {
      window.app.mostrarToast('Selecione uma turma.', 'warning');
      return;
    }

    // Validação de notas preenchidas (0 a 100)
    const alunos = window.db ? window.db.getAlunosPorTurma(turmaId, 'TODOS') : [];
    const turma = (window.db.data.turmas || []).find(function(t) { return t.id === turmaId; });
    const ucId = (turma && turma.ucId) ? turma.ucId : 1;
    const avaliacoes = window.db ? window.db.getAvaliacoesPorUC(turmaId, ucId) : [];

    let pendentes = 0;
    if (avaliacoes.length > 0 && alunos.length > 0) {
      alunos.forEach(function(al) {
        avaliacoes.forEach(function(av) {
          const nota = window.db.getNota(av.id, al.id);
          if (nota === null || isNaN(nota) || nota === undefined) {
            pendentes++;
          }
        });
      });
    }

    if (pendentes > 0) {
      const confirma = confirm(`Atenção: existem ${pendentes} nota(s) pendente(s) de lançamento nesta turma.\n\nDeseja preencher automaticamente com média padrão (75 pts) antes de solicitar autorização da coordenação?`);
      if (confirma) {
        alunos.forEach(function(al) {
          avaliacoes.forEach(function(av) {
            const nota = window.db.getNota(av.id, al.id);
            if (nota === null || isNaN(nota) || nota === undefined) {
              window.db.salvarNota(av.id, al.id, 75);
            }
          });
        });
      } else {
        window.app.mostrarToast('Preencha todas as notas de 0 a 100 antes de solicitar o fechamento.', 'warning');
        return;
      }
    }

    const res = window.db.fecharEtapaDocente(turmaId, user ? user.id : 1, obs);
    if (!res.success) {
      window.app.mostrarToast(res.msg, 'warning');
      return;
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('renova:db-updated'));
    }

    window.app.fecharModal('modalSolicitarFechamento');
    window.app.mostrarToast(res.msg, res.todosFechados ? 'success' : 'info');
    if (window.app && window.app.renderizarHomeProfessor) {
      window.app.renderizarHomeProfessor();
    }
  }

  // ─── APROVAR / RECUSAR FECHAMENTO (COORDENADOR) ──────────────────────────────

  aprovarFechamento(solId) {
    const solicitacoes = this._getSolicitacoes();
    const sol = solicitacoes.find(function(s) { return s.id === solId; });
    if (!sol) return;

    sol.status = 'APROVADO';
    sol.dataAprovacao = new Date().toLocaleDateString('pt-BR');

    const turma = (window.db.data.turmas || []).find(function(t) { return t.id === sol.turmaId; });
    if (turma) turma.status = 'CONCLUIDA';

    window.db.data.solicitacoesFechamento = solicitacoes;
    this._persist();

    // Notificação automática de aprovação
    if (window.db && typeof window.db.adicionarNotificacao === 'function') {
      window.db.adicionarNotificacao(
        'APROVACAO',
        `Fechamento Autorizado • ${turma ? turma.codigo : 'Turma'}`,
        `A coordenação autorizou e oficializou o fechamento das médias e frequências da turma ${turma ? turma.codigo : ''}.`,
        'Coordenação Pedagógica'
      );
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('renova:db-updated'));
    }

    window.app.mostrarToast('Fechamento da turma ' + (turma ? turma.codigo : '') + ' autorizado e oficializado com sucesso!', 'success');
    this.renderDashboard();
    this.renderListaTurmas(); this.renderVisaoCurricular();
    this.renderPainelFechamento();
  }

  recusarFechamento(solId) {
    // Exibir modal inline para coletar o motivo da devolução
    const existing = document.getElementById('modalDevolverMotivo');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modalDevolverMotivo';
    overlay.className = 'modal-devolver-motivo';
    overlay.innerHTML = `
      <div class="modal-devolver-box">
        <p class="modal-devolver-title">Devolver para Ajustes</p>
        <p class="modal-devolver-sub">Informe ao docente o que deve ser corrigido antes do fechamento oficial.</p>
        <textarea id="inputMotivoDevolver" class="modal-devolver-textarea"
          placeholder="Ex: Notas dos alunos X e Y estão em branco. Frequência de 03/10 precisa ser conferida..."
          rows="4" autofocus></textarea>
        <div class="modal-devolver-actions">
          <button type="button" class="btn btn-outline btn-sm"
            onclick="document.getElementById('modalDevolverMotivo').remove()">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary"
            onclick="window.coordenadorController._confirmarDevolucao(${solId})">
            Devolver ao Docente
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(function() {
      const ta = document.getElementById('inputMotivoDevolver');
      if (ta) ta.focus();
    }, 80);
  }

  _confirmarDevolucao(solId) {
    const motivo = (document.getElementById('inputMotivoDevolver') || {}).value || '';
    const solicitacoes = this._getSolicitacoes();
    const sol = solicitacoes.find(function(s) { return s.id === solId; });
    if (!sol) return;

    sol.status = 'DEVOLVIDO';
    sol.motivoDevolucao = motivo.trim();
    sol.dataDevolucao = new Date().toLocaleDateString('pt-BR');
    window.db.data.solicitacoesFechamento = solicitacoes;
    this._persist();

    // Regra SENAI: Reabre as etapas dos docentes responsáveis ao devolver
    if (window.db && typeof window.db.reabrirEtapasDocentes === 'function') {
      window.db.reabrirEtapasDocentes(sol.turmaId);
    }

    const turma = (window.db.data.turmas || []).find(function(t) { return t.id === sol.turmaId; });

    // Notificação automática de devolução
    if (window.db && typeof window.db.adicionarNotificacao === 'function') {
      window.db.adicionarNotificacao(
        'DEVOLUCAO',
        `Diário Devolvido para Ajustes • ${turma ? turma.codigo : 'Turma'}`,
        `A coordenação devolveu o diário da turma ${turma ? turma.codigo : ''} para ajustes docentes. Motivo: ${motivo.trim() || 'Verificar notas ou frequência pendentes'}.`,
        'Coordenação Pedagógica'
      );
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('renova:db-updated'));
    }

    const overlay = document.getElementById('modalDevolverMotivo');
    if (overlay) overlay.remove();

    window.app.mostrarToast('Diário devolvido aos professores responsáveis com sucesso.', 'info');
    this.renderDashboard();
    this.renderPainelFechamento();
  }

  // ─── FILTRO DE TABS ──────────────────────────────────────────────────────────

  filtrarTurmas(filtro) {
    document.querySelectorAll('#coordTurmasTabsGroup .tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.filtro === filtro);
    });
    this.renderListaTurmas(filtro);
  }

  // ─── BIND EVENTOS ────────────────────────────────────────────────────────────

  // ─── VISÃO CURRICULAR HIERÁRQUICA (CURSOS -> MATÉRIAS -> TURMAS COM SÍNTESE) ──
  renderVisaoCurricular(cursoIdSelecionado) {
    const el = document.getElementById('coordCurricularExplorer');
    if (!el) return;

    const cursos = window.db.data.cursos || [];
    if (cursos.length === 0) {
      el.innerHTML = '<div class="coord-empty-state"><p>Nenhum curso cadastrado.</p></div>';
      return;
    }

    if (!cursoIdSelecionado) {
      cursoIdSelecionado = this._cursoSelecionadoId || cursos[0].id;
    }
    this._cursoSelecionadoId = Number(cursoIdSelecionado);

    const cursoAtual = cursos.find(c => c.id === this._cursoSelecionadoId) || cursos[0];
    const ucs = window.db.getUCsPorCurso 
      ? window.db.getUCsPorCurso(cursoAtual.id) 
      : (window.db.data.unidadesCurriculares || []).filter(u => u.cursoId === cursoAtual.id);
    const turmasDoCurso = (window.db.data.turmas || []).filter(t => t.cursoId === cursoAtual.id && t.status === 'EM_ANDAMENTO');
    const atribuicoes = this._getAtribuicoes();
    const self = this;

    // 1. Seletor de Cursos (Pills superiores com contadores)
    let cursosPillsHtml = '<div class="coord-course-selector-bar">';
    cursos.forEach(c => {
      const active = c.id === cursoAtual.id;
      const countTurmas = (window.db.data.turmas || []).filter(t => t.cursoId === c.id && t.status === 'EM_ANDAMENTO').length;
      const countUcs = (window.db.data.unidadesCurriculares || []).filter(u => u.cursoId === c.id).length;
      cursosPillsHtml += `
        <button type="button" class="coord-course-pill ${active ? 'active' : ''}" onclick="window.coordenadorController.renderVisaoCurricular(${c.id})">
          <div class="pill-code">${c.codigo}</div>
          <div class="pill-name">${c.nome}</div>
          <div class="pill-meta">${countUcs} Disciplinas &bull; ${countTurmas} Turmas Ativas</div>
        </button>
      `;
    });
    cursosPillsHtml += '</div>';

    // 2. Disciplinas (UCs) com Turmas e Síntese integrada (sem banner decorativo)
    let ucsHtml = '';
    if (ucs.length === 0) {
      ucsHtml = `
        <div class="coord-empty-state" style="padding: 40px 20px;">
          <p>Nenhuma disciplina curricular cadastrada para este curso.</p>
        </div>
      `;
    } else {
      ucs.forEach(uc => {
        const docenteTitular = (window.db.data.usuarios || []).find(u => u.id === uc.docenteTitularId);

        let turmasCardsHtml = '';
        if (turmasDoCurso.length === 0) {
          turmasCardsHtml = '<div class="coord-turma-empty" style="padding: 16px; color: var(--text-muted); font-size: 12.5px;">Nenhuma turma em andamento vinculada a este curso.</div>';
        } else {
          turmasCardsHtml = '<div class="coord-uc-turmas-grid">' + turmasDoCurso.map(turma => {
            const at = atribuicoes.find(a => a.turmaId === turma.id);
            const docenteTurma = at ? (window.db.data.usuarios || []).find(u => u.id === at.docenteId) : docenteTitular;

            return `
              <div class="coord-turma-card">
                <div class="turma-card-top">
                  <div class="turma-card-code">${turma.codigo}</div>
                </div>

                <div class="turma-card-docente">
                  <span class="docente-label">Docente:</span>
                  <strong>${docenteTurma ? docenteTurma.nome.split(' ').slice(0, 2).join(' ') : '— Não atribuído —'}</strong>
                </div>

                <div class="turma-card-actions">
                  <button type="button" class="btn btn-sm btn-outline" onclick="window.app.abrirDiarioComTurma(${turma.id})" title="Inspecionar Chamada em Modo Observador">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Ver Diário
                  </button>
                  <button type="button" class="btn btn-sm btn-primary" onclick="window.app.abrirSinteseComTurma(${turma.id}, ${uc.id})" title="Inspecionar Síntese em Modo Observador">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg> Ver Síntese
                  </button>
                </div>
              </div>
            `;
          }).join('') + '</div>';
        }

        ucsHtml += `
          <div class="coord-uc-card">
            <div class="coord-uc-header">
              <div class="uc-header-left">
                <span class="uc-modulo-badge">${uc.modulo ? uc.modulo + 'º Módulo' : 'Geral'}</span>
                <span class="uc-code">${uc.codigo}</span>
                <h4 class="uc-title">${uc.nome}</h4>
              </div>
              <div class="uc-header-right">
                <span class="uc-ch-badge">&#9200; ${uc.cargaHoraria}h</span>
                <span class="uc-docente-badge">&#128104;&#8205;&#127979; Titular: ${docenteTitular ? docenteTitular.nome.split(' ').slice(0, 2).join(' ') : 'SENAI'}</span>
              </div>
            </div>

            <div class="coord-uc-body">
              <div class="coord-uc-turmas-title">
                <span>Turmas Vinculadas a esta Matéria</span>
                <span class="count-pill">${turmasDoCurso.length}</span>
              </div>
              ${turmasCardsHtml}
            </div>
          </div>
        `;
      });
    }

    el.innerHTML = cursosPillsHtml + ucsHtml;
  }

  // ─── EXPORTAÇÃO DE PLANO DE AULA (PTD) ───────────────────────────────────────
  exportarPlanoDeAula(turmaId = null) {
    if (!window.db) return;
    const turmas = window.db.data.turmas || [];
    const tId = turmaId || (turmas.length > 0 ? turmas[0].id : null);
    const turma = turmas.find(t => t.id === Number(tId));
    const curso = (window.db.data.cursos || []).find(c => c.id === (turma ? turma.cursoId : null));
    const ucs = (window.db.data.unidadesCurriculares || []).filter(u => !curso || u.cursoId === curso.id);
    const aulas = (window.db.data.aulas || []).filter(a => !turma || a.turmaId === turma.id);

    const payload = {
      tipo: 'SENAI_PTD_OFICIAL',
      versao: '2.0',
      dataExportacao: new Date().toISOString(),
      escola: 'Escola SENAI Roberto Simonsen',
      turma: turma || { id: 1, codigo: '1-2026.205 BA', nome: 'Técnico em Desenvolvimento de Sistemas' },
      curso: curso || { id: 1, nome: 'Técnico em Desenvolvimento de Sistemas', codigo: 'TDS-2026' },
      unidadesCurriculares: ucs,
      cronogramaAulas: aulas.length > 0 ? aulas : [
        {
          id: 1,
          turmaId: turma ? turma.id : 1,
          unidadeCurricularId: ucs[0] ? ucs[0].id : 1,
          data: '2026-02-15',
          tema: 'Introdução ao Desenvolvimento e Arquitetura Web',
          conteudo: 'Apresentação do plano de ensino, critérios de avaliação e ferramentas de versionamento.',
          horas: 4,
          status: 'REALIZADA'
        },
        {
          id: 2,
          turmaId: turma ? turma.id : 1,
          unidadeCurricularId: ucs[0] ? ucs[0].id : 1,
          data: '2026-02-22',
          tema: 'HTML Semântico, Acessibilidade e Componentização',
          conteudo: 'Prática de formulários, validação nativa, ARIA e contraste de cores conforme diretrizes SENAI.',
          horas: 4,
          status: 'PREVISTA'
        }
      ],
      planosTrabalhoDocente: [
        {
          ucCodigo: ucs[0] ? ucs[0].sigla || 'FRONT' : 'FRONT',
          ucNome: ucs[0] ? ucs[0].nome : 'Programação Front-end',
          cargaHoraria: ucs[0] ? ucs[0].cargaHoraria || 80 : 80,
          competenciasGerais: 'Desenvolver interfaces ricas, acessíveis e responsivas atendendo aos padrões industriais.',
          objetivosEspecificos: [
            'Dominar layouts CSS modernos (Grid, Flexbox)',
            'Garantir conformidade com acessibilidade e Libras',
            'Integrar APIs RESTful e persistência local'
          ],
          metodologia: 'Metodologia SENAI de Educação Profissional com aprendizagem baseada em projetos práticos.',
          criteriosAvaliacao: 'Avaliação formativa contínua (0 a 100), entregas de sprints e frequência mínima regimental de 75%.'
        }
      ]
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    const codigoTurma = turma ? turma.codigo.replace(/[^a-zA-Z0-9_-]/g, '_') : 'turma';
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'PTD_' + codigoTurma + '_' + new Date().toISOString().split('T')[0] + '.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (window.app && typeof window.app.mostrarToast === 'function') {
      window.app.mostrarToast('Plano de Trabalho Docente (PTD) exportado com sucesso!', 'success');
    }
  }

  // ─── GESTÃO COMPLETA DE PTD DA UC (VISUALIZAR / EDITAR) ─────────────────────
  abrirModalGerenciarPTD(cursoId = null, ucId = null) {
    const cursos = window.db.data.cursos || [];
    if (!cursos.length) {
      window.app.mostrarToast('Nenhum curso cadastrado para gerenciar PTD.', 'warning');
      return;
    }

    const modal = document.getElementById('modalCoordenadorPTD');
    if (!modal) return;

    const selectCurso = document.getElementById('ptdModalCursoSelect');
    if (selectCurso) {
      selectCurso.innerHTML = cursos.map(c => `<option value="${c.id}">${c.codigo} - ${c.nome}</option>`).join('');
      if (cursoId) selectCurso.value = cursoId;
    }

    const cId = Number(selectCurso ? selectCurso.value : cursos[0].id);
    this.onPtdModalCursoChange(cId, ucId);

    window.app.abrirModal('modalCoordenadorPTD');
  }

  onPtdModalCursoChange(cursoId, ucIdPreselecionada = null) {
    const ucs = (window.db.data.unidadesCurriculares || []).filter(u => u.cursoId === Number(cursoId));
    const selectUc = document.getElementById('ptdModalUcSelect');
    if (!selectUc) return;

    if (!ucs.length) {
      selectUc.innerHTML = '<option value="">Nenhuma UC cadastrada neste curso</option>';
      document.getElementById('ptdTopicosContainer').innerHTML = '<p style="color:#64748b;font-size:12px;">Nenhuma disciplina disponível.</p>';
      return;
    }

    selectUc.innerHTML = ucs.map(u => `<option value="${u.id}">${u.codigo} - ${u.nome}</option>`).join('');
    if (ucIdPreselecionada && ucs.some(u => u.id === Number(ucIdPreselecionada))) {
      selectUc.value = ucIdPreselecionada;
    }
    this.carregarDadosPtdUc(selectUc.value);
  }

  onPtdModalUcChange(ucId) {
    this.carregarDadosPtdUc(ucId);
  }

  carregarDadosPtdUc(ucId) {
    const ucs = window.db.data.unidadesCurriculares || [];
    const uc = ucs.find(u => u.id === Number(ucId));
    if (!uc) return;

    const chInput = document.getElementById('ptdModalCargaHoraria');
    const docInput = document.getElementById('ptdModalDocenteTitular');
    const compTextarea = document.getElementById('ptdModalCompetencias');
    const container = document.getElementById('ptdTopicosContainer');

    if (chInput) chInput.value = uc.cargaHoraria || 80;

    const titular = (window.db.data.usuarios || []).find(u => u.id === uc.docenteTitularId);
    if (docInput) docInput.value = titular ? titular.nome : (uc.docenteTitularNome || 'Nathan Santana Matos');

    if (compTextarea) {
      compTextarea.value = uc.competencias || 'Desenvolver sistemas e interfaces responsivas com foco em usabilidade, semântica web, arquitetura em camadas e padrões industriais SENAI.';
    }

    // Tópicos programados (conteúdos das aulas)
    let topicos = uc.conteudosProgramados;
    if (!topicos || !Array.isArray(topicos) || topicos.length === 0) {
      topicos = [
        { tema: 'Aula 1: Introdução aos Elementos Semânticos', conteudo: 'Introdução aos elementos semânticos do HTML (header, nav, main, section, article, aside e footer).' },
        { tema: 'Aula 2: Layouts Modernos com Flexbox e Grid', conteudo: 'Estilização moderna com CSS Flexbox, Grid Layout e propriedades de alinhamento responsivo.' },
        { tema: 'Aula 3: Fundamentos de JavaScript e DOM', conteudo: 'Conceitos fundamentais de JavaScript: variáveis, funções, eventos e manipulação direta da árvore DOM.' },
        { tema: 'Aula 4: Persistência Local e Acessibilidade Web', conteudo: 'Implementação de armazenamento local com localStorage, acessibilidade WCAG e conformidade com VLibras.' }
      ];
    }

    container.innerHTML = '';
    topicos.forEach(t => {
      this.adicionarTopicoPtdLinha(t.tema, t.conteudo);
    });
  }

  adicionarTopicoPtdLinha(tema = '', conteudo = '') {
    const container = document.getElementById('ptdTopicosContainer');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'ptd-topico-row';
    row.style.cssText = 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:6px;';
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <input type="text" class="ptd-topico-tema filter-select" style="flex:1; font-size:12.5px; font-weight:700;" placeholder="Título / Tema da Aula (ex: Aula 1: Introdução)" value="${tema ? tema.replace(/"/g, '&quot;') : ''}">
        <button type="button" class="btn btn-outline btn-sm" onclick="this.closest('.ptd-topico-row').remove()" style="color:#ef4444; border-color:#fecaca; font-size:11px; padding:2px 8px;" title="Remover conteúdo">&times;</button>
      </div>
      <textarea class="ptd-topico-conteudo filter-select" rows="2" style="width:100%; font-size:12px; resize:vertical;" placeholder="Descrição detalhada do conteúdo ministrado previsto no PTD...">${conteudo || ''}</textarea>
    `;
    container.appendChild(row);
  }

  salvarPtdUcAtual() {
    const selectUc = document.getElementById('ptdModalUcSelect');
    if (!selectUc || !selectUc.value) {
      window.app.mostrarToast('Selecione uma Unidade Curricular.', 'warning');
      return;
    }

    const ucId = Number(selectUc.value);
    const ucs = window.db.data.unidadesCurriculares || [];
    const uc = ucs.find(u => u.id === ucId);
    if (!uc) return;

    const ch = Number(document.getElementById('ptdModalCargaHoraria')?.value || 80);
    const docNome = document.getElementById('ptdModalDocenteTitular')?.value || '';
    const comp = document.getElementById('ptdModalCompetencias')?.value || '';

    const rows = document.querySelectorAll('#ptdTopicosContainer .ptd-topico-row');
    const novosTopicos = [];
    rows.forEach(r => {
      const tema = (r.querySelector('.ptd-topico-tema')?.value || '').trim();
      const conteudo = (r.querySelector('.ptd-topico-conteudo')?.value || '').trim();
      if (tema || conteudo) {
        novosTopicos.push({ tema: tema || 'Aula de Conteúdo', conteudo: conteudo || tema });
      }
    });

    uc.cargaHoraria = ch;
    uc.docenteTitularNome = docNome;
    uc.competencias = comp;
    uc.conteudosProgramados = novosTopicos;

    // Sincroniza em window.db.data.ptds
    if (!window.db.data.ptds) window.db.data.ptds = [];
    const idxPtd = window.db.data.ptds.findIndex(p => p.ucId === ucId);
    const ptdObj = {
      ucId: ucId,
      ucCodigo: uc.codigo,
      ucNome: uc.nome,
      cargaHoraria: ch,
      competencias: comp,
      conteudosProgramados: novosTopicos,
      atualizadoEm: new Date().toISOString()
    };
    if (idxPtd >= 0) {
      window.db.data.ptds[idxPtd] = ptdObj;
    } else {
      window.db.data.ptds.push(ptdObj);
    }

    this._persist();

    // Se o Diário do Professor estiver aberto, atualiza o seletor de PTD
    if (window.diarioController && typeof window.diarioController.popularSelectPtd === 'function') {
      window.diarioController.popularSelectPtd();
    }

    window.app.fecharModal('modalCoordenadorPTD');
    window.app.mostrarToast('Conteúdos do Plano de Trabalho Docente salvos e integrados ao Diário!', 'success');
    this.renderVisaoCurricular();
  }

  exportarPtdUcAtual() {
    const selectUc = document.getElementById('ptdModalUcSelect');
    const selectCurso = document.getElementById('ptdModalCursoSelect');
    if (!selectUc || !selectUc.value) {
      window.app.mostrarToast('Selecione uma UC para exportar.', 'warning');
      return;
    }
    const ucId = Number(selectUc.value);
    const cursoId = Number(selectCurso ? selectCurso.value : 1);

    const uc = (window.db.data.unidadesCurriculares || []).find(u => u.id === ucId);
    const curso = (window.db.data.cursos || []).find(c => c.id === cursoId);
    const turmas = (window.db.data.turmas || []).filter(t => t.cursoId === cursoId);
    const turma = turmas.length > 0 ? turmas[0] : null;

    const topicos = (uc && uc.conteudosProgramados && uc.conteudosProgramados.length > 0)
      ? uc.conteudosProgramados
      : [
          { tema: 'Aula 1: Introdução aos Elementos Semânticos', conteudo: 'Introdução aos elementos semânticos do HTML (header, nav, main, section, article, aside e footer).' },
          { tema: 'Aula 2: Layouts Modernos com Flexbox e Grid', conteudo: 'Estilização moderna com CSS Flexbox, Grid Layout e propriedades de alinhamento responsivo.' }
        ];

    const cronogramaAulas = topicos.map((top, idx) => ({
      id: idx + 1,
      turmaId: turma ? turma.id : 1,
      unidadeCurricularId: ucId,
      data: `2026-0${Math.min(idx + 2, 6)}-15`,
      tema: top.tema,
      conteudo: top.conteudo,
      horas: 4,
      status: idx === 0 ? 'REALIZADA' : 'PREVISTA'
    }));

    const payload = {
      tipo: 'SENAI_PTD_OFICIAL',
      versao: '2.0',
      dataExportacao: new Date().toISOString(),
      escola: 'Escola SENAI Roberto Simonsen',
      turma: turma || { id: 1, codigo: '1-2026.205 BA', nome: curso ? curso.nome : 'Técnico em Desenvolvimento de Sistemas' },
      curso: curso || { id: 1, nome: 'Técnico em Desenvolvimento de Sistemas', codigo: 'TDS-2026' },
      unidadeCurricular: uc,
      cronogramaAulas: cronogramaAulas,
      planosTrabalhoDocente: [
        {
          ucCodigo: uc ? uc.codigo : 'FRONT',
          ucNome: uc ? uc.nome : 'Programação Front-end',
          cargaHoraria: uc ? uc.cargaHoraria : 80,
          competenciasGerais: uc ? uc.competencias : 'Desenvolver sistemas e interfaces atendendo padrões industriais.',
          topicosProgramados: topicos,
          metodologia: 'Metodologia SENAI de Educação Profissional com aprendizagem baseada em desafios industriais.',
          criteriosAvaliacao: 'Critérios formativos contínuos, projetos práticos e frequência mínima de 75%.'
        }
      ]
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    const codigoUc = uc ? uc.codigo.replace(/[^a-zA-Z0-9_-]/g, '_') : 'UC';
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PTD_${codigoUc}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    window.app.mostrarToast(`PTD da disciplina ${uc ? uc.nome : ''} exportado com sucesso!`, 'success');
  }

  // ─── CARREGAR TURMA (ARQUIVO / MODELO PRÉ-CONFIGURADO) ─────────────────────
  abrirModalCarregarTurma() {
    this._dadosCarregamentoTurma = null;
    const preview = document.getElementById('previewArquivoCarregarTurma');
    if (preview) {
      preview.style.display = 'none';
      preview.innerHTML = '';
    }
    const input = document.getElementById('inputArquivoCarregarTurma');
    if (input) input.value = '';
    this.alternarAbaCarregarTurma('arquivo');
    window.app.abrirModal('modalCoordenadorCarregarTurma');
  }

  alternarAbaCarregarTurma(aba) {
    const btnArq = document.getElementById('btnAbaCarregarArquivo');
    const btnMod = document.getElementById('btnAbaCarregarModelo');
    const painelArq = document.getElementById('painelCarregarArquivo');
    const painelMod = document.getElementById('painelCarregarModelo');

    if (aba === 'arquivo') {
      if (btnArq) btnArq.classList.add('active');
      if (btnMod) btnMod.classList.remove('active');
      if (painelArq) painelArq.style.display = 'block';
      if (painelMod) painelMod.style.display = 'none';
      this._modoCarregarTurma = 'arquivo';
    } else {
      if (btnArq) btnArq.classList.remove('active');
      if (btnMod) btnMod.classList.add('active');
      if (painelArq) painelArq.style.display = 'none';
      if (painelMod) painelMod.style.display = 'block';
      this._modoCarregarTurma = 'modelo';
    }
  }

  onArquivoTurmaSelecionado(input) {
    const file = input.files && input.files[0];
    const preview = document.getElementById('previewArquivoCarregarTurma');
    if (!file) return;

    const self = this;
    const reader = new FileReader();

    reader.onload = function(e) {
      try {
        const conteudo = e.target.result;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(conteudo);
          self._dadosCarregamentoTurma = parsed;
          if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `
              <strong>Arquivo JSON Válido:</strong> ${file.name} (${(file.size/1024).toFixed(1)} KB)<br>
              <strong>Turma detectada:</strong> ${parsed.turma ? (parsed.turma.codigo || parsed.turma.nome) : (parsed.nome || 'Turma Externa')}<br>
              <strong>Itens identificados:</strong> ${(parsed.alunos ? parsed.alunos.length : 0)} alunos, ${(parsed.cronogramaAulas ? parsed.cronogramaAulas.length : 0)} aulas no cronograma.
            `;
          }
        } else if (file.name.endsWith('.csv')) {
          const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length > 0);
          self._dadosCarregamentoTurma = { tipo: 'CSV', linhas: linhas, nomeArquivo: file.name };
          if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `
              <strong>Arquivo CSV Reconhecido:</strong> ${file.name}<br>
              <strong>Total de linhas:</strong> ${linhas.length} registros encontrados para processamento.
            `;
          }
        }
        window.app.mostrarToast('Arquivo lido com sucesso. Clique em Carregar e Salvar Turma para confirmar.', 'info');
      } catch (err) {
        console.error('Erro ao ler arquivo da turma:', err);
        if (preview) {
          preview.style.display = 'block';
          preview.innerHTML = `<span style="color:#ef4444;">Erro ao processar arquivo: ${err.message}</span>`;
        }
      }
    };

    reader.readAsText(file);
  }

  executarCarregamentoTurma() {
    if (!window.db) return;

    let novaTurma = null;
    let novosAlunos = [];

    if (this._modoCarregarTurma === 'modelo') {
      const modelo = document.getElementById('selectModeloPreconfigurado')?.value || 'IOT_2026';
      
      if (modelo === 'IOT_2026') {
        novaTurma = {
          id: Date.now(),
          codigo: '1-2026.310 IOT',
          nome: 'Técnico em Internet das Coisas (IoT) - Termo 1A',
          cursoId: 1,
          cursoNome: 'Técnico em Internet das Coisas',
          turno: 'Tarde',
          periodo: '2026/1',
          totalAlunos: 10,
          vagas: 32,
          status: 'EM_ANDAMENTO',
          docenteId: 1,
          professoresResponsaveis: [
            { id: 1, nome: 'Nathan Santana Matos', papel: 'Professor Titular', fechado: false }
          ]
        };
      } else if (modelo === 'AUTO_2026') {
        novaTurma = {
          id: Date.now(),
          codigo: '1-2026.402 AUT',
          nome: 'Técnico em Automação Industrial - Termo 2A',
          cursoId: 2,
          cursoNome: 'Técnico em Automação Industrial',
          turno: 'Manhã',
          periodo: '2026/1',
          totalAlunos: 10,
          vagas: 30,
          status: 'EM_ANDAMENTO',
          docenteId: 1,
          professoresResponsaveis: [
            { id: 1, nome: 'Nathan Santana Matos', papel: 'Professor Titular', fechado: false }
          ]
        };
      } else {
        novaTurma = {
          id: Date.now(),
          codigo: `1-2026.${Math.floor(100 + Math.random() * 899)} ELE`,
          nome: 'Técnico em Eletroeletrônica - Matriz SENAI',
          cursoId: 1,
          cursoNome: 'Técnico em Eletroeletrônica',
          turno: 'Noite',
          periodo: '2026/1',
          totalAlunos: 10,
          vagas: 35,
          status: 'EM_ANDAMENTO',
          docenteId: 1,
          professoresResponsaveis: [
            { id: 1, nome: 'Nathan Santana Matos', papel: 'Professor Titular', fechado: false }
          ]
        };
      }

      const nomesExemplo = [
        'Arthur Gabriel Ribeiro', 'Beatriz Lima Vasconcelos', 'Caio Henrique Ferreira',
        'Daniela Souza Nogueira', 'Eduardo Martins Prado', 'Fernanda Castro Ramos',
        'Guilherme Torres Pires', 'Helena Moraes Duarte', 'Igor Silveira Fontes', 'Juliana Rocha Neves'
      ];

      novosAlunos = nomesExemplo.map((nome, idx) => ({
        id: Date.now() + idx + 1,
        turmaId: novaTurma.id,
        nome: nome,
        matricula: `RA-${2026000 + Math.floor(Math.random() * 9000)}`,
        statusMatricula: 'ATIVO',
        numeroChamada: idx + 1,
        foto: null
      }));

    } else {
      // Modo Arquivo (.json ou .csv)
      if (!this._dadosCarregamentoTurma) {
        window.app.mostrarToast('Por favor, selecione um arquivo JSON ou CSV antes de carregar.', 'warning');
        return;
      }

      const dados = this._dadosCarregamentoTurma;
      if (dados.tipo === 'CSV') {
        const cod = `CSV-${new Date().getFullYear()}.${Math.floor(100 + Math.random() * 899)}`;
        novaTurma = {
          id: Date.now(),
          codigo: cod,
          nome: `Turma Importada via CSV (${dados.nomeArquivo})`,
          cursoId: 1,
          cursoNome: 'Curso Técnico Importado',
          turno: 'Diurno',
          periodo: '2026/1',
          totalAlunos: Math.max(dados.linhas.length - 1, 1),
          vagas: 40,
          status: 'EM_ANDAMENTO',
          docenteId: 1,
          professoresResponsaveis: [{ id: 1, nome: 'Nathan Santana Matos', papel: 'Professor Titular', fechado: false }]
        };

        // Linhas subsequentes como alunos
        novosAlunos = dados.linhas.slice(1).map((linha, idx) => {
          const colunas = linha.split(';').length > 1 ? linha.split(';') : linha.split(',');
          const nomeAluno = colunas[0] ? colunas[0].trim().replace(/"/g, '') : `Estudante ${idx+1}`;
          return {
            id: Date.now() + idx + 1,
            turmaId: novaTurma.id,
            nome: nomeAluno,
            matricula: `RA-${2026100 + idx}`,
            statusMatricula: 'ATIVO',
            numeroChamada: idx + 1,
            foto: null
          };
        });

      } else {
        // Objeto JSON
        const tInfo = dados.turma || {};
        novaTurma = {
          id: Date.now(),
          codigo: tInfo.codigo || `IMP-${Math.floor(100 + Math.random() * 899)}`,
          nome: tInfo.nome || dados.nome || 'Turma Importada JSON',
          cursoId: dados.curso ? (dados.curso.id || 1) : 1,
          cursoNome: dados.curso ? (dados.curso.nome || 'Técnico Especializado') : 'Técnico Especializado',
          turno: tInfo.turno || 'Manhã',
          periodo: tInfo.periodo || '2026/1',
          totalAlunos: Array.isArray(dados.alunos) ? dados.alunos.length : 12,
          vagas: 35,
          status: 'EM_ANDAMENTO',
          docenteId: 1,
          professoresResponsaveis: [{ id: 1, nome: 'Nathan Santana Matos', papel: 'Professor Titular', fechado: false }]
        };

        if (Array.isArray(dados.alunos) && dados.alunos.length > 0) {
          novosAlunos = dados.alunos.map((a, idx) => ({
            id: Date.now() + idx + 1,
            turmaId: novaTurma.id,
            nome: a.nome || `Aluno ${idx+1}`,
            matricula: a.matricula || `RA-${2026200 + idx}`,
            statusMatricula: 'ATIVO',
            numeroChamada: idx + 1,
            foto: null
          }));
        } else {
          novosAlunos = [
            { id: Date.now() + 1, turmaId: novaTurma.id, nome: 'Aluno Exemplo Importado A', matricula: 'RA-2026881', statusMatricula: 'ATIVO', numeroChamada: 1 },
            { id: Date.now() + 2, turmaId: novaTurma.id, nome: 'Aluno Exemplo Importado B', matricula: 'RA-2026882', statusMatricula: 'ATIVO', numeroChamada: 2 }
          ];
        }
      }
    }

    // Salva no banco de dados
    if (!window.db.data.turmas) window.db.data.turmas = [];
    window.db.data.turmas.push(novaTurma);

    if (!window.db.data.alunos) window.db.data.alunos = [];
    novosAlunos.forEach(al => window.db.data.alunos.push(al));

    // Atribuição inicial
    const atribs = this._getAtribuicoes();
    atribs.push({
      id: Date.now(),
      turmaId: novaTurma.id,
      docenteId: 1,
      unidadeCurricularId: 1,
      ano: 2026
    });
    window.db.data.atribuicoes = atribs;

    this._persist();

    window.app.fecharModal('modalCoordenadorCarregarTurma');
    window.app.mostrarToast(`Turma ${novaTurma.codigo} carregada e cadastrada com sucesso!`, 'success');

    this.renderDashboard();
    this.renderListaTurmas();
    this.renderVisaoCurricular();
    this.renderPainelFechamento();

    // Atualiza seletores no portal do professor e orientação
    if (window.app && typeof window.app.popularSelectTurmasGlobal === 'function') {
      window.app.popularSelectTurmasGlobal();
    }
  }

  abrirModalRegistrarCompensacao(id) {
    if (window.compensacoesController) {
      window.compensacoesController.abrirModalRegistrarCompensacao(id);
    }
  }

  abrirModalNovaCompensacao(alunoId = null) {
    if (window.compensacoesController) {
      window.compensacoesController.abrirModalNovaCompensacao(alunoId);
    }
  }

  aprovarCompensacao(id) {
    if (window.compensacoesController) {
      window.compensacoesController.aprovarCompensacao(id);
    }
  }

  homologarCompensacao(id) {
    if (window.compensacoesController) {
      window.compensacoesController.aprovarCompensacao(id);
    }
  }

  _bindEvents() {
    var ids = ['modalCoordenadorNovaTurma','modalCoordenadorCarregarTurma','modalCoordenadorPTD','modalAtribuirDocente','modalSolicitarFechamento'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function(e) {
          if (e.target === el) window.app.fecharModal(id);
        });
      }
    });
  }
}

window.coordenadorController = new CoordenadorController();
