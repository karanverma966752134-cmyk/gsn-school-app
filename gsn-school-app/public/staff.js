function currentUser(){
  try{
    return JSON.parse(localStorage.getItem('staff') || localStorage.getItem('user') || 'null');
  }catch(e){ return null }
}

function authHeaders(json = true){
  const token = localStorage.getItem('token');
  const h = {};
  if(json) h['Content-Type'] = 'application/json';
  if(token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

// Toast helper
function showToast(msg, type='success', ms=3000){
  let container = document.querySelector('.toast-container');
  if(!container){ container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const t = document.createElement('div'); t.className = 'toast ' + (type==='error' ? 'error' : 'success'); t.textContent = msg; container.appendChild(t);
  setTimeout(()=>{ t.style.opacity = '0'; t.remove(); }, ms);
}

// CSV parse and import for staff
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(!lines.length) return [];
  const splitLine = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>{
    c = c.trim();
    if(c.startsWith('"') && c.endsWith('"')) c = c.slice(1,-1).replace(/""/g,'"');
    return c;
  });
  const headers = splitLine(lines[0]).map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const parts = splitLine(lines[i]);
    if(parts.length === 0) continue;
    const obj = {};
    for(let j=0;j<headers.length;j++) obj[headers[j]] = parts[j] !== undefined ? parts[j] : '';
    rows.push(obj);
  }
  return rows;
}

document.getElementById('staffFile').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const txt = await f.text();
  const rows = parseCSV(txt);
  if(!rows.length){ showToast('No rows found in CSV', 'error'); return; }
  showImportPreview('staff', rows);
});

// Preview modal helper
let importPreviewData = { type: '', rows: [] };
function showImportPreview(type, rows) {
  importPreviewData = { type, rows };
  const backdrop = document.getElementById('importPreviewBackdrop');
  const title = document.getElementById('previewTitle');
  const info = document.getElementById('previewInfo');
  const headersRow = document.getElementById('previewHeaders');
  const tbody = document.getElementById('previewBody');
  
  title.textContent = `Preview ${type === 'staff' ? 'Staff' : 'Import'} (${rows.length} rows)`;
  info.textContent = `Showing ${Math.min(rows.length, 200)} of ${rows.length} rows. Click "Import All" to proceed.`;
  
  headersRow.innerHTML = '';
  tbody.innerHTML = '';
  
  if (rows.length === 0) {
    info.textContent = 'No rows to import';
    return;
  }
  
  const headers = Object.keys(rows[0]);
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headersRow.appendChild(th);
  });
  
  rows.slice(0, 200).forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = row[h] || '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  
  backdrop.style.display = 'flex';
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeImportPreview() {
  const backdrop = document.getElementById('importPreviewBackdrop');
  backdrop.style.display = 'none';
  backdrop.setAttribute('aria-hidden', 'true');
  importPreviewData = { type: '', rows: [] };
}

// Preview modal confirm handler
document.getElementById('previewConfirm').addEventListener('click', async () => {
  if (!importPreviewData.rows.length) return;
  closeImportPreview();
  const endpoint = '/api/import/staff';
  try {
    const res = await fetch(endpoint, { 
      method: 'POST', 
      headers: authHeaders(true), 
      body: JSON.stringify(importPreviewData.rows) 
    });
    if (res.ok) {
      showToast('Staff imported successfully', 'success');
      fetchStaff();
    } else {
      const d = await res.json();
      showToast(d.error || 'Import failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Import failed', 'error');
  }
});

document.getElementById('previewCancel').addEventListener('click', () => {
  closeImportPreview();
});

async function fetchStaff(){
  const res = await fetch('/api/staff', { headers: authHeaders(false) });
  if(!res.ok) return;
  const list = await res.json();
  const tbody = document.querySelector('#staffTable tbody');
  tbody.innerHTML = '';
  const q = document.getElementById('staffSearch').value.trim().toLowerCase();
  const filtered = list.filter(s => {
    if(!q) return true;
    return (s.name||'').toLowerCase().includes(q) || (s.staff_id||'').toLowerCase().includes(q) || (s.role||'').toLowerCase().includes(q);
  });
  filtered.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.staff_id}</td><td>${s.name}</td><td>${s.role}</td><td>${s.phone||''}</td><td>${s.email||''}</td><td><button data-id="${s.id}" class="btn edit">Edit</button> <button data-id="${s.id}" class="btn delete" style="background:#ef4444">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.btn.edit').forEach(b=> b.addEventListener('click', e=>{ openEditModal(e.target.getAttribute('data-id')) }));
  document.querySelectorAll('.btn.delete').forEach(b=> b.addEventListener('click', async (e)=>{
    const id = e.target.getAttribute('data-id');
    const ok = await showConfirm('Delete this staff record? This action cannot be undone.');
    if(!ok) return;
    await fetch('/api/staff/' + id, { method: 'DELETE', headers: authHeaders(false) });
    fetchStaff();
  }));
}

