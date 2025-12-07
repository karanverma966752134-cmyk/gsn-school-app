document.addEventListener('DOMContentLoaded', function(){
  console.log('students.js: DOMContentLoaded — binding handlers');

let studentsListCache = [];
let pageSize = 20;
let currentPage = 1;

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

// Simple CSV parser (handles quoted fields)
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

// Preview modal helper
let importPreviewData = { type: '', rows: [] };
function showImportPreview(type, rows) {
  importPreviewData = { type, rows };
  const backdrop = document.getElementById('importPreviewBackdrop');
  const title = document.getElementById('previewTitle');
  const info = document.getElementById('previewInfo');
  const headersRow = document.getElementById('previewHeaders');
  const tbody = document.getElementById('previewBody');
  
  title.textContent = `Preview ${type === 'students' ? 'Students' : type === 'attendance' ? 'Attendance' : 'Import'} (${rows.length} rows)`;
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

// Students CSV import handler
document.getElementById('studentsFile').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const txt = await f.text();
  const rows = parseCSV(txt);
  if(!rows.length){ showToast('No rows found in CSV', 'error'); return; }
  showImportPreview('students', rows);
});

// Attendance CSV import handler
document.getElementById('attendanceFile').addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const txt = await f.text();
  const rows = parseCSV(txt);
  if(!rows.length){ showToast('No rows found in CSV', 'error'); return; }
  showImportPreview('attendance', rows);
});

