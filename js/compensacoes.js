/**
 * =============================================================================
 * RENOVA SENAI - MÓDULO DE COMPENSAÇÕES (compensacoes.js)
 * Figma Oficial: Grid 2 colunas - Esquerda: Alunos <75% (tabela roxa), Direita: Form Registrar Compensação
 * =============================================================================
 */

class CompensacoesController {
  constructor() {
    this.filtroTipo = 'TODOS';
    this.turmaId = 1;
    this.ucId = 1;
    this.alunosBaixaFrequencia = [];
  }

  init() {
    if (window.app && window.app.turmaAtiva) {
      this.turmaId = window.app.turmaAtiva.id || 1;
      this.ucId = window.app.turmaAtiva.ucId || 1;
    }
    this.renderizar();
  }

  renderizar() {
    // Renderizar tabela da esquerda (alunos com frequência < 75%)
    this.renderizarAlunosBaixaFrequencia();
    
    // Popular selects do formulário da direita
    this.popularFormularioCompensacao();
  }

  renderizarAlunosBaixaFrequencia() {
    const tbody = document.querySelector('#compensacaoAlunosTable tbody');
    if (!tbody || !window.db) return;

    // Buscar síntese consolidada da turma e UC atual
    const sintese = window.db.getSinteseConsolidada(this.turmaId, this.ucId);
    let alunosCriticos = (sintese.alunos || []).filter(item => 
      item.aluno.statusMatricula === 'ATIVO' && item.freqPorcentagem < 75.0
    ).map(item => ({
      id: item.aluno.id,
      nome: item.aluno.nome,
      ra: item.aluno.ra,
      pct: item.freqPorcentagem,
      faltas: item.faltas
    }));

    // Se nenhum aluno estiver abaixo de 75% na UC atual, busca em todas as UCs da turma para garantir acompanhamento
    if (alunosCriticos.length === 0) {
      const ucs = window.db.getUCsPorTurma(this.turmaId);
      const mapCriticos = new Map();
      ucs.forEach(uc => {
        const s = window.db.getSinteseConsolidada(this.turmaId, uc.id);
        (s.alunos || []).forEach(item => {
          if (item.aluno.statusMatricula === 'ATIVO' && item.freqPorcentagem < 75.0) {
            if (!mapCriticos.has(item.aluno.id) || item.freqPorcentagem < mapCriticos.get(item.aluno.id).pct) {
              mapCriticos.set(item.aluno.id, {
                id: item.aluno.id,
                nome: item.aluno.nome,
                ra: item.aluno.ra,
                pct: item.freqPorcentagem,
                faltas: item.faltas
              });
            }
          }
        });
      });
      alunosCriticos = Array.from(mapCriticos.values());
    }

    this.alunosBaixaFrequencia = alunosCriticos;

    if (alunosCriticos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 24px; color: #16a34a; font-size: 13px;">
            ✅ Nenhum aluno da turma com frequência inferior a 75%.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = alunosCriticos.map((aluno, idx) => `
      <tr style="cursor: pointer;" onclick="window.compensacoesController.selecionarAlunoCompensacao(${aluno.id})">
        <td><strong>${idx + 1}</strong></td>
        <td>${aluno.nome}</td>
        <td style="text-align: center;">
          <span class="badge-situacao reprovado">${aluno.pct.toFixed(1)}%</span>
        </td>
      </tr>
    `).join('');
  }

  popularFormularioCompensacao() {
    const alunoSelect = document.getElementById('compAlunoSelect');
    const faltaSelect = document.getElementById('compFaltaSelect');
    const dataInput = document.getElementById('compDataInput');

    if (alunoSelect) {
      alunoSelect.innerHTML = '<option value="">Selecione o aluno...</option>' +
        this.alunosBaixaFrequencia.map(a => 
          `<option value="${a.id}">${a.nome} (${a.pct.toFixed(1)}%)</option>`
        ).join('');
      
      // Ao trocar de aluno, popula faltas reais
      alunoSelect.onchange = (e) => {
        this.carregarFaltasAluno(e.target.value);
      };
    }

    if (faltaSelect) {
      faltaSelect.innerHTML = '<option value="">Selecione primeiro o aluno...</option>';
    }

    if (dataInput) {
      const hoje = new Date().toISOString().split('T')[0];
      dataInput.value = hoje;
      dataInput.min = hoje;
    }
  }

  carregarFaltasAluno(alunoId) {
    const faltaSelect = document.getElementById('compFaltaSelect');
    if (!faltaSelect) return;

    if (!alunoId) {
      faltaSelect.innerHTML = '<option value="">Selecione primeiro o aluno...</option>';
      return;
    }

    const idNum = Number(alunoId);
    const aulas = (window.db && window.db.data.aulas) || [];
    const aulasTurma = aulas.filter(a => a.turmaId === Number(this.turmaId));

    const faltasEncontradas = [];
    aulasTurma.forEach(aula => {
      if (aula.frequencias && aula.frequencias[idNum]) {
        const qtdFaltas = aula.frequencias[idNum].filter(st => st === 'F').length;
        if (qtdFaltas > 0) {
          const uc = window.db.getUCById(aula.ucId);
          const ucNome = uc ? uc.nome : 'UC';
          faltasEncontradas.push({
            data: aula.data,
            qtd: qtdFaltas,
            ucNome,
            conteudo: aula.conteudoMinistrado || 'Aula regular'
          });
        }
      }
    });

    if (faltasEncontradas.length === 0) {
      faltaSelect.innerHTML = '<option value="Falta geral registrada">Falta geral registrada (4 aulas)</option>';
      return;
    }

    faltaSelect.innerHTML = '<option value="">Selecione a falta...</option>' +
      faltasEncontradas.map(f => 
        `<option value="${f.data}">Aula em ${f.data} (${f.qtd} falta${f.qtd > 1 ? 's' : ''}) - ${f.ucNome}</option>`
      ).join('');
  }

  selecionarAlunoCompensacao(alunoId) {
    const alunoSelect = document.getElementById('compAlunoSelect');
    if (alunoSelect) {
      alunoSelect.value = String(alunoId);
      this.carregarFaltasAluno(alunoId);
    }
  }

  limparFormCompensacao() {
    const form = document.getElementById('formRegistrarCompensacao');
    if (form) form.reset();
    this.popularFormularioCompensacao();
    window.app.mostrarToast('Formulário limpo.', 'info');
  }

  salvarCompensacaoForm() {
    const alunoIdVal = document.getElementById('compAlunoSelect')?.value;
    const faltaData = document.getElementById('compFaltaSelect')?.value;
    const data = document.getElementById('compDataInput')?.value;
    const obs = document.getElementById('compObsTextarea')?.value;

    if (!alunoIdVal) {
      window.app.mostrarToast('Selecione um aluno.', 'warning');
      return;
    }
    if (!faltaData) {
      window.app.mostrarToast('Selecione a falta a compensar.', 'warning');
      return;
    }
    if (!data) {
      window.app.mostrarToast('Informe a data da compensação.', 'warning');
      return;
    }
    if (!obs || obs.trim().length < 5) {
      window.app.mostrarToast('Descreva a atividade de reposição (mín. 5 caracteres).', 'warning');
      return;
    }

    const alunoIdReal = Number(alunoIdVal);
    const aluno = window.db.getAlunoById(alunoIdReal);

    // Converter as faltas da data selecionada de 'F' para 'J' (Justificada / Compensada)
    const aulas = (window.db && window.db.data.aulas) || [];
    let convertidas = 0;
    aulas.forEach(aula => {
      if (aula.turmaId === Number(this.turmaId) && aula.frequencias && aula.frequencias[alunoIdReal]) {
        if (!faltaData || aula.data === faltaData || faltaData === 'Falta geral registrada' || faltaData.includes(aula.data)) {
          aula.frequencias[alunoIdReal] = aula.frequencias[alunoIdReal].map(status => {
            if (status === 'F') {
              convertidas++;
              return 'J';
            }
            return status;
          });
        }
      }
    });

    // Fallback: se não encontrou pela data exata, compensa na primeira aula com falta
    if (convertidas === 0) {
      for (let i = 0; i < aulas.length; i++) {
        const aula = aulas[i];
        if (aula.turmaId === Number(this.turmaId) && aula.frequencias && aula.frequencias[alunoIdReal]) {
          if (aula.frequencias[alunoIdReal].includes('F')) {
            aula.frequencias[alunoIdReal] = aula.frequencias[alunoIdReal].map(s => s === 'F' ? 'J' : s);
            convertidas++;
            break;
          }
        }
      }
    }

    // Salvar no banco central via window.db com status HOMOLOGADO
    window.db.addCompensacao({
      alunoId: alunoIdReal,
      alunoNome: aluno ? aluno.nome : 'Aluno',
      turmaId: this.turmaId,
      horasObrigacao: 4,
      dataLimite: data,
      motivoOrigem: `Compensação de falta: Aula de ${faltaData}`,
      atividadeDescricao: obs,
      tipoOrigem: 'FALTAS',
      status: 'HOMOLOGADO'
    });

    if (window.db && typeof window.db.adicionarNotificacao === 'function') {
      window.db.adicionarNotificacao(
        'INFO',
        `Compensação de Falta • ${aluno ? aluno.nome : 'Aluno'}`,
        `Atividade de reposição homologada. Faltas convertidas em compensadas (J) com recálculo imediato de presença.`,
        'Docente Responsável'
      );
    }

    if (window.db && window.db.persist) {
      window.db.persist();
    }
    window.dispatchEvent(new CustomEvent('renova:db-updated'));

    // Sincronizar demais controllers
    if (window.diarioController && typeof window.diarioController.init === 'function') {
      window.diarioController.init();
    }
    if (window.sinteseController && typeof window.sinteseController.renderizar === 'function') {
      window.sinteseController.renderizar();
    }
    if (window.app && typeof window.app.renderizarNotasAluno === 'function') {
      window.app.renderizarNotasAluno();
    }

    this.limparFormCompensacao();
    this.renderizar();
    window.app.mostrarToast(`Compensação registrada! Faltas convertidas em presença compensada (J) e % recalculado.`, 'success');
  }

  // Métodos de Modais e Homologação de Compensação
  abrirModalRegistrarCompensacao(id) {
    const inputId = document.getElementById('inputCompensacaoId');
    const textRelato = document.getElementById('textCompensacaoRelato');
    if (inputId) inputId.value = id || '';
    if (textRelato) textRelato.value = '';
    if (window.app && typeof window.app.abrirModal === 'function') {
      window.app.abrirModal('modalRegistrarCompensacao');
    }
  }

  salvarCumprimento() {
    const inputId = document.getElementById('inputCompensacaoId');
    const compId = inputId ? Number(inputId.value) : null;
    const relato = (document.getElementById('textCompensacaoRelato')?.value || '').trim();

    if (!compId) {
      if (window.app) window.app.mostrarToast('ID de compensação inválido.', 'error');
      return;
    }

    if (window.db) {
      const compensacoes = window.db.data.compensacoes || [];
      const comp = compensacoes.find(c => Number(c.id) === compId);
      if (comp) {
        comp.status = 'CUMPRIDO';
        comp.homologado = true;
        comp.dataHomologacao = new Date().toISOString();
        comp.relato = relato || 'Compensação de falta homologada.';

        // Converter eventuais faltas do aluno em 'J'
        const aulas = window.db.data.aulas || [];
        aulas.forEach(aula => {
          if (aula.turmaId === Number(comp.turmaId) && aula.frequencias && aula.frequencias[comp.alunoId]) {
            aula.frequencias[comp.alunoId] = aula.frequencias[comp.alunoId].map(st => st === 'F' ? 'J' : st);
          }
        });

        if (typeof window.db.persist === 'function') {
          window.db.persist();
        }
      }
    }

    window.dispatchEvent(new CustomEvent('renova:db-updated'));
    if (window.app && typeof window.app.fecharModal === 'function') {
      window.app.fecharModal('modalRegistrarCompensacao');
    }
    if (window.portalOrientadorController && typeof window.portalOrientadorController.renderCompensacoes === 'function') {
      window.portalOrientadorController.renderCompensacoes();
    }
    if (window.sinteseController && typeof window.sinteseController.renderizar === 'function') {
      window.sinteseController.renderizar();
    }
    if (window.app) {
      window.app.mostrarToast('Compensação homologada e status atualizado com sucesso!', 'success');
    }
  }

  abrirModalNovaCompensacao(alunoId = null) {
    const select = document.getElementById('selectNovaCompensacaoAluno');
    const horasInput = document.getElementById('inputNovaCompensacaoHoras');
    const dataLimiteInput = document.getElementById('inputNovaCompensacaoDataLimite');
    const motivoInput = document.getElementById('inputNovaCompensacaoMotivo');
    const descTextarea = document.getElementById('textNovaCompensacaoDescricao');

    if (select && window.db) {
      const alunos = window.db.getAlunosPorTurma ? window.db.getAlunosPorTurma(this.turmaId) : (window.db.data.alunos || []);
      select.innerHTML = '<option value="">Selecione o aluno...</option>' +
        alunos.filter(a => a.statusMatricula === 'ATIVO').map(a => `<option value="${a.id}">${a.nome} (RA: ${a.ra || a.id})</option>`).join('');
      if (alunoId) {
        select.value = String(alunoId);
      }
    }

    if (horasInput) horasInput.value = '2';
    if (dataLimiteInput) {
      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      dataLimiteInput.value = em7dias;
    }
    if (motivoInput) motivoInput.value = 'Reposição de conteúdo prático e atividades em atraso';
    if (descTextarea) descTextarea.value = '';

    if (window.app && typeof window.app.abrirModal === 'function') {
      window.app.abrirModal('modalNovaCompensacao');
    }
  }

  salvarNovaCompensacao() {
    const alunoIdVal = document.getElementById('selectNovaCompensacaoAluno')?.value;
    const horasVal = document.getElementById('inputNovaCompensacaoHoras')?.value;
    const dataLimiteVal = document.getElementById('inputNovaCompensacaoDataLimite')?.value;
    const motivoVal = document.getElementById('inputNovaCompensacaoMotivo')?.value;
    const descVal = document.getElementById('textNovaCompensacaoDescricao')?.value;

    if (!alunoIdVal) {
      if (window.app) window.app.mostrarToast('Selecione um aluno.', 'warning');
      return;
    }
    if (!horasVal || Number(horasVal) <= 0) {
      if (window.app) window.app.mostrarToast('Informe a quantidade de horas a compensar.', 'warning');
      return;
    }
    if (!dataLimiteVal) {
      if (window.app) window.app.mostrarToast('Informe o prazo limite.', 'warning');
      return;
    }

    const alunoId = Number(alunoIdVal);
    const aluno = window.db ? window.db.getAlunoById(alunoId) : null;

    if (window.db && typeof window.db.addCompensacao === 'function') {
      window.db.addCompensacao({
        alunoId: alunoId,
        alunoNome: aluno ? aluno.nome : 'Aluno',
        turmaId: this.turmaId,
        horasObrigacao: Number(horasVal),
        dataLimite: dataLimiteVal,
        motivoOrigem: motivoVal || 'Compensação de falta / ausência',
        atividadeDescricao: descVal || 'Atividade de reposição',
        tipoOrigem: 'FALTAS',
        status: 'PENDENTE'
      });
      if (window.db.persist) window.db.persist();
    }

    window.dispatchEvent(new CustomEvent('renova:db-updated'));
    if (window.app && typeof window.app.fecharModal === 'function') {
      window.app.fecharModal('modalNovaCompensacao');
    }
    if (window.portalOrientadorController && typeof window.portalOrientadorController.renderCompensacoes === 'function') {
      window.portalOrientadorController.renderCompensacoes();
    }
    if (window.app) {
      window.app.mostrarToast('Compensação agendada e registrada com sucesso!', 'success');
    }
  }

  aprovarCompensacao(id) {
    const compId = Number(id);
    if (!compId || !window.db) return;
    const compensacoes = window.db.data.compensacoes || [];
    const comp = compensacoes.find(c => Number(c.id) === compId);
    if (comp) {
      comp.status = 'CUMPRIDO';
      comp.homologado = true;
      comp.dataHomologacao = new Date().toISOString();
      if (window.db.persist) window.db.persist();
      window.dispatchEvent(new CustomEvent('renova:db-updated'));
      if (window.app) window.app.mostrarToast(`Compensação #${compId} homologada com sucesso.`, 'success');
      if (window.portalOrientadorController && typeof window.portalOrientadorController.renderCompensacoes === 'function') {
        window.portalOrientadorController.renderCompensacoes();
      }
    }
  }

  // Métodos legados para compatibilidade
  renderizarFiltros() {}
  setFiltro(tipo) {}
  carregarAlunosParaModalCompensacao() {}
}

window.compensacoesController = new CompensacoesController();
