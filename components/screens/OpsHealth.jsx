'use client';
// Operations Health Dashboard — workspace-wide health overview

import { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '@/components/WorkspaceProvider';
import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { daysUntil, projectHealthScore, eventHealthScore, eventHealthColor } from '@/lib/utils';
import { listApprovalItems } from '@/lib/actions/operations';
import { listDecisionItems } from '@/lib/actions/operations';
import { listRiskItems } from '@/lib/actions/operations';
import { listAssistantItems } from '@/lib/actions/assistant';

const TODAY = new Date().toISOString().slice(0,10);

function HealthCard({ title, status, items, icon, onNav }) {
  const color = status==='red' ? 'var(--danger)' : status==='yellow' ? 'var(--warning)' : status==='green' ? 'var(--success)' : 'var(--text-4)';
  const bg    = status==='red' ? 'var(--danger-bg)' : status==='yellow' ? '#fffbeb' : status==='green' ? '#f0fdf4' : 'var(--bg-sunk)';
  return (
    <div className="card" style={{border:`1px solid ${color}33`,background:bg,overflow:'hidden'}}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${color}22`}}>
        <div className="row between items-center">
          <div className="row gap-2 items-center">
            <span style={{fontSize:16}}>{icon}</span>
            <span style={{fontSize:13.5,fontWeight:700}}>{title}</span>
          </div>
          <div className="row gap-2 items-center">
            <span style={{width:9,height:9,borderRadius:'50%',background:color,display:'inline-block'}}/>
            {onNav&&<button className="btn btn-quiet btn-sm" onClick={onNav} style={{fontSize:11.5,padding:'2px 8px'}}>Details →</button>}
          </div>
        </div>
      </div>
      <div style={{padding:'10px 14px'}}>
        {items.length===0 ? (
          <div style={{fontSize:12.5,color:'var(--text-3)',fontStyle:'italic'}}>Alles in Ordnung.</div>
        ) : (
          <div className="col gap-1">
            {items.slice(0,5).map((it,i)=>(
              <div key={i} className="row gap-2 items-center" style={{fontSize:12.5}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0}}/>
                <span style={{color:'var(--text-1)'}}>{it}</span>
              </div>
            ))}
            {items.length>5&&<div style={{fontSize:11.5,color:'var(--text-3)',marginTop:2}}>+{items.length-5} weitere</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function OpsHealthScreen({ setRoute }) {
  const { currentWorkspace:brand, currentWorkspaceId, data } = useWorkspace();
  const [approvals,  setApprovals]  = useState([]);
  const [decisions,  setDecisions]  = useState([]);
  const [risks,      setRisks]      = useState([]);
  const [assistItems,setAssistItems]= useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(()=>{
    if (!currentWorkspaceId) return;
    Promise.all([
      listApprovalItems(currentWorkspaceId),
      listDecisionItems(currentWorkspaceId),
      listRiskItems(currentWorkspaceId),
      listAssistantItems(currentWorkspaceId),
    ]).then(([a,d,r,ai])=>{
      setApprovals(a); setDecisions(d); setRisks(r); setAssistItems(ai);
      setLoading(false);
    });
  }, [currentWorkspaceId]);

  const health = useMemo(()=>{
    const projects = data.projects ?? [];
    const tasks    = data.tasks ?? [];
    const members  = data.members ?? [];

    // Tasks
    const overdueTasks    = tasks.filter(t=>t.due&&t.due<TODAY&&t.status!=='Done');
    const unassignedTasks = tasks.filter(t=>!t.assignee&&t.status!=='Done');
    const blockedTasks    = tasks.filter(t=>t.status==='Blocked');

    // Projects
    const noOwner    = projects.filter(p=>p.status!=='Done'&&!p.owner);
    const eventProj  = projects.filter(p=>p.division==='events'&&p.status!=='Done');
    const noLocation = eventProj.filter(p=>p.eventMeta?.eventDate&&!p.eventMeta?.location);
    const noSignup   = eventProj.filter(p=>p.eventMeta?.eventDate&&!p.eventMeta?.signupUrl&&!p.eventMeta?.landingPageUrl);

    // Project health
    const criticalProjects = projects.filter(p=>p.status!=='Done'&&projectHealthScore(p,tasks.filter(t=>t.projectId===p.id)).score==='red');
    const atRiskProjects   = projects.filter(p=>p.status!=='Done'&&projectHealthScore(p,tasks.filter(t=>t.projectId===p.id)).score==='yellow');

    // Approvals
    const pendingApprovals = approvals.filter(a=>a.status==='ready_for_review');
    const overdueApprovals = approvals.filter(a=>a.dueDate&&a.dueDate<TODAY&&a.status!=='approved'&&a.status!=='published'&&a.status!=='cancelled');

    // Decisions
    const openDecisions    = decisions.filter(d=>d.status==='open'||d.status==='ready');
    const overdueDecisions = decisions.filter(d=>d.neededBy&&d.neededBy<TODAY&&d.status!=='decided'&&d.status!=='cancelled');

    // Risks
    const criticalRisks  = risks.filter(r=>r.severity==='critical'&&r.status!=='resolved');
    const activeBlockers = risks.filter(r=>r.type==='blocker'&&r.status!=='resolved');

    // Assistant
    const assistDueToday = assistItems.filter(i=>i.dueDate===TODAY&&i.status!=='done'&&i.status!=='cancelled');
    const assistOverdue  = assistItems.filter(i=>i.dueDate&&i.dueDate<TODAY&&i.status!=='done'&&i.status!=='cancelled');

    // Slack
    const slackStatus = currentWorkspaceId ? 'connected' : 'unknown';

    return {
      tasks: { overdueTasks, unassignedTasks, blockedTasks },
      projects: { noOwner, noLocation, noSignup, criticalProjects, atRiskProjects },
      approvals: { pendingApprovals, overdueApprovals },
      decisions: { openDecisions, overdueDecisions },
      risks: { criticalRisks, activeBlockers },
      assistant: { assistDueToday, assistOverdue },
    };
  }, [data, approvals, decisions, risks, assistItems, currentWorkspaceId]);

  // Overall health score
  const criticalCount = (
    health.tasks.overdueTasks.filter(t=>t.priority==='High').length +
    health.projects.criticalProjects.length +
    health.risks.criticalRisks.length +
    health.risks.activeBlockers.length +
    health.approvals.overdueApprovals.length
  );
  const warningCount = (
    health.tasks.blockedTasks.length +
    health.projects.atRiskProjects.length +
    health.projects.noOwner.length +
    health.decisions.overdueDecisions.length
  );
  const overallStatus = criticalCount > 0 ? 'red' : warningCount > 0 ? 'yellow' : 'green';
  const overallColor  = overallStatus==='red'?'var(--danger)':overallStatus==='yellow'?'var(--warning)':'var(--success)';

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge kind="brand" dot>{brand?.name}</Badge>
            <span style={{fontSize:11,color:'var(--brand)',fontWeight:600,padding:'2px 8px',borderRadius:20,background:'var(--brand-soft)'}}>Operations</span>
          </div>
          <h1 className="h1" style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:12,height:12,borderRadius:'50%',background:overallColor,display:'inline-block',boxShadow:`0 0 0 3px ${overallColor}33`}}/>
            Health Dashboard
          </h1>
          <p style={{color:'var(--text-2)',fontSize:14,margin:'4px 0 0'}}>
            Workspace-weiter Gesundheitsstatus — {criticalCount>0?<span style={{color:'var(--danger)',fontWeight:600}}>{criticalCount} kritische Issues</span>:warningCount>0?<span style={{color:'var(--warning)',fontWeight:600}}>{warningCount} Warnungen</span>:<span style={{color:'var(--success)',fontWeight:600}}>Alles gesund</span>}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{padding:40,textAlign:'center',color:'var(--text-3)'}}>Wird geladen…</div>
      ) : (
        <div className="col gap-5">
          {/* Quick summary bar */}
          <div className="row gap-3 wrap">
            {[
              {l:'Kritische Projekte', v:health.projects.criticalProjects.length, c:health.projects.criticalProjects.length>0?'var(--danger)':undefined},
              {l:'Offene Blockers',    v:health.risks.activeBlockers.length,       c:health.risks.activeBlockers.length>0?'var(--danger)':undefined},
              {l:'Überfällige Tasks', v:health.tasks.overdueTasks.length,          c:health.tasks.overdueTasks.length>0?'var(--warning)':undefined},
              {l:'Offene Freigaben',  v:health.approvals.pendingApprovals.length,  c:health.approvals.pendingApprovals.length>0?'var(--info)':undefined},
              {l:'Offene Entscheid.', v:health.decisions.openDecisions.length,     c:health.decisions.openDecisions.length>0?'var(--info)':undefined},
              {l:'PA Items heute',    v:health.assistant.assistDueToday.length,    c:health.assistant.assistDueToday.length>0?'var(--warning)':undefined},
            ].map(({l,v,c})=>(
              <div key={l} className="card card-pad" style={{flex:'1 1 120px'}}>
                <div style={{fontSize:26,fontWeight:700,color:c??'var(--success)',letterSpacing:'-0.03em'}}>{v}</div>
                <div style={{fontSize:11.5,color:'var(--text-2)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Project & Event Health */}
          <div>
            <div className="h3 mb-3">🏗 Projekte & Events</div>
            <div className="grid gap-3" style={{gridTemplateColumns:'1fr 1fr'}}>
              <HealthCard title="Kritische Projekte" status={health.projects.criticalProjects.length>0?'red':health.projects.atRiskProjects.length>0?'yellow':'green'}
                icon="🔴"
                items={[...health.projects.criticalProjects.map(p=>`${p.name} — kritisch`),...health.projects.atRiskProjects.map(p=>`${p.name} — Risiko`).slice(0,3)]}
                onNav={()=>setRoute('projects')}/>
              <HealthCard title="Events ohne Location / Signup" status={health.projects.noLocation.length>0||health.projects.noSignup.length>0?'yellow':'green'}
                icon="📍"
                items={[...health.projects.noLocation.map(p=>`${p.name}: keine Location`),...health.projects.noSignup.map(p=>`${p.name}: kein Signup-Link`)]}
                onNav={()=>setRoute('eventhub')}/>
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="h3 mb-3">✅ Tasks</div>
            <div className="grid gap-3" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <HealthCard title="Überfällige Tasks" status={health.tasks.overdueTasks.length>3?'red':health.tasks.overdueTasks.length>0?'yellow':'green'}
                icon="⏰"
                items={health.tasks.overdueTasks.slice(0,5).map(t=>`${t.title}`)}
                onNav={()=>setRoute('mytasks')}/>
              <HealthCard title="Blockierte Tasks" status={health.tasks.blockedTasks.length>0?'yellow':'green'}
                icon="🚫"
                items={health.tasks.blockedTasks.slice(0,5).map(t=>`${t.title}`)}
                onNav={()=>setRoute('kanban')}/>
              <HealthCard title="Nicht zugewiesen" status={health.tasks.unassignedTasks.length>5?'yellow':'green'}
                icon="👤"
                items={health.tasks.unassignedTasks.slice(0,5).map(t=>`${t.title}`)}
                onNav={()=>setRoute('kanban')}/>
            </div>
          </div>

          {/* Operations */}
          <div>
            <div className="h3 mb-3">⚙️ Operations</div>
            <div className="grid gap-3" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <HealthCard title="Kritische Risiken / Blockers" status={health.risks.criticalRisks.length>0||health.risks.activeBlockers.length>0?'red':'green'}
                icon="⚠️"
                items={[...health.risks.criticalRisks.map(r=>`[Kritisch] ${r.title}`),...health.risks.activeBlockers.map(r=>`[Blocker] ${r.title}`)]}
                onNav={()=>setRoute('risks')}/>
              <HealthCard title="Freigaben warten" status={health.approvals.overdueApprovals.length>0?'red':health.approvals.pendingApprovals.length>0?'yellow':'green'}
                icon="✅"
                items={[...health.approvals.overdueApprovals.map(a=>`[Überfällig] ${a.title}`),...health.approvals.pendingApprovals.map(a=>a.title)]}
                onNav={()=>setRoute('approvals')}/>
              <HealthCard title="Entscheidungen offen" status={health.decisions.overdueDecisions.length>0?'red':health.decisions.openDecisions.length>2?'yellow':'green'}
                icon="⚖️"
                items={[...health.decisions.overdueDecisions.map(d=>`[Überfällig] ${d.title}`),...health.decisions.openDecisions.map(d=>d.title)]}
                onNav={()=>setRoute('decisions')}/>
            </div>
          </div>

          {/* Assistant */}
          <div>
            <div className="h3 mb-3">🗂 Assistenz</div>
            <div className="grid gap-3" style={{gridTemplateColumns:'1fr 1fr'}}>
              <HealthCard title="PA Items heute fällig" status={health.assistant.assistDueToday.length>0?'yellow':'green'}
                icon="📋"
                items={health.assistant.assistDueToday.map(i=>i.title)}
                onNav={()=>setRoute('assisthub')}/>
              <HealthCard title="PA Items überfällig" status={health.assistant.assistOverdue.length>3?'red':health.assistant.assistOverdue.length>0?'yellow':'green'}
                icon="⏰"
                items={health.assistant.assistOverdue.map(i=>i.title)}
                onNav={()=>setRoute('assisthub')}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
