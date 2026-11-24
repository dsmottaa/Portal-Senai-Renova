/**
 * =============================================================================
 * RENOVA SENAI - AUTENTICAÇÃO E SESSÃO (auth.js)
 * Login por CPF ou E-mail, Perfis de Coordenação, Professor, Aluno e Orientador
 * =============================================================================
 */

const SESSION_KEY = 'renova_senai_session';

class AuthService {
  constructor() {
    this.currentUser = this.loadSession();
  }

  loadSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  saveSession(user) {
    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  login(identificador, senha) {
    let clean = (identificador || '').trim().toLowerCase();
    if (!clean) {
      clean = 'mariana@senai.br';
    }

    // Busca usuário no banco local
    let usuario = window.db ? window.db.getUsuarioPorCpfOuEmail(clean) : null;

    // Se não encontrou usuário exato, mapeia inteligentemente pelo que foi digitado
    if (!usuario) {
      if (clean.includes('coord') || clean.includes('paulo') || clean.includes('guilia')) {
        usuario = window.db ? window.db.getUsuarioById(2) : null; // Guilia Portugal (Coordenação)
      } else if (clean.includes('mariana')) {
        usuario = window.db ? window.db.getUsuarioById(8) : null; // Mariana Silva Rocha
        if (!usuario) {
          usuario = {
            id: 8,
            nome: 'MARIANA SILVA ROCHA',
            email: 'mariana.silva@sp.senai.br',
            cpf: '333.444.555-66',
            perfil: 'PROFESSOR',
            matriculaFuncional: 'SENAI-DOC-2025-102'
          };
        }
      } else if (clean.includes('aluno') || clean.includes('pedro') || clean.includes('gabriel') || clean.includes('yasmin') || clean.includes('111.222.333-44')) {
        usuario = {
          id: 52,
          nome: 'Pedro Henrique',
          email: 'pedro.henrique@aluno.senai.br',
          cpf: '111.222.333-44',
          perfil: 'ALUNO',
          matriculaFuncional: 'SENAI-ALU-2026-052'
        };
      } else if (clean.includes('orientador')) {
        usuario = {
          id: 102,
          nome: 'DR. MARCELO NOGUEIRA',
          email: 'marcelo.orientador@sp.senai.br',
          cpf: '555.666.777-88',
          perfil: 'ORIENTADOR',
          matriculaFuncional: 'SENAI-ORI-2024-015'
        };
      } else {
        usuario = window.db ? window.db.getUsuarioById(1) : null; // Nathan Santana Matos (Docente)
        if (usuario) {
          if (clean.includes('@') && clean !== 'professor@senai.br') {
            usuario.email = clean;
          } else if (clean.replace(/\D/g, '').length >= 6) {
            usuario.cpf = identificador.trim();
          }
        }
      }
    }

    if (!usuario) {
      // Fallback padrão Mariana Silva Rocha garantido
      usuario = {
        id: 8,
        nome: 'MARIANA SILVA ROCHA',
        email: 'mariana.silva@sp.senai.br',
        cpf: '333.444.555-66',
        perfil: 'PROFESSOR',
        matriculaFuncional: 'SENAI-DOC-2025-102'
      };
    }

    const perfilInicial = (usuario.perfilAtivo || usuario.perfil || 'PROFESSOR').toUpperCase();
    const baseSession = {
      id: usuario.id,
      alunoId: usuario.alunoId || (perfilInicial === 'ALUNO' ? usuario.id : undefined),
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
      perfil: (usuario.perfil || perfilInicial).toUpperCase(),
      perfilAtivo: perfilInicial,
      cargo: usuario.cargo || this.getCargoPadraoPorPerfil(perfilInicial),
      unidade: usuario.unidade || 'SENAI – Unidade São Paulo',
      telefone: usuario.telefone || '(11) 99099-0000',
      matriculaFuncional: usuario.matriculaFuncional
    };

    this.currentUser = baseSession;
    const dadosIsolados = this.getDadosPerfilIsolado(perfilInicial);
    this.saveSession({ ...baseSession, ...dadosIsolados, perfilAtivo: perfilInicial });

    return this.currentUser;
  }

  getPerfilStorageKey(perfil) {
    const p = (perfil || this.getPerfilAtivo() || 'PROFESSOR').toUpperCase();
    return `renova_perfil_${p}`;
  }

  getCargoPadraoPorPerfil(perfil) {
    const p = (perfil || 'PROFESSOR').toUpperCase();
    return {
      PROFESSOR: 'Professor',
      COORDENACAO: 'Coordenador',
      ADMINISTRADOR: 'Coordenador',
      ORIENTADOR: 'Orientador',
      ALUNO: 'Aluno'
    }[p] || 'Professor';
  }

  getUsuarioBasePorPerfil(perfil) {
    const p = (perfil || 'PROFESSOR').toUpperCase();
    const usuarios = (window.db && window.db.data && window.db.data.usuarios) || [];

    if (this.currentUser && (this.currentUser.perfil || '').toUpperCase() === p) {
      return {
        ...this.currentUser,
        perfil: p,
        perfilAtivo: p,
        cargo: this.currentUser.cargo || this.getCargoPadraoPorPerfil(p),
        unidade: this.currentUser.unidade || 'SENAI – Unidade São Paulo',
        telefone: this.currentUser.telefone || '(11) 99099-0000'
      };
    }

    if (p === 'ALUNO') {
      const al = (window.db && window.db.getAlunoById && window.db.getAlunoById(52)) ||
        usuarios.find(u => (u.perfil || '').toUpperCase() === 'ALUNO');
      if (al) {
        return {
          id: al.id,
          alunoId: al.id,
          nome: al.nome || 'Pedro Henrique',
          email: al.email || 'pedro.henrique@aluno.senai.br',
          cpf: al.cpf || '111.222.333-44',
          perfil: 'ALUNO',
          perfilAtivo: 'ALUNO',
          cargo: 'Aluno',
          unidade: 'SENAI – Unidade São Paulo',
          telefone: '(11) 99099-0000',
          matriculaFuncional: al.ra || al.matriculaFuncional || 'RA2026052'
        };
      }
    }

    const match = usuarios.find(u => (u.perfil || '').toUpperCase() === p && (p !== 'PROFESSOR' || u.id === 8)) ||
      usuarios.find(u => (u.perfil || '').toUpperCase() === p);
    if (match) {
      return {
        id: match.id,
        nome: match.nome,
        email: match.email,
        cpf: match.cpf,
        perfil: p,
        perfilAtivo: p,
        cargo: match.cargo || this.getCargoPadraoPorPerfil(p),
        unidade: match.unidade || 'SENAI – Unidade São Paulo',
        telefone: match.telefone || '(11) 99099-0000',
        matriculaFuncional: match.matriculaFuncional
      };
    }

    const fallbacks = {
      PROFESSOR: { id: 8, nome: 'MARIANA SILVA ROCHA', email: 'mariana.silva@sp.senai.br', cpf: '333.444.555-66', matriculaFuncional: 'SENAI-DOC-2025-102' },
      COORDENACAO: { id: 2, nome: 'GUILIA PORTUGAL', email: 'coord.guilia@sp.senai.br', cpf: '987.654.321-11', matriculaFuncional: 'SENAI-ADM-2022-014' },
      ORIENTADOR: { id: 10, nome: 'CARLA BEATRIZ MENDES', email: 'orientador@senai.br', cpf: '555.666.777-88', matriculaFuncional: 'SENAI-ORI-2024-015' },
      ALUNO: { id: 52, alunoId: 52, nome: 'Pedro Henrique', email: 'pedro.henrique@aluno.senai.br', cpf: '111.222.333-44', matriculaFuncional: 'RA2026052' }
    };
    const fb = fallbacks[p] || fallbacks.PROFESSOR;
    return {
      ...fb,
      perfil: p,
      perfilAtivo: p,
      cargo: this.getCargoPadraoPorPerfil(p),
      unidade: 'SENAI – Unidade São Paulo',
      telefone: '(11) 99099-0000'
    };
  }

  getDadosPerfilIsolado(perfil) {
    const p = (perfil || this.getPerfilAtivo() || 'PROFESSOR').toUpperCase();
    const base = this.getUsuarioBasePorPerfil(p);
    let salvo = null;
    try {
      const raw = localStorage.getItem(this.getPerfilStorageKey(p));
      if (raw) salvo = JSON.parse(raw);
    } catch (e) {
      salvo = null;
    }
    return {
      ...base,
      ...(salvo || {}),
      perfil: p,
      perfilAtivo: p,
      cargo: (salvo && salvo.cargo) || base.cargo || this.getCargoPadraoPorPerfil(p),
      unidade: (salvo && salvo.unidade) || base.unidade || 'SENAI – Unidade São Paulo',
      telefone: (salvo && salvo.telefone) || base.telefone || '(11) 99099-0000'
    };
  }

  salvarPerfilIsolado(perfil, dados) {
    const p = (perfil || this.getPerfilAtivo() || 'PROFESSOR').toUpperCase();
    const atual = this.getDadosPerfilIsolado(p);
    const atualizado = {
      ...atual,
      ...dados,
      perfil: p,
      perfilAtivo: p
    };
    localStorage.setItem(this.getPerfilStorageKey(p), JSON.stringify({
      nome: atualizado.nome,
      email: atualizado.email,
      telefone: atualizado.telefone,
      cargo: atualizado.cargo,
      unidade: atualizado.unidade,
      cpf: atualizado.cpf,
      matriculaFuncional: atualizado.matriculaFuncional
    }));
    if (this.getPerfilAtivo() === p) {
      this.saveSession(atualizado);
    }
    return atualizado;
  }

  setPerfilAtivo(perfil) {
    const p = (perfil || 'PROFESSOR').toUpperCase();
    const dadosPerfil = this.getDadosPerfilIsolado(p);
    this.saveSession(dadosPerfil);
  }

  getPerfilAtivo() {
    return ((this.currentUser && this.currentUser.perfilAtivo) || (this.currentUser && this.currentUser.perfil) || 'PROFESSOR').toUpperCase();
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    if (!this.currentUser) return null;
    return this.getDadosPerfilIsolado(this.getPerfilAtivo());
  }

  isProfessor() {
    return this.getPerfilAtivo() === 'PROFESSOR';
  }

  isCoordenacao() {
    const p = this.getPerfilAtivo();
    return p === 'COORDENACAO' || p === 'ADMINISTRADOR';
  }

  isAluno() {
    return this.getPerfilAtivo() === 'ALUNO';
  }

  isOrientador() {
    return this.getPerfilAtivo() === 'ORIENTADOR';
  }
}

window.auth = new AuthService();
