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
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

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
  code: string;
  category: string;
  total: number;
  criteria1: number;
  criteria2: number;
  criteria3: number;
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

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#141414]/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setView('categories')}
          >
            <div className="w-8 h-8 bg-[#141414] rounded-lg flex items-center justify-center">
              <Camera className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold tracking-tight uppercase">PhotoJudge</h1>
          </div>
          
          <nav className="flex items-center gap-6">
            <button 
              onClick={() => setView('categories')}
              className={cn(
                "text-sm font-medium transition-colors",
                view === 'categories' ? "text-[#141414]" : "text-[#141414]/50 hover:text-[#141414]"
              )}
            >
              Categorias
            </button>
            <button 
              onClick={fetchResults}
              className={cn(
                "text-sm font-medium transition-colors",
                view === 'results' ? "text-[#141414]" : "text-[#141414]/50 hover:text-[#141414]"
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
                view === 'admin' ? "text-[#141414]" : "text-[#141414]/50 hover:text-[#141414]"
              )}
            >
              Atribuição
            </button>
            <div className="h-4 w-[1px] bg-[#141414]/10" />
            <div className="flex items-center gap-2 text-xs font-mono bg-[#141414]/5 px-3 py-1.5 rounded-full">
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
                    className="group relative bg-white p-8 rounded-2xl border border-[#141414]/10 hover:border-[#141414] transition-all text-left overflow-hidden"
                  >
                    <div className="relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-[#141414]/5 flex items-center justify-center mb-6 group-hover:bg-[#141414] group-hover:text-white transition-colors">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{cat.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-[#141414]/50">
                        <span>Ver inscrições pendentes</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Camera className="w-24 h-24" />
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
                  className="flex items-center gap-2 text-sm font-medium text-[#141414]/50 hover:text-[#141414] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para categorias
                </button>
                <div className="bg-[#141414] text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                  {selectedCategory.name}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/10 overflow-hidden">
                <div className="p-8 border-b border-[#141414]/10">
                  <h2 className="text-2xl font-bold">Inscrições Pendentes</h2>
                  <p className="text-[#141414]/50 text-sm mt-1">
                    {submissions.length} inscrições aguardando julgamento nesta categoria.
                  </p>
                </div>

                {loading ? (
                  <div className="p-20 flex flex-col items-center justify-center text-[#141414]/30">
                    <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mb-4" />
                    <p>Carregando inscrições...</p>
                  </div>
                ) : submissions.length > 0 ? (
                  <div className="divide-y divide-[#141414]/5">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="p-6 flex items-center justify-between hover:bg-[#141414]/[0.02] transition-colors">
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-full bg-[#141414]/5 flex items-center justify-center font-mono text-sm font-bold">
                            #{sub.id}
                          </div>
                          <div>
                            <div className="font-mono text-sm font-bold tracking-tighter text-[#141414]/40">
                              CÓDIGO: {sub.participant_code}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-xs text-[#141414]/60">
                                <ImageIcon className="w-3 h-3" /> 3 Imagens
                              </span>
                              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Clock className="w-3 h-3" /> Aguardando
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartJudging(sub)}
                          className="bg-[#141414] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#141414]/90 transition-colors flex items-center gap-2"
                        >
                          Julgar Agora
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 flex flex-col items-center justify-center text-[#141414]/30">
                    <CheckCircle2 className="w-12 h-12 mb-4" />
                    <p className="text-lg font-medium">Tudo pronto!</p>
                    <p className="text-sm">Não há mais inscrições pendentes nesta categoria.</p>
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
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#141414]/10">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#141414] text-white px-3 py-1 rounded-lg text-xs font-mono">
                      {currentSubmission.participant_code}
                    </div>
                    <h2 className="font-bold">{currentSubmission.category_name}</h2>
                  </div>
                  <button 
                    onClick={handleCancelJudging}
                    className="text-xs font-bold text-red-500 hover:underline"
                  >
                    CANCELAR JULGAMENTO
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {currentSubmission.images?.map((img, idx) => (
                    <div 
                      key={img.id} 
                      onClick={() => {
                        setSelectedImage(img.url);
                        setZoom(1);
                      }}
                      className="group relative bg-white p-2 rounded-3xl border border-[#141414]/10 overflow-hidden cursor-zoom-in hover:border-[#141414] transition-all"
                    >
                      <img 
                        src={img.url} 
                        alt={`Photo ${idx + 1}`}
                        className="w-full aspect-[4/3] object-cover rounded-2xl group-hover:scale-[1.02] transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        Imagem {idx + 1}
                      </div>
                      <div className="absolute inset-0 bg-[#141414]/0 group-hover:bg-[#141414]/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <div className="bg-white p-3 rounded-full shadow-xl">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Column */}
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-[#141414] shadow-2xl shadow-[#141414]/5 sticky top-24">
                  <div className="flex items-center gap-3 mb-8">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                    <h3 className="text-xl font-bold">Critérios de Avaliação</h3>
                  </div>

                  <form onSubmit={handleSubmitScores} className="space-y-8">
                    <div className="space-y-6">
                      {[
                        { id: 'criteria1', label: 'Composição e Técnica', desc: 'Uso de luz, enquadramento e foco.' },
                        { id: 'criteria2', label: 'Criatividade e Originalidade', desc: 'Perspectiva única e inovação.' },
                        { id: 'criteria3', label: 'Impacto e Narrativa', desc: 'Capacidade de contar uma história.' }
                      ].map((c) => (
                        <div key={c.id}>
                          <label className="block text-sm font-bold mb-1">{c.label}</label>
                          <p className="text-[10px] text-[#141414]/50 uppercase tracking-wider mb-3">{c.desc}</p>
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
                              className="w-full bg-[#141414]/5 border-2 border-transparent focus:border-[#141414] focus:bg-white rounded-xl px-4 py-3 outline-none transition-all font-mono font-bold"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#141414]/30">
                              PONTOS
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4">
                      <div className="bg-[#141414]/5 p-4 rounded-2xl mb-6 border border-dashed border-[#141414]/20">
                        <div className="flex items-center justify-between text-xs font-bold text-[#141414]/50 mb-1">
                          <span>MÉDIA FINAL</span>
                          <span>AUTO-CALCULADO</span>
                        </div>
                        <div className="text-3xl font-mono font-bold">
                          {((parseFloat(scores.criteria1) || 0) + (parseFloat(scores.criteria2) || 0) + (parseFloat(scores.criteria3) || 0) > 0) 
                            ? (((parseFloat(scores.criteria1) || 0) + (parseFloat(scores.criteria2) || 0) + (parseFloat(scores.criteria3) || 0)) / 3).toFixed(2)
                            : "0.00"
                          }
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold hover:bg-[#141414]/90 transition-all flex items-center justify-center gap-2"
                      >
                        Finalizar Avaliação
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Nota:</strong> Uma vez enviado, o julgamento não poderá ser alterado. Certifique-se de que as notas estão corretas.
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-serif italic">Classificação Geral</h2>
                  <p className="text-[#141414]/50 mt-2">Resultados consolidados por categoria.</p>
                </div>
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-amber-600" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/10 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414]/5 border-b border-[#141414]/10">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Posição</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Código</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Categoria</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">C1</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">C2</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">C3</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Média Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/5">
                    {results.length > 0 ? results.map((res, idx) => (
                      <tr key={res.id} className="hover:bg-[#141414]/[0.02] transition-colors">
                        <td className="p-6">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                            idx === 0 ? "bg-amber-100 text-amber-700" : 
                            idx === 1 ? "bg-slate-100 text-slate-700" :
                            idx === 2 ? "bg-orange-100 text-orange-700" : "bg-[#141414]/5 text-[#141414]/50"
                          )}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="p-6 font-mono font-bold text-sm">{res.code}</td>
                        <td className="p-6">
                          <span className="bg-[#141414]/5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            {res.category}
                          </span>
                        </td>
                        <td className="p-6 font-mono text-sm text-[#141414]/50">{res.criteria1.toFixed(2)}</td>
                        <td className="p-6 font-mono text-sm text-[#141414]/50">{res.criteria2.toFixed(2)}</td>
                        <td className="p-6 font-mono text-sm text-[#141414]/50">{res.criteria3.toFixed(2)}</td>
                        <td className="p-6">
                          <div className="font-mono font-bold text-lg">{res.total.toFixed(2)}</div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="p-20 text-center text-[#141414]/30">
                          <div className="flex flex-col items-center">
                            <Clock className="w-12 h-12 mb-4" />
                            <p className="text-lg font-medium">Nenhum resultado disponível</p>
                            <p className="text-sm">Os resultados aparecerão aqui após o julgamento das inscrições.</p>
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
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#141414]/10 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#141414]/5 border-b border-[#141414]/10">
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">ID</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Candidato</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Categoria</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Status</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Jurado Atribuído</th>
                      <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-[#141414]/50">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/5">
                    {adminSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#141414]/[0.02] transition-colors">
                        <td className="p-6 font-mono text-sm">#{sub.id}</td>
                        <td className="p-6 font-bold text-sm">{sub.participant_code}</td>
                        <td className="p-6 text-sm">{sub.category_name}</td>
                        <td className="p-6">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            sub.status === 'completed' ? "bg-green-100 text-green-700" :
                            sub.status === 'judging' ? "bg-blue-100 text-blue-700" :
                            sub.status === 'assigned' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {sub.status === 'completed' ? 'Concluído' :
                             sub.status === 'judging' ? 'Em Julgamento' :
                             sub.status === 'assigned' ? 'Atribuído' : 'Pendente'}
                          </span>
                        </td>
                        <td className="p-6">
                          {sub.assigned_judge_name ? (
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <User className="w-4 h-4 text-[#141414]/30" />
                              {sub.assigned_judge_name}
                            </div>
                          ) : (
                            <span className="text-sm text-[#141414]/30 italic">Não atribuído</span>
                          )}
                        </td>
                        <td className="p-6">
                          {sub.status !== 'completed' && sub.status !== 'judging' && (
                            <select 
                              className="bg-[#141414]/5 border-none rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-[#141414]/10"
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

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                <button 
                  onClick={() => setZoom(prev => Math.max(1, prev - 0.5))}
                  className="p-2 hover:bg-white/10 rounded-xl text-white transition-colors"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-300" 
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
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-[#141414]/10 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-30">
            <Camera className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Photo Contest Judging System v1.0</span>
          </div>
          <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-[#141414]/30">
            <span>Privacidade</span>
            <span>Termos</span>
            <span>Suporte</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