// Preview modal confirm handler
document.getElementById('previewConfirm').addEventListener('click', async () => {
  if (!importPreviewData.rows.length) return;
  closeImportPreview();
  const endpoint = importPreviewData.type === 'students' ? '/api/import/students' : '/api/import/attendance';
  try {
    const res = await fetch(endpoint, { 
      method: 'POST', 
      headers: authHeaders(true), 
      body: JSON.stringify(importPreviewData.rows) 
    });
    if (res.ok) {
      showToast(`${importPreviewData.type === 'students' ? 'Students' : 'Attendance'} imported successfully`, 'success');
      if (importPreviewData.type === 'students') loadStudents();
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

async function loadStudents(filter){
  const res = await fetch('/api/students', { headers: authHeaders(false) });
  if(!res.ok) return;
  const list = await res.json();
  studentsListCache = list;
  applyStudentsRendering(filter || {});
}

function applyStudentsRendering(filter){
  const tbody = document.querySelector('#studentsTable tbody');
  tbody.innerHTML = '';
  // ensure headers include TC Verified column (if not already present)
  const thead = document.querySelector('#studentsTable thead');
  if (thead && thead.querySelectorAll('th').length < 8) {
    thead.querySelector('tr').innerHTML = '<th>Adm No</th><th>Name</th><th>Class</th><th>Section</th><th>Contact</th><th>Status</th><th>TC Verified</th><th>Actions</th>';
  }
  const q = document.getElementById('studentsSearch') ? document.getElementById('studentsSearch').value.trim().toLowerCase() : '';
  let filtered = studentsListCache.filter(s => {
    if(filter.cls && String(s.class) !== String(filter.cls)) return false;
    if(filter.section && String(s.section) !== String(filter.section)) return false;
    if(q){
      return (s.name||'').toLowerCase().includes(q) || (s.adm_no||'').toLowerCase().includes(q) || (s.class||'').toLowerCase().includes(q) || (s.section||'').toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if(currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  pageItems.forEach(s => {
    const tr = document.createElement('tr');
    tr.dataset.id = s.id;
    const tcChecked = s.tc_verified ? 'checked' : '';
    tr.innerHTML = `<td>${s.adm_no}</td><td class="editable" data-field="name">${s.name}</td><td>${s.class}</td><td>${s.section}</td><td>${s.contact||''}</td><td>${s.status||''}</td><td><input type="checkbox" class="tc-verify" data-id="${s.id}" ${tcChecked}></td><td><button class="btn edit">Edit</button> <button class="btn danger delete">Delete</button></td>`;
    tbody.appendChild(tr);
    tr.querySelector('.edit').addEventListener('click', ()=> openStudentModal(s));
      tr.querySelector('.delete').addEventListener('click', async ()=>{
        const ok = await showConfirm('Delete student record? This action cannot be undone.');
        if(!ok) return;
        await fetch('/api/students/' + s.id, { method: 'DELETE', headers: authHeaders(false) });
        loadStudents({cls: document.getElementById('filterClass').value.trim()||null, section: document.getElementById('filterSection').value.trim()||null});
      });
    // tc verify toggle handler
    const tcBox = tr.querySelector('.tc-verify');
    if(tcBox){
      tcBox.addEventListener('change', async (e)=>{
        const id = e.target.getAttribute('data-id');
        const val = e.target.checked ? 1 : 0;
        try{
          await fetch('/api/students/' + id, { method:'PUT', headers: authHeaders(true), body: JSON.stringify({ name: s.name, class: s.class, section: s.section, contact: s.contact, status: s.status, tc_verified: val }) });
          showToast('TC verification updated', 'success');
          // refresh cache minimally
          s.tc_verified = val;
        }catch(err){ console.error(err); showToast('Failed to update TC', 'error'); e.target.checked = !val; }
      });
    }
  });

  document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
}

document.getElementById('loadClass').addEventListener('click', ()=>{
  const cls = document.getElementById('filterClass').value.trim();
  const section = document.getElementById('filterSection').value.trim();
  currentPage = 1;
  applyStudentsRendering({cls: cls||null, section: section||null});
});

document.getElementById('prevPage').addEventListener('click', ()=>{ if(currentPage>1){ currentPage--; applyStudentsRendering({cls: document.getElementById('filterClass').value.trim()||null, section: document.getElementById('filterSection').value.trim()||null}); }});
document.getElementById('nextPage').addEventListener('click', ()=>{ currentPage++; applyStudentsRendering({cls: document.getElementById('filterClass').value.trim()||null, section: document.getElementById('filterSection').value.trim()||null}); });

document.getElementById('studentsSearch').addEventListener('input', ()=>{ currentPage = 1; applyStudentsRendering({cls: document.getElementById('filterClass').value.trim()||null, section: document.getElementById('filterSection').value.trim()||null}); });

document.getElementById('exportStudentsCsv').addEventListener('click', async ()=>{
  const res = await fetch('/api/students', { headers: authHeaders(false) }); if(!res.ok){ showToast('Failed to fetch students','error'); return; }
  const list = await res.json();
  const csv = [['adm_no','name','class','section','contact','status'].join(',')];
  list.forEach(r => csv.push([r.adm_no, `"${(r.name||'').replace(/"/g,'""')}"`, r.class, r.section, r.contact||'', r.status||''].join(',')));
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'students.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// UDISE+ export (CSV format)
document.getElementById('exportUdise').addEventListener('click', async ()=>{
  try{
    const res = await fetch('/api/students', { headers: authHeaders(false) }); if(!res.ok){ showToast('Failed to fetch students','error'); return; }
    const list = await res.json();
    // Build UDISE+ CSV export
    const csv = [['UDISE ID','Student Name','Class','Section','Contact','Status','TC Verified'].join(',')];
    list.forEach(s => {
      const row = [
        s.adm_no || '',
        `"${(s.name || '').replace(/"/g, '""')}"`,
        s.class || '',
        s.section || '',
        s.contact || '',
        s.status || '',
        s.tc_verified ? '1' : '0'
      ];
      csv.push(row.join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `udise-export-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('UDISE+ export generated (CSV)', 'success');
  }catch(err){ console.error(err); showToast('UDISE export failed', 'error'); }
});

document.getElementById('exportAttendanceCsv').addEventListener('click', async ()=>{
  const date = document.getElementById('attDate').value;
  const cls = document.getElementById('attClass').value.trim();
  const section = document.getElementById('attSection').value.trim();
  if(!date || !cls || !section){ showToast('Select date/class/section to export attendance','error'); return; }
  const res = await fetch(`/api/attendance?date=${encodeURIComponent(date)}&class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`, { headers: authHeaders(false) });
  if(!res.ok){ showToast('Failed to load attendance','error'); return; }
  const data = await res.json();
  // data is array of { student, attendance }
  const csv = [['adm_no','name','status','remark'].join(',')];
  data.forEach(row => csv.push([row.student.adm_no, `"${(row.student.name||'').replace(/"/g,'""')}"`, row.attendance?row.attendance.status:'', row.attendance?`"${(row.attendance.remark||'').replace(/"/g,'""')}`:''].join(',')));
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `attendance-${cls}-${section}-${date}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Role-based UI: hide add/export for non-admins
function currentUser(){ try{ return JSON.parse(localStorage.getItem('staff') || localStorage.getItem('user') || 'null'); }catch(e){ return null } }
const me = currentUser();
if(!(me && me.role && me.role.toLowerCase() === 'admin')){
  document.getElementById('showAddStudent').style.display = 'none';
  document.getElementById('exportStudentsCsv').style.display = 'none';
  document.getElementById('exportAttendanceCsv').style.display = 'none';
}

// Modal logic
async function openStudentModal(student){
  const modal = document.getElementById('studentModal');
  document.getElementById('modalTitle').textContent = student ? 'Edit Student' : 'Add Student';
  document.getElementById('mAdm').value = student ? student.adm_no : '';
  document.getElementById('mName').value = student ? student.name : '';
  document.getElementById('mClass').value = student ? student.class : '';
  document.getElementById('mSection').value = student ? student.section : '';
  document.getElementById('mContact').value = student ? (student.contact||'') : '';
  modal.style.display = 'block';
  modal.dataset.editId = student ? student.id : '';
  // Auto-generate admission number when adding a new student (not editing)
  if (!student) {
    try {
      const res = await fetch('/api/students/next-adm');
      if (res.ok) {
        const d = await res.json();
        document.getElementById('mAdm').value = d.adm_no || '';
      }
    } catch (err) {
      console.warn('Auto-generate adm failed:', err);
    }
  }
}

function closeStudentModal(){
  const modal = document.getElementById('studentModal');
  modal.style.display = 'none';
  modal.dataset.editId = '';
}

document.getElementById('showAddStudent').addEventListener('click', ()=> { console.log('students.js: showAddStudent clicked'); openStudentModal(null); });
document.getElementById('modalCancel').addEventListener('click', ()=> closeStudentModal());
document.getElementById('modalSave').addEventListener('click', async ()=>{
  console.log('students.js: modalSave clicked');
  const adm_no = document.getElementById('mAdm').value.trim();
  const name = document.getElementById('mName').value.trim();
  const cls = document.getElementById('mClass').value.trim();
  const section = document.getElementById('mSection').value.trim();
  const contact = document.getElementById('mContact').value.trim();
  if(!adm_no || !name || !cls || !section){ showToast('Please fill required fields', 'error'); return; }
  const modal = document.getElementById('studentModal');
  const editId = modal.dataset.editId;
  if(editId){
    // update
    await fetch('/api/students/' + editId, { method:'PUT', headers: authHeaders(true), body: JSON.stringify({ adm_no, name, class: cls, section, contact }) });
  } else {
    await fetch('/api/students', { method:'POST', headers: authHeaders(true), body: JSON.stringify({ adm_no, name, class: cls, section, contact, status:'Active' }) });
  }
  closeStudentModal();
  loadStudents();
});

// Generate admission number using server helper (manual button)
if(document.getElementById('genAdm')){
  document.getElementById('genAdm').addEventListener('click', async ()=>{
    try{
      const res = await fetch('/api/students/next-adm');
      if(!res.ok) throw new Error('Failed');
      const d = await res.json();
      document.getElementById('mAdm').value = d.adm_no || '';
      showToast('Admission number generated', 'success');
    }catch(err){ console.error(err); showToast('Could not generate admission number', 'error'); }
  });
}

// Attendance
document.getElementById('loadAttendance').addEventListener('click', async ()=>{
  console.log('students.js: loadAttendance clicked');
  const date = document.getElementById('attDate').value;
  const cls = document.getElementById('attClass').value.trim();
  const section = document.getElementById('attSection').value.trim();
  if(!date || !cls || !section){ showToast('Please provide date, class and section', 'error'); return; }
  // load students for class/section
  const res = await fetch('/api/students', { headers: authHeaders(false) });
  const students = await res.json();
  const list = students.filter(s => String(s.class) === String(cls) && String(s.section) === String(section));
  const tbody = document.querySelector('#attendanceTable tbody');
  tbody.innerHTML = '';
  // try to load existing attendance
  const attRes = await fetch(`/api/attendance?date=${encodeURIComponent(date)}&class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`, { headers: authHeaders(false) });
  let attMap = {};
  if(attRes.ok){
    const att = await attRes.json();
    att.forEach(a => { attMap[a.student_id] = a; });
  }
  list.forEach(s => {
    const tr = document.createElement('tr');
    const present = attMap[s.id] ? (attMap[s.id].status === 'Present') : true;
    tr.innerHTML = `<td>${s.name}</td><td>${s.adm_no}</td><td><input class="att-checkbox" type="checkbox" data-id="${s.id}" ${present? 'checked':''}></td><td><input data-id-remark="${s.id}" placeholder="Remark" value="${attMap[s.id]?attMap[s.id].remark:''}"></td>`;
    tbody.appendChild(tr);
  });
});

document.getElementById('saveAttendance').addEventListener('click', async ()=>{
  console.log('students.js: saveAttendance clicked');
  const date = document.getElementById('attDate').value;
  const cls = document.getElementById('attClass').value.trim();
  const section = document.getElementById('attSection').value.trim();
  if(!date || !cls || !section){ showToast('Please provide date, class and section','error'); return; }
  const rows = Array.from(document.querySelectorAll('#attendanceTable tbody tr'));
  const records = rows.map(r => {
    const id = r.querySelector('.att-checkbox').getAttribute('data-id');
    const checked = r.querySelector('.att-checkbox').checked;
    const remark = r.querySelector('input[placeholder]') ? r.querySelector('input[placeholder]').value : '';
    return { student_id: Number(id), status: checked? 'Present' : 'Absent', remark };
  });
  const res = await fetch('/api/attendance', { method:'POST', headers: authHeaders(true), body: JSON.stringify({ date, records }) });
  if(res.ok){ showToast('Attendance saved', 'success'); } else { showToast('Error saving attendance', 'error'); }
});

// Bulk attendance buttons
document.getElementById('markAllPresent').addEventListener('click', ()=>{
  console.log('students.js: markAllPresent clicked');
  document.querySelectorAll('.att-checkbox').forEach(cb=> cb.checked = true);
});
document.getElementById('markAllAbsent').addEventListener('click', ()=>{
  console.log('students.js: markAllAbsent clicked');
  document.querySelectorAll('.att-checkbox').forEach(cb=> cb.checked = false);
});
document.getElementById('clearAttendance').addEventListener('click', ()=>{
  const tbody = document.querySelector('#attendanceTable tbody'); tbody.innerHTML = '';
});

// initial load
loadStudents();

// Confirmation modal helper (shared)
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

// ===== FEES MANAGEMENT =====
let feesListCache = [];
let selectedFeeStudentId = null;

async function loadFees() {
  const res = await fetch('/api/fees', { headers: authHeaders(false) });
  if (!res.ok) return;
  feesListCache = await res.json();
  renderFeesList();
}

function renderFeesList(searchQuery = '') {
  const tbody = document.querySelector('#feesTable tbody');
  tbody.innerHTML = '';
  
  let filtered = feesListCache;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = feesListCache.filter(f => 
      (f.student.name || '').toLowerCase().includes(q) || 
      (f.student.adm_no || '').toLowerCase().includes(q)
    );
  }
  
  filtered.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.student.adm_no}</td>
      <td>${f.student.name}</td>
      <td>${f.student.class}${f.student.section ? '-' + f.student.section : ''}</td>
      <td>${f.last_paid_month || 'N/A'}</td>
      <td>₹${f.balance || 0}</td>
      <td><button class="btn" data-student-id="${f.student_id}" data-student-name="${f.student.name}">Pay</button></td>
    `;
    tbody.appendChild(tr);
    
    tr.querySelector('button').addEventListener('click', (e) => {
      selectedFeeStudentId = e.target.getAttribute('data-student-id');
      openFeesModal(f.student.name, f.balance);
    });
  });
}

function openFeesModal(studentName, pendingAmount) {
  const modal = document.getElementById('feesModal');
  document.getElementById('feesStudentName').textContent = studentName;
  document.getElementById('feesPendingAmount').textContent = '₹' + (pendingAmount || 0);
  document.getElementById('feesAmount').value = '';
  document.getElementById('feesMonth').valueAsDate = new Date();
  document.getElementById('feesMode').value = 'Cash';
  document.getElementById('feesNotes').value = '';
  modal.style.display = 'flex';
  // Load payments history for this student
  try {
    if (selectedFeeStudentId) loadPaymentsForStudent(selectedFeeStudentId);
  } catch (e) {
    console.error('Error loading payments on modal open', e);
  }
}

// Fetch payments history for a student and show a simple list
async function loadPaymentsForStudent(studentId) {
  try {
    const res = await fetch(`/api/payments?student_id=${encodeURIComponent(studentId)}`, { headers: authHeaders(false) });
    if (!res.ok) { showToast('Failed to load payments', 'error'); return; }
    const rows = await res.json();
    // show in receipt modal area (append a small history section)
    let html = '<div style="max-height:220px;overflow:auto;margin-top:8px"><table style="width:100%;font-size:13px"><thead><tr><th>Date</th><th>Amount</th><th>Month</th><th>Mode</th></tr></thead><tbody>';
    rows.forEach(r => {
      html += `<tr><td>${r.created_at}</td><td>₹${Number(r.amount).toFixed(2)}</td><td>${r.month||'-'}</td><td>${r.mode||'-'}</td></tr>`;
    });
    html += '</tbody></table></div>';
    // inject into fees modal below existing fields
    const modal = document.getElementById('feesModal');
    let historyEl = document.getElementById('feesHistory');
    if (!historyEl) {
      historyEl = document.createElement('div');
      historyEl.id = 'feesHistory';
      const container = modal.querySelector('.modal');
      container.insertBefore(historyEl, container.querySelector('div[style*="display:flex;gap:8px;margin-top:12px;justify-content:flex-end"]'));
    }
    historyEl.innerHTML = `<h4 style="margin:8px 0 6px">Payments History</h4>${html}`;
  } catch (err) {
    console.error('Load payments error', err);
    showToast('Error loading payments', 'error');
  }
}

function closeFeesModal() {
  document.getElementById('feesModal').style.display = 'none';
  selectedFeeStudentId = null;
}

function generateReceiptNo() {
  return 'RCP-' + new Date().getFullYear() + '-' + String(Math.random()).slice(2, 8).padStart(6, '0');
}

async function recordFeePayment() {
  if (!selectedFeeStudentId) return;
  const amount = parseFloat(document.getElementById('feesAmount').value);
  const month = document.getElementById('feesMonth').value;
  const mode = document.getElementById('feesMode').value;
  const notes = document.getElementById('feesNotes').value;
  
  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }
  
  if (!month) {
    showToast('Please select a month', 'error');
    return;
  }
  
  // Find student data for receipt
  const feeRecord = feesListCache.find(f => f.student_id == selectedFeeStudentId);
  if (!feeRecord) return;
  
  // Persist payment to server
  try {
    const res = await fetch('/api/fees', { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ student_id: selectedFeeStudentId, amount, month, mode, notes }) });
    if (!res.ok) {
      const d = await res.json().catch(()=>({}));
      showToast(d.error || 'Payment failed', 'error');
      return;
    }
    const d = await res.json();
    closeFeesModal();

    // Use server-updated fees to compute remaining balance
    const updated = d.fees || {};
    const remainingBalance = Number(updated.balance || 0);
    const receiptNo = generateReceiptNo();
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const monthStr = month ? new Date(month).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : (updated.last_paid_month || '');

    document.getElementById('receiptNo').textContent = receiptNo;
    document.getElementById('receiptDate').textContent = dateStr;
    document.getElementById('receiptStudentName').textContent = feeRecord.student.name;
    document.getElementById('receiptAdmNo').textContent = feeRecord.student.adm_no;
    document.getElementById('receiptClassSection').textContent = feeRecord.student.class + '-' + feeRecord.student.section;
    document.getElementById('receiptMonth').textContent = monthStr;
    document.getElementById('receiptAmount').textContent = amount.toFixed(2);
    document.getElementById('receiptTotal').textContent = amount.toFixed(2);
    document.getElementById('receiptMode').textContent = mode;
    document.getElementById('receiptBalance').textContent = remainingBalance.toFixed(2);

    document.getElementById('receiptModal').style.display = 'flex';
    window.currentReceipt = { receiptNo, dateStr, studentName: feeRecord.student.name, admNo: feeRecord.student.adm_no, classSection: feeRecord.student.class + '-' + feeRecord.student.section, month: monthStr, amount: amount.toFixed(2), mode, balance: remainingBalance.toFixed(2), paymentId: d.paymentId };

    // Refresh fees list
    loadFees();
    showToast('Payment recorded', 'success');
  } catch (err) {
    console.error('Record payment error', err);
    showToast('Payment failed', 'error');
  }
}

function printReceipt() {
  const content = document.getElementById('receiptContent').innerHTML;
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Fee Receipt - ' + (window.currentReceipt?.receiptNo || 'Receipt') + '</title><style>body{font-family:serif;margin:20px;background:white}@media print{body{margin:0}}</style></head><body>' + content + '</body></html>');
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 250);
}

function downloadReceiptPDF() {
  // Using a simple HTML to PDF approach via print-to-file
  // For production, consider using a library like jsPDF or html2pdf
  const content = document.getElementById('receiptContent').innerHTML;
  const receiptNo = window.currentReceipt?.receiptNo || 'receipt';
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Fee Receipt - ${receiptNo}</title>
  <style>
    body { font-family: serif; margin: 40px; background: white; color: black; }
    @page { size: A4; margin: 20mm; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  
  // Create blob and download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${receiptNo}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Also offer to print to PDF directly
  setTimeout(() => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Fee Receipt</title><style>@media print{body{margin:0}}</style></head><body style="font-family:serif;margin:20px">' + content + '</body></html>');
    printWindow.document.close();
    showToast('Use your browser\'s "Print to PDF" feature to save as PDF', 'success');
  }, 500);
}


function closeReceiptModal() {
  document.getElementById('receiptModal').style.display = 'none';
}

document.getElementById('feesModalCancel').addEventListener('click', ()=>{ console.log('students.js: feesModalCancel clicked'); closeFeesModal(); });
document.getElementById('feesModalSave').addEventListener('click', ()=>{ console.log('students.js: feesModalSave clicked'); recordFeePayment(); });
document.getElementById('printReceipt').addEventListener('click', printReceipt);
document.getElementById('closeReceipt').addEventListener('click', closeReceiptModal);
const downloadBtn = document.getElementById('downloadReceipt');
if (downloadBtn) {
  downloadBtn.addEventListener('click', downloadReceiptPDF);
}

document.getElementById('feesSearch').addEventListener('input', (e) => {
  renderFeesList(e.target.value);
});

document.getElementById('showFeesModal').addEventListener('click', () => {
  console.log('students.js: showFeesModal clicked');
  if (feesListCache.length === 0) {
    showToast('No students found', 'error');
    return;
  }
  const firstFee = feesListCache[0];
  selectedFeeStudentId = firstFee.student_id;
  openFeesModal(firstFee.student.name, firstFee.balance);
});

// Load fees on page load
loadFees();

// ===== CUSTOM RECEIPT BUILDER =====
function generateReceiptNo() {
  return 'RCP-' + Date.now();
}

document.getElementById('showCustomReceipt').addEventListener('click', () => {
  document.getElementById('customReceiptModal').style.display = 'flex';
});

document.getElementById('cancelCustomReceipt').addEventListener('click', () => {
  document.getElementById('customReceiptModal').style.display = 'none';
});

document.getElementById('generateCustomReceipt').addEventListener('click', () => {
  const studentName = document.getElementById('crStudentName').value.trim();
  const admNo = document.getElementById('crAdmNo').value.trim();
  const classSection = document.getElementById('crClassSection').value.trim();
  const description = document.getElementById('crDescription').value.trim();
  const amount = document.getElementById('crAmount').value.trim();
  const mode = document.getElementById('crMode').value;
  const balance = document.getElementById('crBalance').value.trim();

  if (!studentName || !admNo || !classSection || !description || !amount) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  // Close the builder modal
  document.getElementById('customReceiptModal').style.display = 'none';

  // Generate and populate receipt
  const receiptNo = generateReceiptNo();
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' });

  document.getElementById('receiptNo').textContent = receiptNo;
  document.getElementById('receiptDate').textContent = dateStr;
  document.getElementById('receiptStudentName').textContent = studentName;
  document.getElementById('receiptAdmNo').textContent = admNo;
  document.getElementById('receiptClassSection').textContent = classSection;
  document.getElementById('receiptMonth').textContent = description;
  document.getElementById('receiptAmount').textContent = parseFloat(amount).toFixed(2);
  document.getElementById('receiptTotal').textContent = parseFloat(amount).toFixed(2);
  document.getElementById('receiptMode').textContent = mode;
  document.getElementById('receiptBalance').textContent = parseFloat(balance || 0).toFixed(2);

  // Store current receipt info for print/download
  window.currentReceipt = { receiptNo, dateStr, studentName, admNo, classSection, description, amount: parseFloat(amount).toFixed(2), mode, balance: parseFloat(balance || 0).toFixed(2) };

  // Show receipt modal
  document.getElementById('receiptModal').style.display = 'flex';
  showToast('Receipt generated', 'success');
});

});
