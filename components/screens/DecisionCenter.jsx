'use client';
// Decision Center — track decisions, options, recommendations, results

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import { listDecisionItems, createDecisionItem, updateDecisionItem, deleteDecisionItem } from '@/lib/actions/operations';

const STATUS_META = {
  open:      { label:'Offen',       color:'var(--info)'    },
  ready:     { label:'Entscheidungsreif', color:'var(--brand)'  },
  decided:   { label:'Entschieden', color:'var(--success)' },
  blocked:   { label:'Blockiert',   color:'var(--danger)'  },
  cancelled: { label:'Abgebrochen', color:'var(--text-4)'  },
};

const IMPACT_COLOR = { critical:'var(--danger)', high:'var(--warning)', medium:'var(--info)', low:'var(--text-3)' };

const TODAY = new Date().toISOString().slice(0,10);

function DecisionCard({ item, workspaceId, members, projects, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [result, setResult]     = useState('');
  const [pending, setPending]   = useState(null);

  const owner   = members.find(m=>m.id===item.decisionOwnerId);
  const project = projects.find(p=>p.id===item.relatedProjectId);
  const overdue = item.neededBy && item.neededBy < TODAY && item.status !== 'decided' && item.status !== 'cancelled';
  const needed  = item.neededBy ? dueLabel(item.neededBy) : null;

  const patch = async (p) => {
    setPending('p');
    const r = await updateDecisionItem({ workspaceId, itemId:item.id, patch:p });
    setPending(null);
    if (r.ok&&r.data) onUpdate(r.data);
  };

  const markDecided = async () => {
    if (!result.trim()) return;
    setPending('decided');
    const r = await updateDecisionItem({ workspaceId, itemId:item.id, patch:{ status:'decided', decisionResult:result.trim() } });
    setPending(null);
    setDeciding(false);
    if (r.ok&&r.data) onUpdate(r.data);
  };

  const remove = async () => {
    setPending('del');
    const r = await deleteDecisionItem({ workspaceId, itemId:item.id });
    setPending(null);
    if (r.ok) onDelete(item.id);
  };

  return (
    <div style={{
      borderRadius:10, border:`1px solid ${overdue?'var(--danger-border)':item.status==='decided'?'var(--success-border, var(--border-soft))':'var(--border-soft)'}`,
      background: overdue?'var(--danger-bg)' : item.status==='decided'?'#f0fdf4':'var(--bg-card)',
      opacity: item.status==='cancelled'?0.5:pending?0.75:1,
    }}>
      <div style={{padding:'14px 16px',cursor:'pointer'}} onClick={()=>setExpanded(!expanded)}>
        <div className="row between items-start mb-2">
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{item.title}</div>
            <div className="row gap-3" style={{fontSize:12,color:'var(--text-3)',flexWrap:'wrap'}}>
              {owner&&<span>👤 {owner.name}</span>}
              {project&&<span>📁 {project.name}</span>}
              {needed&&<span style={{color:needed.danger?'var(--danger)':needed.today?'var(--warning)':'var(--text-3)',fontWeight:needed.danger||needed.today?600:400}}>📅 Benötigt: {needed.text}</span>}
              {item.impact&&<span style={{color:IMPACT_COLOR[item.impact]??'var(--text-3)',fontWeight:600}}>Impact: {item.impact}</span>}
            </div>
          </div>
          <div className="row gap-2 items-center" onClick={e=>e.stopPropagation()}>
            <select className="input" value={item.status}
              onChange={e=>patch({status:e.target.value})} disabled={!!pending}
              style={{height:26,fontSize:12,padding:'0 4px',width:150,color:STATUS_META[item.status]?.color}}>
              {Object.entries(STATUS_META).filter(([k])=>k!=='cancelled').map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            {item.status!=='decided'&&(
              <button className="btn btn-quiet btn-icon" style={{width:26,height:26}} title="Als entschieden markieren"
                onClick={()=>setDeciding(!deciding)}><I.check size={12}/></button>
            )}
            <I.chevronDown size={12} style={{color:'var(--text-3)',transform:expanded?'rotate(180deg)':'',transition:'0.15s'}}/>
          </div>
        </div>

        {/* Options preview */}
        {(item.optionA||item.optionB) && (
          <div className="row gap-2" style={{flexWrap:'wrap'}}>
            {item.optionA&&<span style={{fontSize:12,padding:'2px 8px',borderRadius:6,background:'var(--bg-sunk)',color:'var(--text-2)'}}>A: {item.optionA}</span>}
            {item.optionB&&<span style={{fontSize:12,padding:'2px 8px',borderRadius:6,background:'var(--bg-sunk)',color:'var(--text-2)'}}>B: {item.optionB}</span>}
            {item.optionC&&<span style={{fontSize:12,padding:'2px 8px',borderRadius:6,background:'var(--bg-sunk)',color:'var(--text-2)'}}>C: {item.optionC}</span>}
          </div>
        )}

        {/* Decision result banner */}
        {item.status==='decided'&&item.decisionResult&&(
          <div style={{marginTop:8,fontSize:13,fontWeight:600,color:'var(--success)',padding:'6px 10px',background:'#f0fdf4',borderRadius:6}}>
            ✅ Entscheidung: {item.decisionResult}
          </div>
        )}
      </div>

      {/* Decide inline */}
      {deciding&&(
        <div style={{borderTop:'1px solid var(--border-soft)',padding:'10px 16px'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:12.5,fontWeight:600,marginBottom:8}}>Entscheidungsergebnis:</div>
          <div className="row gap-2">
            <input className="input" placeholder="Was wurde entschieden?" value={result}
              onChange={e=>setResult(e.target.value)} onKeyDown={e=>e.key==='Enter'&&markDecided()}
              autoFocus style={{flex:1,fontSize:13}}/>
            <button className="btn btn-brand btn-sm" onClick={markDecided} disabled={!result.trim()||!!pending}>
              {pending==='decided'?'…':'Speichern'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setDeciding(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {expanded&&!deciding&&(
        <div style={{borderTop:'1px solid var(--border-soft)',padding:'12px 16px'}} onClick={e=>e.stopPropagation()}>
          {item.context&&<div style={{fontSize:13,color:'var(--text-2)',marginBottom:12,lineHeight:1.55}}><strong>Kontext:</strong> {item.context}</div>}
          {item.recommendation&&(
            <div style={{fontSize:13,fontWeight:600,color:'var(--brand)',marginBottom:12,padding:'8px 10px',background:'var(--brand-soft)',borderRadius:6}}>
              💡 Empfehlung: {item.recommendation}
            </div>
          )}
          {item.notes&&<div style={{fontSize:12.5,color:'var(--text-3)',marginBottom:10}}>{item.notes}</div>}
          <div style={{fontSize:11.5,color:'var(--text-4)',marginBottom:10}}>Angelegt {timeAgo(item.createdAt)}</div>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',fontSize:12}} onClick={remove} disabled={!!pending}>
            <I.x size={11}/> Löschen
          </button>
        </div>
      )}
    </div>
  );
}

function AddModal({ workspaceId, projects, members, onAdd, onClose }) {
  const [f, setF] = useState({ title:'', context:'', optionA:'', optionB:'', optionC:'', recommendation:'', decisionOwnerId:'', neededBy:'', impact:'medium', relatedProjectId:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  useEffect(()=>{ const h=(e)=>{if(e.key==='Escape')onClose();}; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true);
    const r = await createDecisionItem({ workspaceId, title:f.title.trim(), context:f.context||undefined,
      optionA:f.optionA||undefined, optionB:f.optionB||undefined, optionC:f.optionC||undefined,
      recommendation:f.recommendation||undefined, decisionOwnerId:f.decisionOwnerId||undefined,
      neededBy:f.neededBy||undefined, impact:f.impact||undefined, relatedProjectId:f.relatedProjectId||undefined });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onAdd(r.data);
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(20,22,28,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <form onSubmit={submit} className="card card-pad col gap-3" style={{width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto'}}
        onClick={e=>e.stopPropagation()}>
        <div className="row between"><div className="h3">Entscheidung anlegen</div><button type="button" className="btn btn-quiet btn-icon" onClick={onClose}><I.x size={14}/></button></div>
        <input className="input" placeholder="Titel der Entscheidung *" value={f.title} onChange={e=>set('title',e.target.value)} autoFocus style={{fontSize:13}}/>
        <textarea className="input" rows={2} placeholder="Kontext / Hintergrund" value={f.context} onChange={e=>set('context',e.target.value)} style={{fontSize:13,resize:'vertical'}}/>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <input className="input" placeholder="Option A" value={f.optionA} onChange={e=>set('optionA',e.target.value)} style={{fontSize:13}}/>
          <input className="input" placeholder="Option B" value={f.optionB} onChange={e=>set('optionB',e.target.value)} style={{fontSize:13}}/>
          <input className="input" placeholder="Option C (optional)" value={f.optionC} onChange={e=>set('optionC',e.target.value)} style={{fontSize:13}}/>
        </div>
        <input className="input" placeholder="💡 Empfehlung" value={f.recommendation} onChange={e=>set('recommendation',e.target.value)} style={{fontSize:13}}/>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <select className="input" value={f.decisionOwnerId} onChange={e=>set('decisionOwnerId',e.target.value)} style={{fontSize:13}}>
            <option value="">— Entscheider —</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" className="input" value={f.neededBy} onChange={e=>set('neededBy',e.target.value)} style={{fontSize:13}} title="Benötigt bis"/>
          <select className="input" value={f.impact} onChange={e=>set('impact',e.target.value)} style={{fontSize:13}}>
            <option value="critical">🔴 Kritisch</option><option value="high">🟠 Hoch</option>
            <option value="medium">🟡 Mittel</option><option value="low">⚪ Niedrig</option>
          </select>
        </div>
        <select className="input" value={f.relatedProjectId} onChange={e=>set('relatedProjectId',e.target.value)} style={{fontSize:13}}>
          <option value="">— Projekt (optional) —</option>
          {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {error&&<div style={{fontSize:12.5,color:'var(--danger)'}}>{error}</div>}
        <div className="row gap-2">
          <button type="submit" className="btn btn-brand btn-sm" disabled={!f.title.trim()||saving}>{saving?'…':'Anlegen'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
        </div>
      </form>
    </div>
  );
}

export function DecisionCenterScreen({ setRoute }) {
  const { currentWorkspace:brand, currentWorkspaceId, data } = useWorkspace();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(()=>{ if(!currentWorkspaceId)return; listDecisionItems(currentWorkspaceId).then(d=>{setItems(d);setLoading(false);}); },[currentWorkspaceId]);

  const onAdd    = (item)    => { setItems(p=>[item,...p]); setAdding(false); };
  const onUpdate = (updated) => setItems(p=>p.map(i=>i.id===updated.id?updated:i));
  const onDelete = (id)      => setItems(p=>p.filter(i=>i.id!==id));

  const filtered = useMemo(()=>{
    if (statusFilter==='active')  return items.filter(i=>i.status==='open'||i.status==='ready'||i.status==='blocked');
    if (statusFilter==='decided') return items.filter(i=>i.status==='decided');
    if (statusFilter==='overdue') return items.filter(i=>i.neededBy&&i.neededBy<TODAY&&i.status!=='decided'&&i.status!=='cancelled');
    if (statusFilter==='waiting') {
      const owner = data.members.find(m=>m.role==='owner'||m.role==='admin');
      return items.filter(i=>i.status==='open'&&(i.decisionOwnerId===owner?.id||!i.decisionOwnerId));
    }
    return items;
  }, [items, statusFilter, data.members]);

  const counts = {
    active:  items.filter(i=>i.status==='open'||i.status==='ready'||i.status==='blocked').length,
    overdue: items.filter(i=>i.neededBy&&i.neededBy<TODAY&&i.status!=='decided'&&i.status!=='cancelled').length,
    decided: items.filter(i=>i.status==='decided').length,
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{fontSize:11,color:'var(--brand)',fontWeight:600,padding:'2px 8px',borderRadius:20,background:'var(--brand-soft)'}}>Operations</span>
          </div>
          <h1 className="h1">⚖️ Decision Center</h1>
          <p style={{color:'var(--text-2)',fontSize:14,margin:'4px 0 0'}}>Entscheidungsvorlagen mit Optionen, Empfehlungen und Ergebnissen.</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={()=>setAdding(true)}><I.plus size={13}/> Entscheidung anlegen</button>
      </div>

      {adding&&<AddModal workspaceId={currentWorkspaceId} projects={data.projects} members={data.members} onAdd={onAdd} onClose={()=>setAdding(false)}/>}

      <div className="row gap-3 mb-4 wrap">
        {[{l:'Offen',v:counts.active,c:counts.active>0?'var(--info)':undefined,i:'⚖️'},{l:'Überfällig',v:counts.overdue,c:counts.overdue>0?'var(--danger)':undefined,i:'⏰'},{l:'Entschieden',v:counts.decided,c:'var(--success)',i:'✅'}]
          .map(({l,v,c,i})=>(
            <div key={l} className="card card-pad" style={{flex:'1 1 120px'}}>
              <div style={{fontSize:26,fontWeight:700,color:c??'var(--text-1)',letterSpacing:'-0.03em'}}>{v}</div>
              <div style={{fontSize:12,color:'var(--text-2)',marginTop:2}}>{i} {l}</div>
            </div>
          ))}
      </div>

      <div className="row gap-1 mb-4">
        {[{id:'active',l:'Offen'},{id:'overdue',l:`Überfällig ${counts.overdue}`,c:counts.overdue>0?'var(--danger)':undefined},{id:'waiting',l:'Wartet auf Fabian'},{id:'decided',l:'Entschieden'}]
          .map(({id,l,c})=>(
            <button key={id} className={`chip${statusFilter===id?' active':''}`}
              onClick={()=>setStatusFilter(id)} style={{fontSize:12,color:statusFilter===id?undefined:c}}>{l}</button>
          ))}
      </div>

      {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Wird geladen…</div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'48px 0',color:'var(--text-4)'}}>
          <div style={{fontSize:32,marginBottom:10}}>⚖️</div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text-2)'}}>Keine offenen Entscheidungen</div>
          <div style={{fontSize:13,marginTop:4}}>Entscheidungsvorlagen mit Optionen und Empfehlungen erscheinen hier.</div>
          <button className="btn btn-brand btn-sm mt-4" onClick={()=>setAdding(true)}><I.plus size={13}/> Erste Entscheidung anlegen</button>
        </div>
      ) : (
        <div className="col gap-3">
          {filtered.map(item=>(
            <DecisionCard key={item.id} item={item} workspaceId={currentWorkspaceId}
              members={data.members} projects={data.projects} onUpdate={onUpdate} onDelete={onDelete}/>
          ))}
        </div>
      )}
    </div>
  );
}
