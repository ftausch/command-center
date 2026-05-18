'use client';
// Risk & Blocker Board — track risks and blockers across all work

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import { listRiskItems, createRiskItem, updateRiskItem, deleteRiskItem } from '@/lib/actions/operations';

const SEVERITY_META = {
  critical: { label:'Kritisch', color:'var(--danger)',  bg:'var(--danger-bg)'  },
  high:     { label:'Hoch',     color:'#dc6803',        bg:'#fff7ed'           },
  medium:   { label:'Mittel',   color:'var(--warning)', bg:'#fffbeb'           },
  low:      { label:'Niedrig',  color:'var(--text-3)',  bg:'var(--bg-sunk)'    },
};

const STATUS_META = {
  open:       { label:'Offen',        color:'var(--info)'    },
  monitoring: { label:'Beobachtung',  color:'var(--warning)' },
  resolved:   { label:'Gelöst',       color:'var(--success)' },
  ignored:    { label:'Ignoriert',    color:'var(--text-4)'  },
};

function SeverityBadge({ severity }) {
  const m = SEVERITY_META[severity] ?? SEVERITY_META.medium;
  return (
    <span style={{ fontSize:11.5, fontWeight:700, padding:'2px 9px', borderRadius:20, background:m.bg, color:m.color }}>
      {m.label}
    </span>
  );
}

