'use client';
// Approval Center — workspace-wide content approval tracking

import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { dueLabel, timeAgo } from '@/lib/utils';
import { listApprovalItems, createApprovalItem, updateApprovalItem, deleteApprovalItem } from '@/lib/actions/operations';

const TYPE_LABELS = {
  podcast_title:'Podcast-Titel', thumbnail:'Thumbnail', landingpage:'Landingpage',
  sponsor_text:'Sponsor-Text', run_of_show:'Run-of-Show', linkedin_post:'LinkedIn Post',
  newsletter:'Newsletter', recap:'Recap', partner_report:'Partner Report',
  budget:'Budget', guest_briefing:'Gast-Briefing', other:'Sonstiges',
};

const STATUS_META = {
  draft:             { label:'Entwurf',           color:'var(--text-3)',  bg:'var(--bg-sunk)'    },
  ready_for_review:  { label:'Zur Review',         color:'var(--info)',    bg:'#eff6ff'           },
  changes_requested: { label:'Änderungen nötig',   color:'var(--warning)', bg:'#fffbeb'           },
  approved:          { label:'Freigegeben',         color:'var(--success)', bg:'#f0fdf4'           },
  published:         { label:'Veröffentlicht',      color:'#712edd',        bg:'#f5f3ff'           },
  cancelled:         { label:'Abgebrochen',         color:'var(--text-4)',  bg:'var(--bg-sunk)'    },
};

const PRIO_COLOR = { urgent:'var(--danger)', high:'var(--warning)', medium:'var(--info)', low:'var(--text-3)' };

const TODAY = new Date().toISOString().slice(0,10);

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span style={{ fontSize:11.5, fontWeight:600, padding:'2px 9px', borderRadius:20, background:m.bg, color:m.color }}>
      {m.label}
    </span>
  );
}