// Confirmation modal helper
function showConfirm(message){
  return new Promise(resolve => {
    const backdrop = document.getElementById('confirmBackdrop');
    const msg = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    msg.textContent = message;
    backdrop.style.display = 'flex';
    backdrop.setAttribute('aria-hidden','false');
    function cleanup(){
      backdrop.style.display = 'none';
      backdrop.setAttribute('aria-hidden','true');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    }
    function onOk(){ cleanup(); resolve(true); }
    function onCancel(){ cleanup(); resolve(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

function showModal(){
  document.getElementById('staffModal').style.display = 'block';
  document.getElementById('staffModal').setAttribute('aria-hidden','false');
}
function hideModal(){
  document.getElementById('staffModal').style.display = 'none';
  document.getElementById('staffModal').setAttribute('aria-hidden','true');
}

document.getElementById('showAdd').addEventListener('click', ()=>{
  document.getElementById('staffModalTitle').innerText = 'Add Staff';
  document.getElementById('editId').value = '';
  document.getElementById('staff_id').value = '';
  document.getElementById('name').value = '';
  document.getElementById('role').value = 'Teacher';
  document.getElementById('phone').value = '';
  document.getElementById('email').value = '';
  showModal();
});

document.getElementById('cancelStaff').addEventListener('click', ()=>{ hideModal(); });

async function openEditModal(id){
  const res = await fetch('/api/staff', { headers: authHeaders(false) });
  if(!res.ok) return;
  const list = await res.json();
  const item = list.find(x=> String(x.id) === String(id));
  if(!item) return showToast('Record not found', 'error');
  document.getElementById('staffModalTitle').innerText = 'Edit Staff';
  document.getElementById('editId').value = item.id;
  document.getElementById('staff_id').value = item.staff_id || '';
  document.getElementById('name').value = item.name || '';
  document.getElementById('role').value = item.role || 'Teacher';
  document.getElementById('phone').value = item.phone || '';
  document.getElementById('email').value = item.email || '';
  showModal();
}

document.getElementById('staffForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const payload = {
    staff_id: document.getElementById('staff_id').value.trim(),
    name: document.getElementById('name').value.trim(),
    role: document.getElementById('role').value,
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
  };
  if(!payload.staff_id || !payload.name){ showToast('Staff ID and Name are required', 'error'); return; }
  if(id){
    await fetch('/api/staff/' + id, { method: 'PUT', headers: authHeaders(true), body: JSON.stringify(payload) });
  } else {
    await fetch('/api/staff', { method: 'POST', headers: authHeaders(true), body: JSON.stringify(payload) });
  }
  hideModal();
  fetchStaff();
});

document.getElementById('staffSearch').addEventListener('input', ()=> fetchStaff());

document.getElementById('exportStaffCsv').addEventListener('click', async ()=>{
  const res = await fetch('/api/staff', { headers: authHeaders(false) });
  if(!res.ok) return alert('Failed to fetch staff');
  const list = await res.json();
  const csv = [ ['id','staff_id','name','role','phone','email'].join(',') ];
  list.forEach(r => csv.push([r.id, r.staff_id, `"${(r.name||'').replace(/"/g,'""')}"`, r.role, r.phone||'', r.email||''].join(',')));
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'staff.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Role-based UI: hide add/export for non-admins
const me = currentUser();
if(!(me && me.role && me.role.toLowerCase() === 'admin')){
  document.getElementById('showAdd').style.display = 'none';
  document.getElementById('exportStaffCsv').style.display = 'none';
}

// Allow server to support PUT for staff later; for now fetch list and show
fetchStaff();
