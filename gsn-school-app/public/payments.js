async function authHeaders(json=true){ const t = localStorage.getItem('token'); const h = {}; if(json) h['Content-Type']='application/json'; if(t) h['Authorization']='Bearer '+t; return h; }

console.log('payments.js: loaded');

async function loadPayments(){
  try{
    const res = await fetch('/api/payments', { headers: await authHeaders(false) });
    if(!res.ok) { console.error('Payments list failed'); return; }
    const rows = await res.json();
    const tbody = document.querySelector('#paymentsTable tbody'); tbody.innerHTML='';
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.created_at}</td><td><a target="_blank" href="/api/receipt/${r.id}?token=${encodeURIComponent(localStorage.getItem('token')||'')}">#${r.id}</a></td><td>${r.name} (${r.adm_no})</td><td>₹${Number(r.amount).toFixed(2)}</td><td>${r.month||'-'}</td><td>${r.mode||'-'}</td><td>${r.notes||''}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ console.error('Load payments error', e); }
}

document.getElementById('refreshPayments').addEventListener('click', ()=>{ console.log('payments.js: refreshPayments clicked'); loadPayments(); });
document.getElementById('paymentsSearch').addEventListener('input', async (e)=>{
  const q = e.target.value.trim().toLowerCase();
  const res = await fetch('/api/payments', { headers: await authHeaders(false) });
  if(!res.ok) return;
  const rows = await res.json();
  const tbody = document.querySelector('#paymentsTable tbody'); tbody.innerHTML='';
  rows.filter(r => (r.name||'').toLowerCase().includes(q) || (r.adm_no||'').toLowerCase().includes(q)).forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.created_at}</td><td><a target="_blank" href="/api/receipt/${r.id}?token=${encodeURIComponent(localStorage.getItem('token')||'')}">#${r.id}</a></td><td>${r.name} (${r.adm_no})</td><td>₹${Number(r.amount).toFixed(2)}</td><td>${r.month||'-'}</td><td>${r.mode||'-'}</td><td>${r.notes||''}</td>`;
    tbody.appendChild(tr);
  });
});

// initial
loadPayments();