function AddModal({ workspaceId, projects, members, onAdd, onClose }) {
  const [f, setF] = useState({ title:'', type:'other', priority:'medium', reviewerId:'', dueDate:'', description:'', relatedProjectId:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = (k,v) => setF(p => ({...p,[k]:v}));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true);
    const r = await createApprovalItem({ workspaceId, title:f.title.trim(), type:f.type, priority:f.priority,
      reviewerId:f.reviewerId||undefined, dueDate:f.dueDate||undefined, description:f.description||undefined,
      relatedProjectId:f.relatedProjectId||undefined });
    setSaving(false);
    if (!r.ok) { setError(r.error); return; }
    onAdd(r.data);
  };

  useEffect(() => {
    const h = (e) => { if (e.key==='Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(20,22,28,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}
      onClick={(e)=>e.target===e.currentTarget&&onClose()}>
      <form onSubmit={submit} className="card card-pad col gap-3" style={{width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}
        onClick={(e)=>e.stopPropagation()}>
        <div className="row between"><div className="h3">Freigabe anlegen</div><button type="button" className="btn btn-quiet btn-icon" onClick={onClose}><I.x size={14}/></button></div>
        <input className="input" placeholder="Titel *" value={f.title} onChange={e=>set('title',e.target.value)} autoFocus style={{fontSize:13}}/>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <select className="input" value={f.type} onChange={e=>set('type',e.target.value)} style={{fontSize:13}}>
            {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" value={f.priority} onChange={e=>set('priority',e.target.value)} style={{fontSize:13}}>
            <option value="urgent">🔴 Urgent</option><option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option><option value="low">⚪ Low</option>
          </select>
          <input type="date" className="input" value={f.dueDate} onChange={e=>set('dueDate',e.target.value)} style={{fontSize:13}}/>
        </div>
        <div className="grid gap-2" style={{gridTemplateColumns:'1fr 1fr'}}>
          <select className="input" value={f.reviewerId} onChange={e=>set('reviewerId',e.target.value)} style={{fontSize:13}}>
            <option value="">— Reviewer —</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="input" value={f.relatedProjectId} onChange={e=>set('relatedProjectId',e.target.value)} style={{fontSize:13}}>
            <option value="">— Projekt (optional) —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <textarea className="input" rows={2} placeholder="Beschreibung / Notizen (optional)"
          value={f.description} onChange={e=>set('description',e.target.value)} style={{fontSize:13,resize:'vertical'}}/>
        {error && <div style={{fontSize:12.5,color:'var(--danger)'}}>{error}</div>}
        <div className="row gap-2">
          <button type="submit" className="btn btn-brand btn-sm" disabled={!f.title.trim()||saving}>{saving?'…':'Anlegen'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
        </div>
      </form>
    </div>
  );
}

function ApprovalRow({ item, workspaceId, members, projects, onUpdate, onDelete }) {
  const [pending, setPending] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const reviewer = members.find(m => m.id === item.reviewerId);
  const project  = projects.find(p => p.id === item.relatedProjectId);
  const due = item.dueDate ? dueLabel(item.dueDate) : null;
  const overdue = item.dueDate && item.dueDate < TODAY && item.status !== 'approved' && item.status !== 'published' && item.status !== 'cancelled';

  const patch = async (p) => {
    setPending('patch');
    const r = await updateApprovalItem({ workspaceId, itemId: item.id, patch: p });
    setPending(null);
    if (r.ok && r.data) onUpdate(r.data);
  };

  const remove = async () => {
    setPending('del');
    const r = await deleteApprovalItem({ workspaceId, itemId: item.id });
    setPending(null);
    if (r.ok) onDelete(item.id);
  };

  return (
    <div style={{
      borderRadius:8, border:`1px solid ${overdue?'var(--danger-border)':'var(--border-soft)'}`,
      background: overdue?'var(--danger-bg)':'var(--bg-card)',
      opacity: item.status==='cancelled'?0.5 : pending?0.7 : 1,
    }}>
      <div className="row gap-3 items-start" style={{padding:'11px 14px',cursor:'pointer'}} onClick={()=>setExpanded(!expanded)}>
        <div style={{flex:1,minWidth:0}}>
          <div className="row gap-2 items-center mb-1">
            <span style={{fontSize:13.5,fontWeight:600}}>{item.title}</span>
            {item.priority==='urgent'&&<span style={{fontSize:10,fontWeight:700,color:'var(--danger)',background:'var(--danger-bg)',padding:'1px 6px',borderRadius:10}}>URGENT</span>}
          </div>
          <div className="row gap-3" style={{fontSize:12,color:'var(--text-3)',flexWrap:'wrap'}}>
            <span style={{fontSize:11.5,fontWeight:600,color:'var(--text-3)',background:'var(--bg-sunk)',padding:'1px 7px',borderRadius:10}}>
              {TYPE_LABELS[item.type]??item.type}
            </span>
            {reviewer&&<span>👤 {reviewer.name}</span>}
            {project&&<span>📁 {project.name}</span>}
            {due&&<span style={{color:due.danger?'var(--danger)':due.today?'var(--warning)':'var(--text-3)',fontWeight:due.danger||due.today?600:400}}>📅 {due.text}</span>}
          </div>
        </div>
        <div className="row gap-2 items-center" onClick={e=>e.stopPropagation()}>
          <select className="input" value={item.status}
            onChange={e=>patch({status:e.target.value})} disabled={!!pending}
            style={{height:26,fontSize:12,padding:'0 4px',width:155,color:STATUS_META[item.status]?.color}}>
            {Object.entries(STATUS_META).filter(([k])=>k!=='cancelled').map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          {item.status!=='approved'&&item.status!=='published'&&(
            <button className="btn btn-quiet btn-icon" style={{width:26,height:26}} onClick={()=>patch({status:'approved'})} title="Freigeben"><I.check size={12}/></button>
          )}
          <I.chevronDown size={12} style={{color:'var(--text-3)',transform:expanded?'rotate(180deg)':'',transition:'0.15s'}}/>
        </div>
      </div>
      {expanded&&(
        <div style={{borderTop:'1px solid var(--border-soft)',padding:'10px 14px'}}>
          {item.description&&<div style={{fontSize:13,color:'var(--text-2)',marginBottom:10,lineHeight:1.55}}>{item.description}</div>}
          <div style={{fontSize:11.5,color:'var(--text-4)',marginBottom:10}}>Angelegt {timeAgo(item.createdAt)}</div>
          <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)',fontSize:12}} onClick={remove} disabled={!!pending}>
            <I.x size={11}/> Löschen
          </button>
        </div>
      )}
    </div>
  );
}

export function ApprovalCenterScreen({ setRoute }) {
  const { currentWorkspace:brand, currentWorkspaceId, data } = useWorkspace();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [search, setSearch]             = useState('');

  useEffect(() => {
    if (!currentWorkspaceId) return;
    listApprovalItems(currentWorkspaceId).then(d => { setItems(d); setLoading(false); });
  }, [currentWorkspaceId]);

  const onAdd    = (item)    => { setItems(p=>[item,...p]); setAdding(false); };
  const onUpdate = (updated) => setItems(p=>p.map(i=>i.id===updated.id?updated:i));
  const onDelete = (id)      => setItems(p=>p.filter(i=>i.id!==id));

  const filtered = useMemo(() => {
    let r = items;
    if (statusFilter==='active')           r = r.filter(i=>i.status==='ready_for_review'||i.status==='changes_requested'||i.status==='draft');
    if (statusFilter==='review')           r = r.filter(i=>i.status==='ready_for_review');
    if (statusFilter==='changes')          r = r.filter(i=>i.status==='changes_requested');
    if (statusFilter==='approved')         r = r.filter(i=>i.status==='approved'||i.status==='published');
    if (statusFilter==='overdue')          r = r.filter(i=>i.dueDate&&i.dueDate<TODAY&&i.status!=='approved'&&i.status!=='published'&&i.status!=='cancelled');
    if (typeFilter!=='all')                r = r.filter(i=>i.type===typeFilter);
    if (search.trim())                     r = r.filter(i=>i.title.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [items, statusFilter, typeFilter, search]);

  const counts = {
    review:   items.filter(i=>i.status==='ready_for_review').length,
    changes:  items.filter(i=>i.status==='changes_requested').length,
    approved: items.filter(i=>i.status==='approved'||i.status==='published').length,
    overdue:  items.filter(i=>i.dueDate&&i.dueDate<TODAY&&i.status!=='approved'&&i.status!=='published'&&i.status!=='cancelled').length,
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{fontSize:11,color:'var(--brand)',fontWeight:600,padding:'2px 8px',borderRadius:20,background:'var(--brand-soft)'}}>Operations</span>
          </div>
          <h1 className="h1">✅ Approval Center</h1>
          <p style={{color:'var(--text-2)',fontSize:14,margin:'4px 0 0'}}>
            Freigaben für Content, Events und Sponsoren — workspace-weit.
          </p>
        </div>
        <button className="btn btn-brand btn-sm" onClick={()=>setAdding(true)}><I.plus size={13}/> Freigabe anlegen</button>
      </div>

      {adding&&<div className="mb-4"><AddModal workspaceId={currentWorkspaceId} projects={data.projects} members={data.members} onAdd={onAdd} onClose={()=>setAdding(false)}/></div>}

      {/* KPI cards */}
      <div className="row gap-3 mb-4 wrap">
        {[
          {l:'Zur Review',       v:counts.review,   c:counts.review>0?'var(--info)':undefined,    i:'👀'},
          {l:'Änderungen nötig', v:counts.changes,  c:counts.changes>0?'var(--warning)':undefined, i:'🔄'},
          {l:'Freigegeben',      v:counts.approved, c:'var(--success)',                            i:'✅'},
          {l:'Überfällig',       v:counts.overdue,  c:counts.overdue>0?'var(--danger)':undefined,  i:'⏰'},
        ].map(({l,v,c,i})=>(
          <div key={l} className="card card-pad" style={{flex:'1 1 120px'}}>
            <div style={{fontSize:26,fontWeight:700,color:c??'var(--text-1)',letterSpacing:'-0.03em'}}>{v}</div>
            <div style={{fontSize:12,color:'var(--text-2)',marginTop:2}}>{i} {l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="row gap-2 mb-4 wrap items-center">
        <div className="row gap-1">
          {[
            {id:'active',  l:'Aktiv'},
            {id:'review',  l:`Zur Review ${counts.review}`,   c:counts.review>0?'var(--info)':undefined},
            {id:'changes', l:`Änderungen ${counts.changes}`,  c:counts.changes>0?'var(--warning)':undefined},
            {id:'approved',l:'Freigegeben'},
            {id:'overdue', l:`Überfällig ${counts.overdue}`,  c:counts.overdue>0?'var(--danger)':undefined},
          ].map(({id,l,c})=>(
            <button key={id} className={`chip${statusFilter===id?' active':''}`}
              onClick={()=>setStatusFilter(id)} style={{fontSize:12,color:statusFilter===id?undefined:c}}>{l}</button>
          ))}
        </div>
        <select className="input" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
          style={{height:28,fontSize:12.5,width:170}}>
          <option value="all">Alle Typen</option>
          {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <input className="input" placeholder="Suchen…" value={search}
          onChange={e=>setSearch(e.target.value)} style={{maxWidth:220}}/>
      </div>

      {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Wird geladen…</div>
      : filtered.length===0 ? (
        <div style={{textAlign:'center',padding:'48px 0',color:'var(--text-4)'}}>
          <div style={{fontSize:32,marginBottom:10}}>✅</div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--text-2)'}}>Keine Freigaben</div>
          <div style={{fontSize:13,marginTop:4}}>Freigabe-Items für Content, Events und Sponsoren erscheinen hier.</div>
          <button className="btn btn-brand btn-sm mt-4" onClick={()=>setAdding(true)}><I.plus size={13}/> Erste Freigabe anlegen</button>
        </div>
      ) : (
        <div className="col gap-2">
          {filtered.map(item=>(
            <ApprovalRow key={item.id} item={item} workspaceId={currentWorkspaceId}
              members={data.members} projects={data.projects} onUpdate={onUpdate} onDelete={onDelete}/>
          ))}
        </div>
      )}
    </div>
  );
}
