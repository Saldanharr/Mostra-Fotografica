import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Camera, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Trophy, 
  User, 
  Image as ImageIcon,
  ArrowLeft,
  Star,
  AlertCircle,
  Settings,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';

// Types
interface Category {
  id: number;
  name: string;
}

interface Submission {
  id: number;
  participant_id: number;
  category_id: number;
  status: 'pending' | 'judging' | 'completed' | 'assigned';
  participant_code: string;
  category_name?: string;
  assigned_judge_name?: string;
  images?: { id: number; url: string }[];
}

interface Judge {
  id: number;
  name: string;
}

interface Result {
  id: number;
  participant_name: string;
  code: string;
  category: string;
  total: number;
  criteria1: number;
  criteria2: number;
  criteria3: number;
  judge_name?: string;
  judge_code?: string;
}

const JUDGE_ID = `judge_${Math.random().toString(36).substring(2, 9)}`;

export default function App() {
  const [view, setView] = useState<'categories' | 'submissions' | 'judging' | 'results' | 'admin'>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [adminSubmissions, setAdminSubmissions] = useState<Submission[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [scores, setScores] = useState({ criteria1: '', criteria2: '', criteria3: '' });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    fetchCategories();
    fetchJudges();

    newSocket.on('submission_locked', ({ submissionId }) => {
      setSubmissions(prev => prev.filter(s => s.id !== parseInt(submissionId)));
    });

    newSocket.on('submission_completed', ({ submissionId }) => {
      setSubmissions(prev => prev.filter(s => s.id !== parseInt(submissionId)));
    });

    newSocket.on('submission_unlocked', ({ submissionId }) => {
      // Refresh if we are in the submissions view for that category
      if (selectedCategory) {
        fetchSubmissions(selectedCategory.id);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data);
  };

  const fetchJudges = async () => {
    const res = await fetch('/api/judges');
    const data = await res.json();
    setJudges(data);
  };

  const fetchAdminSubmissions = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/submissions');
    const data = await res.json();
    setAdminSubmissions(data);
    setLoading(false);
  };

  const fetchSubmissions = async (categoryId: number) => {
    setLoading(true);
    const res = await fetch(`/api/submissions/pending/${categoryId}`);
    const data = await res.json();
    setSubmissions(data);
    setLoading(false);
  };

  const fetchResults = async () => {
    const res = await fetch('/api/results');
    const data = await res.json();
    setResults(data);
    setView('results');
  };

  const handleExportExcel = () => {
    const exportData = filteredAndSortedResults.map((res, idx) => ({
      'Classificação': idx + 1,
      'Nome do Candidato': res.participant_name,
      'Código do Candidato': res.code,
      'Categoria': res.category,
      'Julgador': res.judge_name || 'Não Atribuído',
      'Nota C1': res.criteria1,
      'Nota C2': res.criteria2,
      'Nota C3': res.criteria3,
      'Média Final': res.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
    
    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Resultados_Concurso_Foto_${date}.xlsx`);
  };

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    fetchSubmissions(category.id);
    setView('submissions');
  };

  const handleAssignJudge = async (submissionId: number, judgeId: number) => {
    const res = await fetch('/api/admin/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, judgeId })
    });

    if (res.ok) {
      fetchAdminSubmissions();
    }
  };

  const handleStartJudging = async (submission: Submission) => {
    const res = await fetch(`/api/submissions/${submission.id}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgeId: JUDGE_ID })
    });

    if (res.ok) {
      const fullSubRes = await fetch(`/api/submissions/${submission.id}`);
      const fullSub = await fullSubRes.json();
      setCurrentSubmission(fullSub);
      setView('judging');
      setScores({ criteria1: '', criteria2: '', criteria3: '' });
    } else {
      alert('Esta inscrição já está sendo julgada por outro jurado.');
      fetchSubmissions(selectedCategory!.id);
    }
  };

  const handleCancelJudging = async () => {
    if (currentSubmission) {
      await fetch(`/api/submissions/${currentSubmission.id}/unlock`, { method: 'POST' });
      setCurrentSubmission(null);
      setView('submissions');
    }
  };

  const handleSubmitScores = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSubmission) return;

    const res = await fetch(`/api/submissions/${currentSubmission.id}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scores)
    });

    if (res.ok) {
      setCurrentSubmission(null);
      setView('submissions');
      fetchSubmissions(selectedCategory!.id);
    }
  };

  const filteredAndSortedResults = results
    .filter(res => filterCategory === 'all' || res.category === filterCategory)
    .sort((a, b) => {
      if (sortOrder === 'desc') return b.total - a.total;
      return a.total - b.total;
    });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#141414] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-brand-blue/10 sticky top-0 z-50 backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setView('categories')}
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-brand-blue via-brand-green to-brand-orange rounded-xl flex items-center justify-center shadow-lg shadow-brand-blue/20 group-hover:scale-110 transition-transform">
              <Camera className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">CONCURSO FOTOGRÁFICO</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange">Painel de Julgamento</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-6">
            <button 
              onClick={() => setView('categories')}
              className={cn(
                "text-sm font-medium transition-colors",
                view === 'categories' ? "text-brand-blue" : "text-[#141414]/50 hover:text-brand-blue"
              )}
            >
              Categorias
            </button>
            <button 
              onClick={fetchResults}
              className={cn(
                "text-sm font-medium transition-colors",
                view === 'results' ? "text-brand-blue" : "text-[#141414]/50 hover:text-brand-blue"
              )}
            >
              Resultados
            </button>
            <button 
              onClick={() => {
                fetchAdminSubmissions();
                setView('admin');
              }}
              className={cn(
                "text-sm font-medium transition-colors",
                view === 'admin' ? "text-brand-blue" : "text-[#141414]/50 hover:text-brand-blue"
              )}
            >
              Atribuição
            </button>
            <div className="h-4 w-[1px] bg-[#141414]/10" />
            <div className="flex items-center gap-2 text-xs font-mono bg-brand-blue/5 text-brand-blue px-3 py-1.5 rounded-full border border-brand-blue/10">
              <User className="w-3 h-3" />
              <span>{JUDGE_ID}</span>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Categories View */}
          {view === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="max-w-2xl">
                <h2 className="text-4xl font-serif italic mb-4">Painel do Jurado</h2>
                <p className="text-[#141414]/60 text-lg">
                  Selecione uma categoria para iniciar o processo de julgamento anônimo.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat)}
                    className="group relative bg-white p-8 rounded-3xl border border-brand-blue/10 hover:border-brand-blue transition-all text-left overflow-hidden shadow-sm hover:shadow-xl hover:shadow-brand-blue/5"
                  >
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-brand-blue/5 flex items-center justify-center mb-6 group-hover:bg-brand-blue group-hover:text-white transition-all">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">{cat.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-brand-blue font-bold uppercase tracking-widest">
                        <span>Ver inscrições</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                      <Camera className="w-32 h-32" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Submissions List View */}
          {view === 'submissions' && selectedCategory && (
            <motion.div
              key="submissions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('categories')}
                  className="flex items-center gap-2 text-sm font-bold text-brand-blue hover:text-brand-blue/70 transition-colors uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>
                <div className="bg-gradient-to-r from-brand-blue to-brand-green text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-lg shadow-brand-blue/20">
                  {selectedCategory.name}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-brand-blue/10 overflow-hidden shadow-sm">
                <div className="p-10 border-b border-brand-blue/10 bg-brand-blue/[0.02]">
                  <h2 className="text-3xl font-bold">Inscrições Pendentes</h2>
                  <p className="text-brand-blue/50 text-sm mt-2 font-medium">
                    {submissions.length} inscrições aguardando julgamento nesta categoria.
                  </p>
                </div>

                {loading ? (
                  <div className="p-20 flex flex-col items-center justify-center text-brand-blue/30">
                    <div className="w-10 h-10 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mb-4" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Carregando...</p>
                  </div>
                ) : submissions.length > 0 ? (
                  <div className="divide-y divide-brand-blue/5">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="p-8 flex items-center justify-between hover:bg-brand-blue/[0.01] transition-colors">
                        <div className="flex items-center gap-8">
                          <div className="w-14 h-14 rounded-2xl bg-brand-blue/5 text-brand-blue flex items-center justify-center font-mono text-lg font-bold border border-brand-blue/10">
                            #{sub.id}
                          </div>
                          <div>
                            <div className="font-mono text-sm font-bold tracking-tighter text-brand-blue">
                              CÓDIGO: {sub.participant_code}
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-[#141414]/40 uppercase tracking-widest">
                                <ImageIcon className="w-3.5 h-3.5" /> 3 Imagens
                              </span>
                              <span className="flex items-center gap-1.5 text-xs text-brand-orange font-bold uppercase tracking-widest">
                                <Clock className="w-3.5 h-3.5" /> Aguardando
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartJudging(sub)}
                          className="bg-brand-blue text-white px-8 py-3.5 rounded-2xl text-sm font-bold hover:bg-brand-blue/90 transition-all shadow-lg shadow-brand-blue/20 flex items-center gap-2 hover:scale-105 active:scale-95"
                        >
                          Julgar Agora
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-24 flex flex-col items-center justify-center text-brand-blue/20">
                    <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 className="w-10 h-10 text-brand-green" />
                    </div>
                    <p className="text-2xl font-bold text-brand-blue">Tudo pronto!</p>
                    <p className="text-sm font-medium mt-2">Não há mais inscrições pendentes nesta categoria.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Judging View */}
          {view === 'judging' && currentSubmission && (
            <motion.div
              key="judging"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Images Column */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-brand-blue/10 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-brand-blue text-white px-4 py-1.5 rounded-xl text-xs font-mono font-bold shadow-md shadow-brand-blue/20">
                      {currentSubmission.participant_code}
                    </div>
                    <h2 className="font-bold text-lg">{currentSubmission.category_name}</h2>
                  </div>
                  <button 
                    onClick={handleCancelJudging}
                    className="text-xs font-bold text-brand-orange hover:text-brand-orange/70 transition-colors uppercase tracking-widest"
                  >
                    Cancelar Julgamento
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {currentSubmission.images?.map((img, idx) => (
                    <div 
                      key={img.id} 
                      onClick={() => {
                        setSelectedImage(img.url);
                        setZoom(1);
                      }}
                      className="group relative bg-white p-3 rounded-[2.5rem] border border-brand-blue/10 overflow-hidden cursor-zoom-in hover:border-brand-blue transition-all shadow-sm hover:shadow-2xl hover:shadow-brand-blue/10"
                    >
                      <img 
                        src={img.url} 
                        alt={`Photo ${idx + 1}`}
                        className="w-full aspect-[4/3] object-cover rounded-[2rem] group-hover:scale-[1.02] transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-8 left-8 bg-brand-blue/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg">
                        Imagem {idx + 1}
                      </div>
                      <div className="absolute inset-0 bg-brand-blue/0 group-hover:bg-brand-blue/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <div className="bg-white p-4 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                          <Maximize2 className="w-6 h-6 text-brand-blue" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Column */}
              <div className="space-y-6">
                <div className="bg-white p-10 rounded-[2.5rem] border border-brand-blue/10 shadow-2xl shadow-brand-blue/5 sticky top-24">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-brand-orange/10 rounded-2xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-brand-orange fill-brand-orange" />
                    </div>
                    <h3 className="text-2xl font-bold">Avaliação</h3>
                  </div>

                  <form onSubmit={handleSubmitScores} className="space-y-10">
                    <div className="space-y-8">
                      {[
                        { id: 'criteria1', label: 'Composição e Técnica', desc: 'Uso de luz, enquadramento e foco.' },
                        { id: 'criteria2', label: 'Criatividade e Originalidade', desc: 'Perspectiva única e inovação.' },
                        { id: 'criteria3', label: 'Impacto e Narrativa', desc: 'Capacidade de contar uma história.' }
                      ].map((c) => (
                        <div key={c.id}>
                          <label className="block text-sm font-bold mb-1.5 text-brand-blue">{c.label}</label>
                          <p className="text-[10px] text-brand-blue/40 font-bold uppercase tracking-widest mb-4">{c.desc}</p>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              max="10"
                              required
                              value={scores[c.id as keyof typeof scores]}
                              onChange={(e) => setScores(prev => ({ ...prev, [c.id]: e.target.value }))}
                              placeholder="1.00 - 10.00"
                              className="w-full bg-brand-blue/5 border-2 border-transparent focus:border-brand-blue focus:bg-white rounded-2xl px-5 py-4 outline-none transition-all font-mono font-bold text-lg text-brand-blue"
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-blue/30 tracking-widest">
                              PONTOS
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-6">
                      <div className="bg-brand-blue/5 p-6 rounded-2xl mb-8 border border-dashed border-brand-blue/20">
                        <div className="flex items-center justify-between text-[10px] font-bold text-brand-blue/40 mb-2 tracking-[0.2em]">
                          <span>MÉDIA FINAL</span>
                          <span>AUTO-CALCULADO</span>
                        </div>
                        <div className="text-4xl font-mono font-bold text-brand-blue">
                          {((parseFloat(scores.criteria1) || 0) + (parseFloat(scores.criteria2) || 0) + (parseFloat(scores.criteria3) || 0) > 0) 
                            ? (((parseFloat(scores.criteria1) || 0) + (parseFloat(scores.criteria2) || 0) + (parseFloat(scores.criteria3) || 0)) / 3).toFixed(2)
                            : "0.00"
                          }
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-blue text-white py-5 rounded-2xl font-bold hover:bg-brand-blue/90 transition-all shadow-xl shadow-brand-blue/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95"
                      >
                        Finalizar Avaliação
                        <CheckCircle2 className="w-6 h-6" />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-brand-orange/5 border border-brand-orange/20 p-6 rounded-3xl flex gap-4">
                  <AlertCircle className="w-6 h-6 text-brand-orange shrink-0" />
                  <p className="text-xs text-brand-orange/80 font-medium leading-relaxed">
                    <strong>Atenção:</strong> Uma vez enviado, o julgamento não poderá ser alterado. Certifique-se de que as notas estão corretas.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Results View */}
          {view === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-serif italic">Classificação Geral</h2>
                  <p className="text-[#141414]/50 mt-2">Resultados consolidados por categoria.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-blue/10">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/40">Categoria:</span>
                    <select 
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold outline-none cursor-pointer text-brand-blue"
                    >
                      <option value="all">Todas as Categorias</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-brand-blue/10 hover:border-brand-blue transition-all"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/40">Ordem:</span>
                    <span className="text-sm font-bold text-brand-blue">{sortOrder === 'desc' ? 'Maior Nota' : 'Menor Nota'}</span>
                    <Trophy className={cn("w-4 h-4 text-brand-orange", sortOrder === 'asc' && "rotate-180")} />
                  </button>

                  <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-brand-green text-white px-6 py-2 rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-bold">Exportar Excel</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-brand-blue/10 overflow-hidden shadow-xl shadow-brand-blue/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-blue/5 border-b border-brand-blue/10">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Posição</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Candidato</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Categoria</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Julgador</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">C1</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">C2</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">C3</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Média Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {filteredAndSortedResults.length > 0 ? filteredAndSortedResults.map((res, idx) => (
                      <tr key={res.id} className="hover:bg-brand-blue/[0.02] transition-colors">
                        <td className="p-6">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm",
                            idx === 0 && filterCategory !== 'all' ? "bg-brand-orange text-white shadow-brand-orange/20" : 
                            idx === 1 && filterCategory !== 'all' ? "bg-slate-400 text-white shadow-slate-400/20" :
                            idx === 2 && filterCategory !== 'all' ? "bg-orange-400 text-white shadow-orange-400/20" : "bg-brand-blue/5 text-brand-blue/50"
                          )}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#141414]">{res.participant_name}</span>
                            <span className="text-[10px] font-mono text-[#141414]/30">{res.code}</span>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="bg-[#141414]/5 text-[#141414] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-[#141414]/10">
                            {res.category}
                          </span>
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#141414]">{res.judge_name || 'Não Atribuído'}</span>
                            <span className="text-[10px] font-mono text-[#141414]/30">{res.judge_code}</span>
                          </div>
                        </td>
                        <td className="p-6 font-mono text-sm text-brand-blue font-bold">{res.criteria1.toFixed(2)}</td>
                        <td className="p-6 font-mono text-sm text-brand-blue font-bold">{res.criteria2.toFixed(2)}</td>
                        <td className="p-6 font-mono text-sm text-brand-blue font-bold">{res.criteria3.toFixed(2)}</td>
                        <td className="p-6">
                          <div className="font-mono font-bold text-xl text-brand-blue">{res.total.toFixed(2)}</div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="p-24 text-center text-brand-blue/20">
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-brand-blue/5 rounded-full flex items-center justify-center mb-6">
                              <Clock className="w-8 h-8" />
                            </div>
                            <p className="text-xl font-bold text-brand-blue">Nenhum resultado disponível</p>
                            <p className="text-sm font-medium mt-2">Os resultados aparecerão aqui após o julgamento das inscrições.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Admin View */}
          {view === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-serif italic">Atribuição de Jurados</h2>
                  <p className="text-[#141414]/50 mt-2">Gerencie qual jurado é responsável por cada inscrição.</p>
                </div>
                <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-brand-blue" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-brand-blue/10 overflow-hidden shadow-xl shadow-brand-blue/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-blue/5 border-b border-brand-blue/10">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">ID</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Candidato</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Categoria</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Status</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Jurado Atribuído</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-brand-blue/50">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {adminSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-brand-blue/[0.02] transition-colors">
                        <td className="p-6 font-mono text-sm text-brand-blue/60">#{sub.id}</td>
                        <td className="p-6 font-bold text-sm text-brand-blue">{sub.participant_code}</td>
                        <td className="p-6 text-sm">{sub.category_name}</td>
                        <td className="p-6">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                            sub.status === 'completed' ? "bg-brand-green/10 text-brand-green border-brand-green/20" :
                            sub.status === 'judging' ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20" :
                            sub.status === 'assigned' ? "bg-brand-orange/10 text-brand-orange border-brand-orange/20" : "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {sub.status === 'completed' ? 'Concluído' :
                             sub.status === 'judging' ? 'Em Julgamento' :
                             sub.status === 'assigned' ? 'Atribuído' : 'Pendente'}
                          </span>
                        </td>
                        <td className="p-6">
                          {sub.assigned_judge_name ? (
                            <div className="flex items-center gap-2 text-sm font-medium text-brand-blue">
                              <User className="w-4 h-4 text-brand-blue/30" />
                              {sub.assigned_judge_name}
                            </div>
                          ) : (
                            <span className="text-sm text-[#141414]/30 italic">Não atribuído</span>
                          )}
                        </td>
                        <td className="p-6">
                          {sub.status !== 'completed' && sub.status !== 'judging' && (
                            <select 
                              className="bg-brand-blue/5 border-brand-blue/10 border rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-brand-blue/20 text-brand-blue"
                              onChange={(e) => handleAssignJudge(sub.id, parseInt(e.target.value))}
                              defaultValue=""
                            >
                              <option value="" disabled>Atribuir Jurado...</option>
                              {judges.map(j => (
                                <option key={j.id} value={j.id}>{j.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Zoom Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#141414]/95 backdrop-blur-sm p-4 md:p-12"
            >
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-6 right-6 z-10 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors"
                onClick={() => setSelectedImage(null)}
              >
                <X className="w-6 h-6" />
              </motion.button>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-brand-blue/20 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                <button 
                  onClick={() => setZoom(prev => Math.max(1, prev - 0.5))}
                  className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-green transition-all duration-300" 
                    style={{ width: `${((zoom - 1) / 4) * 100}%` }}
                  />
                </div>
                <button 
                  onClick={() => setZoom(prev => Math.min(5, prev + 0.5))}
                  className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <div className="h-4 w-[1px] bg-white/20 mx-1" />
                <span className="text-[10px] font-mono font-bold text-white w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-full h-full flex items-center justify-center overflow-auto cursor-grab active:cursor-grabbing"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelectedImage(null);
                }}
              >
                <div 
                  className="transition-transform duration-300 ease-out"
                  style={{ transform: `scale(${zoom})` }}
                >
                  <img
                    src={selectedImage}
                    alt="Zoomed view"
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                    referrerPolicy="no-referrer"
                    onDoubleClick={() => setZoom(prev => prev === 1 ? 2.5 : 1)}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-16 border-t border-brand-blue/10 mt-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3 opacity-40 grayscale hover:grayscale-0 transition-all cursor-default">
            <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue">Photo Contest Judging System v1.0</span>
          </div>
          <div className="flex items-center gap-10 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-blue/30">
            <span className="hover:text-brand-blue transition-colors cursor-pointer">Privacidade</span>
            <span className="hover:text-brand-blue transition-colors cursor-pointer">Termos</span>
            <span className="hover:text-brand-blue transition-colors cursor-pointer">Suporte</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
