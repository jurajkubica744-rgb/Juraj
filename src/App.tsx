import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shuffle, 
  RotateCcw, 
  Copy, 
  CheckCircle2, 
  Shield, 
  Sword, 
  Goal,
  ChevronRight,
  Plus,
  LayoutGrid,
  ClipboardList,
  UserCheck,
  Zap,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Player, GamePlayer, Position, WebSocketMessage } from './types';

const POSITION_LABELS: Record<Position, string> = {
  forward: 'Útočník',
  defense: 'Obranca',
  goalie: 'Brankár'
};

const POSITION_ICONS: Record<Position, React.ReactNode> = {
  forward: <Sword className="w-4 h-4" />,
  defense: <Shield className="w-4 h-4" />,
  goalie: <Goal className="w-4 h-4" />
};

export default function App() {
  const [regulars, setRegulars] = useState<Player[]>([]);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState<Position>('forward');
  const [loading, setLoading] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [playersRes, gameRes] = await Promise.all([
        fetch('/api/players'),
        fetch('/api/current-game')
      ]);
      const playersData = await playersRes.json();
      const gameData = await gameRes.json();
      setRegulars(playersData);
      setGamePlayers(gameData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      switch (message.type) {
        case 'SIGNUP_UPDATE':
          setGamePlayers(prev => {
            const exists = prev.find(p => p.id === message.data.id);
            if (exists) return prev;
            return [...prev, message.data];
          });
          break;
        case 'SIGNUP_REMOVED':
          setGamePlayers(prev => prev.filter(p => p.id !== (message as any).id));
          break;
        case 'TEAMS_UPDATED':
        case 'GAME_RESET':
          fetchData();
          break;
      }
    };

    return () => socket.close();
  }, [fetchData]);

  const addRegular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, position: newPosition }),
      });
      const newPlayer = await res.json();
      setRegulars(prev => [...prev, newPlayer]);
      setNewName('');
    } catch (error) {
      console.error('Error adding player:', error);
    }
  };

  const signUp = async (player: { name: string, position: Position }) => {
    if (gamePlayers.length >= 22) {
      alert('Maximálny počet hráčov (22) bol dosiahnutý.');
      return;
    }
    try {
      const res = await fetch('/api/current-game/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: player.name, position: player.position }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error);
      }
    } catch (error) {
      console.error('Error signing up:', error);
    }
  };

  const removeSignUp = async (id: number) => {
    try {
      await fetch('/api/current-game/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error('Error removing signup:', error);
    }
  };

  const resetGame = async () => {
    if (!confirm('Naozaj chcete vymazať zoznam na tento týždeň?')) return;
    try {
      await fetch('/api/current-game/reset', { method: 'POST' });
    } catch (error) {
      console.error('Error resetting game:', error);
    }
  };

  const toggleTeam = async (player: GamePlayer) => {
    const nextTeam = player.team === 'red' ? 'blue' : player.team === 'blue' ? null : 'red';
    try {
      await fetch('/api/current-game/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: [{ id: player.id, team: nextTeam }] }),
      });
    } catch (error) {
      console.error('Error toggling team:', error);
    }
  };

  const splitTeams = async () => {
    if (gamePlayers.length < 2) {
      alert('Potrebujete aspoň 2 hráčov na rozlosovanie.');
      return;
    }
    
    setIsShuffling(true);
    
    // Artificial delay for effect
    await new Promise(resolve => setTimeout(resolve, 2000));

    const goalies = gamePlayers.filter(p => p.position === 'goalie');
    const defenders = gamePlayers.filter(p => p.position === 'defense');
    const forwards = gamePlayers.filter(p => p.position === 'forward');

    const shuffle = <T,>(array: T[]) => [...array].sort(() => Math.random() - 0.5);

    const sGoalies = shuffle<GamePlayer>(goalies);
    const sDefenders = shuffle<GamePlayer>(defenders);
    const sForwards = shuffle<GamePlayer>(forwards);

    const teamsUpdate: { id: number; team: 'red' | 'blue' | null }[] = [];

    // Reset all first
    gamePlayers.forEach(p => teamsUpdate.push({ id: p.id, team: null }));

    // Strict assignment: 1 Goalie per team
    if (sGoalies.length >= 1) teamsUpdate.find(u => u.id === sGoalies[0].id)!.team = 'red';
    if (sGoalies.length >= 2) teamsUpdate.find(u => u.id === sGoalies[1].id)!.team = 'blue';

    // Strict assignment: 4 Defenders per team
    const redDefenders = sDefenders.slice(0, 4);
    const blueDefenders = sDefenders.slice(4, 8);
    redDefenders.forEach(p => teamsUpdate.find(u => u.id === p.id)!.team = 'red');
    blueDefenders.forEach(p => teamsUpdate.find(u => u.id === p.id)!.team = 'blue');

    // Strict assignment: 6 Forwards per team
    const redForwards = sForwards.slice(0, 6);
    const blueForwards = sForwards.slice(6, 12);
    redForwards.forEach(p => teamsUpdate.find(u => u.id === p.id)!.team = 'red');
    blueForwards.forEach(p => teamsUpdate.find(u => u.id === p.id)!.team = 'blue');

    try {
      const res = await fetch('/api/current-game/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: teamsUpdate }),
      });
      if (!res.ok) throw new Error('Failed to split');
    } catch (error) {
      console.error('Error splitting teams:', error);
      alert('Nepodarilo sa rozlosovať tímy.');
    } finally {
      setIsShuffling(false);
    }
  };

  const copyTeams = () => {
    const redTeam = gamePlayers.filter(p => p.team === 'red');
    const blueTeam = gamePlayers.filter(p => p.team === 'blue');

    const formatTeam = (name: string, team: GamePlayer[]) => {
      const g = team.filter(p => p.position === 'goalie').map(p => p.name).join(', ') || '-';
      const d = team.filter(p => p.position === 'defense').map(p => p.name).join(', ') || '-';
      const f = team.filter(p => p.position === 'forward').map(p => p.name).join(', ') || '-';
      return `*${name} TÍM*\n🥅 Brankár: ${g}\n🛡️ Obrana: ${d}\n⚔️ Útok: ${f}`;
    };

    const text = `🏒 *ROZLOSOVANIE HOKEJOVÝCH TÍMOV*\n\n${formatTeam('ČERVENÝ', redTeam)}\n\n${formatTeam('MODRÝ', blueTeam)}\n\n_Vygenerované cez Rozlosovanie hokej_`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center font-display">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <div className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] animate-pulse">Initializing Hockey System...</div>
      </div>
    );
  }

  const redTeam = gamePlayers.filter(p => p.team === 'red');
  const blueTeam = gamePlayers.filter(p => p.team === 'blue');
  const unassigned = gamePlayers.filter(p => p.team === null);
  const goalieCount = gamePlayers.filter(p => p.position === 'goalie').length;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-600 selection:text-white hockey-grid">
      <div className="atmosphere" />
      
      {/* Top Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5 px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-red-600 p-2.5 rounded-2xl shadow-2xl shadow-red-600/40 rotate-3">
            <Zap className="w-7 h-7 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-black tracking-tighter leading-none italic">
              ROZLOSOVANIE <span className="text-red-600">HOKEJ</span>
            </h1>
            <div className="flex gap-3 mt-1.5">
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-30">
                Professional Management v3.0
              </p>
              <div className="w-1 h-1 bg-white/20 rounded-full self-center"></div>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-red-600 font-bold">
                Live Session
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-6 mr-6 border-r border-white/10 pr-6">
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase opacity-30">Hráči</p>
              <p className="text-lg font-display font-bold">{gamePlayers.length}<span className="text-white/20">/22</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase opacity-30">Brankári</p>
              <p className={`text-lg font-display font-bold ${goalieCount === 2 ? 'text-green-500' : 'text-red-500'}`}>
                {goalieCount}<span className="text-white/20">/2</span>
              </p>
            </div>
          </div>

          <button 
            onClick={splitTeams}
            disabled={gamePlayers.length < 2 || isShuffling}
            className={`relative group flex items-center gap-3 bg-white text-black px-8 py-3.5 rounded-full font-black uppercase text-xs tracking-[0.15em] transition-all hover:scale-105 active:scale-95 disabled:opacity-20 disabled:hover:scale-100 overflow-hidden shadow-2xl shadow-white/10`}
          >
            {isShuffling ? (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                Žrebujem...
              </div>
            ) : (
              <>
                <Shuffle className="w-4 h-4" /> Rozlosovať Tímy
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
          
          <button 
            onClick={resetGame}
            className="p-3.5 rounded-full border border-white/10 hover:bg-white/5 transition-all hover:rotate-180 duration-500"
            title="Resetovať týždeň"
          >
            <RotateCcw className="w-5 h-5 opacity-40" />
          </button>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Sidebar: Roster Management */}
        <div className="lg:col-span-3 space-y-8">
          <section className="glass rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[60px] rounded-full"></div>
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] mb-8 opacity-40 flex items-center gap-3">
              <UserPlus className="w-4 h-4" /> Nový Hráč
            </h2>
            <form onSubmit={addRegular} className="space-y-5">
              <div className="relative">
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Meno a priezvisko"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold focus:outline-none focus:border-red-600/50 transition-all placeholder:opacity-20"
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {(['forward', 'defense', 'goalie'] as Position[]).map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setNewPosition(pos)}
                    className={`flex items-center justify-between px-5 py-4 rounded-2xl border text-[11px] font-bold uppercase tracking-widest transition-all ${
                      newPosition === pos 
                        ? 'bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/30' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>{POSITION_LABELS[pos]}</span>
                    <div className="opacity-40">{POSITION_ICONS[pos]}</div>
                  </button>
                ))}
              </div>
              <button className="w-full bg-white text-black py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5">
                Pridať do systému
              </button>
            </form>
          </section>

          <section className="glass rounded-[2.5rem] p-8 border border-white/5">
            <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] mb-8 opacity-40 flex items-center gap-3">
              <UserCheck className="w-4 h-4" /> Databáza Hráčov
            </h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
              {regulars.sort((a,b) => a.name.localeCompare(b.name)).map(player => (
                <div key={player.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/3 border border-white/5 group hover:bg-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30 group-hover:text-red-600 transition-colors">
                      {POSITION_ICONS[player.position]}
                    </div>
                    <div>
                      <p className="text-sm font-bold tracking-tight">{player.name}</p>
                      <p className="text-[9px] font-mono uppercase opacity-30 tracking-widest mt-0.5">{POSITION_LABELS[player.position]}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => signUp(player)}
                    disabled={gamePlayers.some(gp => gp.name === player.name)}
                    className={`p-3 rounded-xl transition-all ${
                      gamePlayers.some(gp => gp.name === player.name) 
                        ? 'bg-green-600/20 text-green-500' 
                        : 'bg-white/5 hover:bg-white/20 text-white/30 hover:text-white'
                    }`}
                  >
                    {gamePlayers.some(gp => gp.name === player.name) ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Center: Current Roster */}
        <div className="lg:col-span-4 space-y-8">
          <section className="glass rounded-[2.5rem] p-10 border border-white/5 min-h-[800px] relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>
            
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-display font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <ClipboardList className="w-8 h-8 text-red-600" /> NAHLÁSENÍ
                </h2>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-30 mt-2">Current Game Roster</p>
              </div>
              <div className="bg-white/5 px-5 py-2 rounded-2xl border border-white/10">
                <span className="text-xl font-display font-bold">{gamePlayers.length}</span>
                <span className="text-white/20 font-bold ml-1">/ 22</span>
              </div>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {gamePlayers.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-32 text-center"
                  >
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Users className="w-10 h-10 text-white/10" />
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.4em] opacity-20">Waiting for signups...</p>
                  </motion.div>
                )}
                {gamePlayers.map(player => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={player.id}
                    onClick={() => toggleTeam(player)}
                    className={`group cursor-pointer flex items-center justify-between p-5 rounded-3xl border transition-all duration-500 ${
                      player.team === 'red' ? 'bg-red-600/10 border-red-600/30' : 
                      player.team === 'blue' ? 'bg-blue-600/10 border-blue-600/30' : 
                      'bg-white/3 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                        player.team === 'red' ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' : 
                        player.team === 'blue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 
                        'bg-white/5 text-white/30 group-hover:bg-white/10'
                      }`}>
                        {POSITION_ICONS[player.position]}
                      </div>
                      <div>
                        <p className="font-bold text-base uppercase tracking-tight">{player.name}</p>
                        <p className="text-[10px] font-mono uppercase opacity-30 tracking-widest mt-0.5">{POSITION_LABELS[player.position]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-[10px] font-mono px-3 py-1.5 rounded-xl uppercase tracking-widest font-bold transition-all ${
                        player.team === 'red' ? 'bg-red-600 text-white' : 
                        player.team === 'blue' ? 'bg-blue-600 text-white' : 
                        'opacity-0 group-hover:opacity-100 bg-white/10 text-white/40'
                      }`}>
                        {player.team ? `${player.team === 'red' ? 'ČERVENÝ' : 'MODRÝ'}` : 'ZMENIŤ'}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeSignUp(player.id); }}
                        className="p-2.5 text-white/10 hover:text-red-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        </div>

        {/* Right: Teams Visualization */}
        <div className="lg:col-span-5 space-y-10">
          <section className="glass rounded-[3rem] p-12 border border-white/5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-600/5 blur-[100px] rounded-full"></div>
            
            <div className="flex justify-between items-center mb-16">
              <div>
                <h2 className="text-3xl font-display font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <LayoutGrid className="w-8 h-8 text-blue-600" /> TÍMY
                </h2>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-30 mt-2">Generated Team Layout</p>
              </div>
              <button 
                onClick={copyTeams}
                disabled={gamePlayers.every(p => p.team === null)}
                className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] bg-white text-black px-6 py-3 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-20 shadow-2xl shadow-white/10"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'SKOPÍROVANÉ' : 'WHATSAPP'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-12">
              {/* Red Team */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <div className="absolute -inset-2 bg-red-600/20 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative bg-[#0C0C0E] border border-red-600/20 rounded-[3rem] overflow-hidden shadow-2xl">
                  <div className="bg-gradient-to-r from-red-600 to-red-800 px-10 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-display font-black uppercase italic tracking-[0.15em] text-lg">ČERVENÝ TÍM</h3>
                    </div>
                    <div className="flex items-center gap-3 bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-md">
                      <Users className="w-4 h-4 opacity-70" />
                      <span className="font-mono text-sm font-bold">{redTeam.length}</span>
                    </div>
                  </div>
                  <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-12">
                    <TeamList title="BRANKÁR" players={redTeam.filter(p => p.position === 'goalie')} color="red" />
                    <TeamList title="OBRANA" players={redTeam.filter(p => p.position === 'defense')} color="red" />
                    <TeamList title="ÚTOK" players={redTeam.filter(p => p.position === 'forward')} color="red" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-20"></div>
                </div>
              </motion.div>

              {/* Blue Team */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative group"
              >
                <div className="absolute -inset-2 bg-blue-600/20 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative bg-[#0C0C0E] border border-blue-600/20 rounded-[3rem] overflow-hidden shadow-2xl">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-10 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                        <Shield className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-display font-black uppercase italic tracking-[0.15em] text-lg">MODRÝ TÍM</h3>
                    </div>
                    <div className="flex items-center gap-3 bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-md">
                      <Users className="w-4 h-4 opacity-70" />
                      <span className="font-mono text-sm font-bold">{blueTeam.length}</span>
                    </div>
                  </div>
                  <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-12">
                    <TeamList title="BRANKÁR" players={blueTeam.filter(p => p.position === 'goalie')} color="blue" />
                    <TeamList title="OBRANA" players={blueTeam.filter(p => p.position === 'defense')} color="blue" />
                    <TeamList title="ÚTOK" players={blueTeam.filter(p => p.position === 'forward')} color="blue" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-20"></div>
                </div>
              </motion.div>

              {unassigned.length > 0 && (
                <div className="p-10 border border-dashed border-white/10 rounded-[2.5rem] text-center bg-white/2">
                  <p className="text-[11px] font-mono uppercase opacity-30 tracking-[0.3em]">
                    {unassigned.length} hráčov čaká na rozdelenie
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="p-20 text-center border-t border-white/5 mt-20">
        <div className="flex justify-center gap-8 mb-6 opacity-20">
          <Shield className="w-5 h-5" />
          <Sword className="w-5 h-5" />
          <Goal className="w-5 h-5" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-[0.6em] opacity-20">
          ROZLOSOVANIE HOKEJ • PROFESSIONAL EDITION • 2026
        </p>
      </footer>
    </div>
  );
}

function TeamList({ title, players, color }: { title: string, players: GamePlayer[], color: 'red' | 'blue' }) {
  return (
    <div className="space-y-5">
      <p className="text-[10px] font-mono uppercase opacity-20 tracking-[0.3em] border-b border-white/5 pb-3">{title}</p>
      <div className="space-y-3">
        {players.length === 0 ? (
          <p className="text-[11px] italic opacity-10 font-mono">Empty</p>
        ) : (
          players.map(p => (
            <div key={p.id} className="flex items-center gap-3 text-sm font-bold uppercase tracking-tight group/item">
              <div className={`w-1.5 h-1.5 rounded-full ${color === 'red' ? 'bg-red-600 shadow-[0_0_8px_rgba(255,45,85,0.8)]' : 'bg-blue-600 shadow-[0_0_8px_rgba(0,122,255,0.8)]'}`}></div>
              <span className="group-hover/item:translate-x-1 transition-transform duration-300">{p.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