function RiskRow({ item, workspaceId, members, projects, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending]   = useState(null);

  const owner   = members.find(m=>m.id===item.ownerId);
  const project = projects.find(p=>p.id===item.relatedProjectId);
  const sev     = SEVERITY_META[item.severity] ?? SEVERITY_META.medium;

  const patch = async (p) => {
    setPending('p');
    const r = await updateRiskItem({ workspaceId, itemId:item.id, patch:p });
    setPending(null);
    if (r.ok&&r.data) onUpdate(r.data);
  };

  const resolve = () => patch({ status:'resolved', resolvedAt:new Date().toISOString() });

  const remove = async () => {
    setPending('del');
    const r = await deleteRiskItem({ workspaceId, itemId:item.id });
    setPending(null);
    if (r.ok) onDelete(item.id);
  };

  return (
    <div style={{
      borderRadius:8, border:`2px solid ${sev.color}33`,
      background: item.status==='resolved'?'var(--bg-sunk)':sev.bg,
      opacity: item.status==='resolved'?0.6:pending?0.7:1,
    }}>
      <div style={{padding:'12px 14px',cursor:'pointer'}} onClick={()=>setExpanded(!expanded)}>
        <div className="row between items-start">
          <div style={{flex:1,minWidth:0}}>
            <div className="row gap-2 items-center mb-1">
              <span style={{fontSize:12,fontWeight:700,padding:'1px 7px',borderRadius:4,background:item.type==='blocker'?'var(--danger-bg)':'var(--bg-sunk)',color:item.type==='blocker'?'var(--danger)':'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.04em',fontSize:10.5}}>
                {item.type==='blocker'?'🚫 BLOCKER':'⚠️ RISIKO'}
              </span>
              <SeverityBadge severity={item.severity}/>
            </div>
            <div style={{fontSize:13.5,fontWeight:600,marginBottom:4,textDecoration:item.status==='resolved'?'line-through':'none'}}>{item.title}</div>
            <div className="row gap-3" style={{fontSize:12,color:'var(--text-3)',flexWrap:'wrap'}}>
              {owner&&<span>👤 {owner.name}</span>}
              {project&&<span>📁 {project.name}</span>}
              {item.description&&<span style={{maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</span>}
            </div>
          </div>
          <div className="row gap-2 items-center" onClick={e=>e.stopPropagation()}>
            <select className="input" value={item.status}
              onChange={e=>patch({status:e.target.value})} disabled={!!pending}
              style={{height:26,fontSize:12,padding:'0 4px',width:130,color:STATUS_META[item.status]?.color}}>
              {Object.entries(STATUS_META).filter(([k])=>k!=='ignored').map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            {item.status!=='resolved'&&(
              <button className="btn btn-quiet btn-icon" style={{width:26,height:26}} onClick={resolve} title="Als gelöst markieren"><I.check size={12}/></button>
            )}
            <I.chevronDown size={12} style={{color:'var(--text-3)',transform:expanded?'rotate(180deg)':'',transition:'0.15s'}}/>
          </div>
        </div>
      </div>
      {expanded&&(
        <div style={{borderTop:`1px solid ${sev.color}22`,padding:'10px 14px'}} onClick={e=>e.stopPropagation()}>
          {item.impact&&<div style={{fontSize:13,color:'var(--text-2)',marginBottom:8}}><strong>Impact:</strong> {item.impact}</div>}
          {item.mitigationPlan&&(
            <div style={{fontSize:13,color:'var(--text-2)',marginBottom:8,padding:'8px 10px',background:'var(--bg-sunk)',borderRadius:6}}>
              🛡️ <strong>Mitigation:</strong> {item.mitigationPlan}
            </div>
          )}
          {item.resolvedAt&&<div style={{fontSize:12,color:'var(--success)',marginBottom:8}}>✅ Gelöst {timeAgo(item.resolvedAt)}</div>}
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
  const [f, setF] = useState({ title:'', type:'risk', severity:'medium', description:'', impact:'', mitigationPlan:'', ownerId:'', dueDate:'', relatedProjectId:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  useEffect(()=>{ const h=(e)=>{if(e.key==='Escape')onClose();}; window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h); },[onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true);
    const r = await createRiskItem({ workspaceId, title:f.title.trim(), type:f.type, severity:f.severity,
      description:f.description||undefined, impact:f.impact||undefined, mitigationPlan:f.mitigationPlan||undefined,
      ownerId:f.ownerId||undefined, dueDate:f.dueDate||undefined, relatedProjectId:f.relatedProjectId||undefined });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onAdd(r.data);
  };

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(20,22,28,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <form onSubmit={submit} className="card card-pad col gap-3" style={{width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}
        onClick={e=>e.stopPropagation()}>
        <div className="row between"><div className="h3">Risiko / Blocker anlegen</div><button type="button" className="btn btn-quiet btn-icon" onClick={onClose}><I.x size={14}/></button></div>
        <input className="input" placeholder="Titel *" value={f.title} onChange={e=>set('title',e.target.value)} autoFocus style={{fontSize:13}}/>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <select className="input" value={f.type} onChange={e=>set('type',e.target.value)} style={{fontSize:13}}>
            <option value="blocker">🚫 Blocker</option>
            <option value="risk">⚠️ Risiko</option>
          </select>
          <select className="input" value={f.severity} onChange={e=>set('severity',e.target.value)} style={{fontSize:13}}>
            <option value="critical">🔴 Kritisch</option><option value="high">🟠 Hoch</option>
            <option value="medium">🟡 Mittel</option><option value="low">⚪ Niedrig</option>
          </select>
          <select className="input" value={f.ownerId} onChange={e=>set('ownerId',e.target.value)} style={{fontSize:13}}>
            <option value="">— Owner —</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <textarea className="input" rows={2} placeholder="Beschreibung" value={f.description} onChange={e=>set('description',e.target.value)} style={{fontSize:13,resize:'vertical'}}/>
        <input className="input" placeholder="Impact / Auswirkung" value={f.impact} onChange={e=>set('impact',e.target.value)} style={{fontSize:13}}/>
        <input className="input" placeholder="🛡️ Mitigation / Gegenmaßnahme" value={f.mitigationPlan} onChange={e=>set('mitigationPlan',e.target.value)} style={{fontSize:13}}/>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr'}}>
          <input type="date" className="input" value={f.dueDate} onChange={e=>set('dueDate',e.target.value)} style={{fontSize:13}}/>
          <select className="input" value={f.relatedProjectId} onChange={e=>set('relatedProjectId',e.target.value)} style={{fontSize:13}}>
            <option value="">— Projekt —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {error&&<div style={{fontSize:12.5,color:'var(--danger)'}}>{error}</div>}
        <div className="row gap-2">
          <button type="submit" className="btn btn-brand btn-sm" disabled={!f.title.trim()||saving}>{saving?'…':'Anlegen'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
        </div>
      </form>
    </div>
  );
}

export function RiskBoardScreen({ setRoute }) {
  const { currentWorkspace:brand, currentWorkspaceId, data } = useWorkspace();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [filter, setFilter]   = useState('active');

  useEffect(()=>{ if(!currentWorkspaceId)return; listRiskItems(currentWorkspaceId).then(d=>{setItems(d);setLoading(false);}); },[currentWorkspaceId]);

  const onAdd    = (item)    => { setItems(p=>[item,...p]); setAdding(false); };
  const onUpdate = (updated) => setItems(p=>p.map(i=>i.id===updated.id?updated:i));
  const onDelete = (id)      => setItems(p=>p.filter(i=>i.id!==id));

  const filtered = useMemo(()=>{
    if (filter==='active')   return items.filter(i=>i.status==='open'||i.status==='monitoring');
    if (filter==='critical') return items.filter(i=>i.severity==='critical'&&i.status!=='resolved');
    if (filter==='blockers') return items.filter(i=>i.type==='blocker'&&i.status!=='resolved');
    if (filter==='resolved') return items.filter(i=>i.status==='resolved');
    return items;
  }, [items, filter]);

  const critical = items.filter(i=>i.severity==='critical'&&i.status!=='resolved').length;
  const blockers = items.filter(i=>i.type==='blocker'&&i.status!=='resolved').length;
  const open     = items.filter(i=>i.status==='open').length;
  const resolved = items.filter(i=>i.status==='resolved').length;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{fontSize:11,color:'var(--brand)',fontWeight:600,padding:'2px 8px',borderRadius:20,background:'var(--brand-soft)'}}>Operations</span>
          </div>
          <h1 className="h1">⚠️ Risks & Blockers</h1>
          <p style={{color:'var(--text-2)',fontSize:14,margin:'4px 0 0'}}>Blockers und Risiken workspace-weit verfolgen und lösen.</p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={()=>setAdding(true)}><I.plus size={13}/> Risiko / Blocker</button>
      </div>

      {adding&&<AddModal workspaceId={currentWorkspaceId} projects={data.projects} members={data.members} onAdd={onAdd} onClose={()=>setAdding(false)}/>}

      <div className="row gap-3 mb-4 wrap">
        {[{l:'Kritisch',v:critical,c:critical>0?'var(--danger)':undefined,i:'🔴'},{l:'Blocker',v:blockers,c:blockers>0?'var(--danger)':undefined,i:'🚫'},{l:'Offen',v:open,c:open>0?'var(--warning)':undefined,i:'⚠️'},{l:'Gelöst',v:resolved,c:'var(--success)',i:'✅'}]
          .map(({l,v,c,i})=>(
            <div key={l} className="card card-pad" style={{flex:'1 1 100px'}}>
              <div style={{fontSize:26,fontWeight:700,color:c??'var(--text-1)',letterSpacing:'-0.03em'}}>{v}</div>
              <div style={{fontSize:12,color:'var(--text-2)',marginTop:2}}>{i} {l}</div>
            </div>
          ))}
      </div>

      <div className="row gap-1 mb-4">
        {[{id:'active',l:'Aktiv'},{id:'critical',l:`Kritisch ${critical}`,c:critical>0?'var(--danger)':undefined},{id:'blockers',l:`Blocker ${blockers}`,c:blockers>0?'var(--danger)':undefined},{id:'resolved',l:'Gelöst'}]
          .map(({id,l,c})=>(
            <button key={id} className={`chip${filter===id?' active':''}`}
              onClick={()=>setFilter(id)} style={{fontSize:12,color:filter===id?undefined:c}}>{l}</button>
          ))}
      </div>

      {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Wird geladen…</div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'48px 0',color:'var(--text-4)'}}>
          <div style={{fontSize:32,marginBottom:10}}>✅</div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text-2)'}}>Keine aktiven Risiken</div>
          <div style={{fontSize:13,marginTop:4}}>Blockers und Risiken erscheinen hier wenn etwas Aufmerksamkeit braucht.</div>
          <button className="btn btn-brand btn-sm mt-4" onClick={()=>setAdding(true)}><I.plus size={13}/> Erstes Risiko anlegen</button>
        </div>
      ) : (
        <div className="col gap-2">
          {filtered.map(item=>(
            <RiskRow key={item.id} item={item} workspaceId={currentWorkspaceId}
              members={data.members} projects={data.projects} onUpdate={onUpdate} onDelete={onDelete}/>
          ))}
        </div>
      )}
    </div>
  );
}
