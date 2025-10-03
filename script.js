import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    addDoc, collection, deleteDoc, doc, getDoc, getDocs,
    getFirestore, onSnapshot, orderBy, query, serverTimestamp,
    setDoc, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================
   Firebase
========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyC8vB6emYJp9OVumvz7YrfMU0xLg1Pv-Go",
    authDomain: "studio-donna-f7579.firebaseapp.com",
    projectId: "studio-donna-f7579",
    storageBucket: "studio-donna-f7579.appspot.com",
    messagingSenderId: "542780214223",
    appId: "1:542780214223:web:e330e29fcbb2b670f8e0ba",
    measurementId: "G-TBZPL44ZGR",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================================
   Globais / DOM
========================================= */
const $ = (s) => document.querySelector(s);
let allClients = [];
let reportCache = [];
let reportsChartInstance = null;

const SERVICES_LIST = [
    { name: 'Sobrancelha', price: 30.00 },
    { name: 'Acabamento ', price: 20.00 },
    { name: 'Maquina e Tesoura', price: 40.00 },
    { name: 'Corte Maquina', price: 40.00 },
    { name: 'Corte Tesoura', price: 50.00 },
    { name: 'Alisamento Americano', price: 50.00 },
    { name: 'Corte Infantil', price: 50.00 },
    { name: 'Blindado', price: 60.00 },
    { name: 'Corte + Barba + Alisamento Prime', price: 150.00 },
    { name: "Outro", price: 0 },
];
const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito"];
const BOOKING_URL = "https://barbearia-vitrine.vercel.app/";

const mainContents = document.querySelectorAll("main");
const tabBtns = document.querySelectorAll(".tab-btn");

const clientForm = $("#clientForm"),
    clientTableBody = $("#clientTableBody"),
    clientSearch = $("#clientSearch"),
    paymentsTableBody = $("#paymentsTableBody"),
    clientTypeSelect = $("#clientType"),
    clientValueField = $("#clientValueField"),
    clientPayDayField = $("#clientPayDayField"),
    saveClientBtn = $("#saveClientBtn"),
    clientNameInput = $("#clientName"),
    clientFilterButtons = document.querySelectorAll(".filter-tab-btn");

const agendaGrid = $("#agenda-grid"),
    profissionalSelect = $("#profissionalSelect"),
    dataFiltro = $("#dataFiltro"),
    horaFiltro = $("#horaFiltro"),
    buscarBtn = $("#buscarBtn"),
    bloquearBtn = $("#bloquearBtn"),
    desbloquearBtn = $("#desbloquearBtn");

const relProf = $("#relProf"),
    relDe = $("#relDe"),
    relAte = $("#relAte"),
    relGerarBtn = $("#relGerarBtn"),
    exportCsv = $("#exportCsv"),
    relDetalheTbody = $("#relDetalheTbody"),
    kpiQtd = $("#kpiQtd"),
    kpiBruto = $("#kpiBruto"),
    kpiTicket = $("#kpiTicket");

/* =========================================
   Helpers
========================================= */
const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString("pt-BR") : "—";
const ymdToDateStr = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const showNotification = (message, type = "success") => {
    const container = $("#notification-container"), el = document.createElement("div");
    el.className = `notification ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};
const capitalizeName = (name) => !name ? "" :
    name.trim().toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    const d = phone.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
};
const normalize = (s) => (s || "").toString().trim().toLowerCase();

/* =========================================
   Clientes
========================================= */
const validateClientForm = () => {
    const hasName = clientNameInput.value.trim().length >= 1;
    saveClientBtn.disabled = !hasName;
};
clientNameInput.addEventListener("input", validateClientForm);

clientTypeSelect.addEventListener("change", () => {
    const isPlan = clientTypeSelect.value === "plano_jc";
    clientValueField.classList.toggle("hidden-block", !isPlan);
    clientPayDayField.classList.toggle("hidden-block", !isPlan);
    if (!isPlan) {
        $("#clientValue").value = "";
        $("#clientPayDay").value = "";
    }
    validateClientForm();
});

clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = $("#clientType").value; // 'cliente' | 'plano_jc'
    const base = {
        name: capitalizeName($("#clientName").value),
        type,
        status: $("#clientStatus").value,
        createdAt: serverTimestamp(),
    };

    if (!base.name) {
        showNotification("Nome é obrigatório.", "error");
        return;
    }

    const rawPhone = $("#clientPhone").value.trim();
    if (rawPhone) base.phone = formatPhoneNumber(rawPhone);

    if (type === "plano_jc") {
        const val = Number.parseFloat($("#clientValue").value);
        const day = Number.parseInt($("#clientPayDay").value, 10);

        if (Number.isNaN(val) || val <= 0) {
            showNotification("Informe um valor mensal válido para o Plano.", "error");
            return;
        }
        if (!Number.isInteger(day) || day < 1 || day > 31) {
            showNotification("Informe um dia de pagamento válido (1–31).", "error");
            return;
        }
        base.value = val;
        base.payDay = day;
    }

    try {
        await addDoc(collection(db, "clientes"), base);
        showNotification("Cliente salvo!");
        clientForm.reset();
        clientTypeSelect.dispatchEvent(new Event("change"));
        validateClientForm();
    } catch (err) {
        console.error("[clientes:create]", err);
        showNotification("Erro ao salvar cliente. Veja o console.", "error");
    }
});

const applyClientFilters = () => {
    const s = clientSearch.value.toLowerCase();
    const typeFilter = document.querySelector(".filter-tab-btn.active").dataset.filter;
    const filtered = allClients.filter((c) =>
        (c.name.toLowerCase().includes(s) || (c.phone || "").toLowerCase().includes(s)) &&
        (typeFilter === "all" || c.type === typeFilter)
    );
    renderClients(filtered);
};

const renderClients = (clients) => {
    const html =
        clients.map((c) => `
      <tr data-client-id="${c.id}" data-client-status="${c.status}" data-client-type="${c.type}">
        <td data-label="Nome">
          <strong>${c.name}</strong><br>
          <small style="color:var(--text-light)">${c.type === "plano_jc"
                ? `Plano: ${formatCurrency(c.value || 0)} · Dia ${c.payDay || "—"}`
                : "Avulso"}</small>
        </td>
        <td data-label="Telefone">${c.phone || "—"}</td>
        <td data-label="Tipo">${c.type === "plano_jc" ? "Plano" : "Avulso"}</td>
        <td data-label="Status"><span class="badge ${c.status}">${c.status}</span></td>
        <td data-label="Ações">
          <div class="actions">
            <button class="btn btn-sm btn-edit" data-action="edit"><i class='bx bx-edit'></i></button>
            <button class="btn btn-sm ${c.status === "ativo" ? "btn-warning" : "btn-success"}" data-action="toggle-status"><i class='bx ${c.status === "ativo" ? "bx-pause" : "bx-play"}'></i></button>
            ${c.type === "plano_jc" && c.status === "ativo" ? `<button class="btn btn-sm btn-success" data-action="pay"><i class='bx bx-dollar'></i></button>` : ""}
            ${c.type === "cliente" ? `<button class="btn btn-sm btn-del" data-action="delete"><i class='bx bx-trash'></i></button>` : ""}
          </div>
        </td>
      </tr>`).join("");
    clientTableBody.innerHTML = html || `<tr><td colspan="5" class="loading-row">Nenhum cliente.</td></tr>`;
};

clientSearch.addEventListener("input", applyClientFilters);
clientFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        clientFilterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyClientFilters();
    });
});

const updateClientKPIs = () => {
    const activePlanMembers = allClients.filter((c) => c.type === "plano_jc" && c.status === "ativo");
    $("#activeMembers").textContent = activePlanMembers.length;
    $("#estimatedRevenue").textContent = formatCurrency(activePlanMembers.reduce((s, c) => s + (c.value || 0), 0));
};

/* =========================================
   Agenda — somente por PROFISSIONAL
========================================= */
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const timeOrder = (a, b) => {
    const ia = HOURS.indexOf(a), ib = HOURS.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
};
const getHourKey = (a) => {
    const raw = a.hora || a.time || a.horario || "";
    const m = String(raw).match(/^\s*(\d{1,2}):?(\d{2})\s*$/);
    if (!m) return String(raw) || "";
    return `${m[1].padStart(2, "0")}:${m[2]}`;
};
const getCorrectedAppointment = (appointmentData) => {
    const corrected = { ...appointmentData };
    const servicoNome = corrected.servico || "—";
    const servicoValor = corrected.valor || 0;
    if ((!servicoValor || servicoValor === 0) && typeof servicoNome === "string") {
        const m = servicoNome.match(/R\$\s*(\d+[,.]?\d*)/);
        if (m && m[1]) {
            corrected.valor = Number.parseFloat(m[1].replace(",", "."));
            corrected.servico = servicoNome.substring(0, m.index).trim();
        }
    }
    return corrected;
};

/* === consultas no Firestore (apenas por profissional) === */

// coleção do painel
async function fetchAgendamentosByProf(profLabel) {
    const profKey = normalize(profLabel);
    const col = collection(db, "agendamentos");

    // preferir o campo normalizado
    let snap = await getDocs(query(col, where("profissionalKey", "==", profKey)));
    if (!snap.empty) return snap.docs.map(d => ({ id: d.id, __src: "ag", ...d.data() }));

    // fallback: campo "profissional"
    snap = await getDocs(query(col, where("profissional", "==", profLabel)));
    return snap.docs.map(d => ({ id: d.id, __src: "ag", ...d.data() }));
}

// coleção do site (apenas uma coleção agora)
async function fetchReservasByProf(profLabel) {
    const ref = collection(db, "reservas_profissional");
    const snap = await getDocs(query(ref, where("profissional", "==", profLabel)));
    return snap.docs.map(d => ({ id: d.id, __src: "res", __coll: "reservas_profissional", ...d.data() }));
}

/* === render grade estilo do print === */
function renderAgendaGrid(items) {
    const byTime = {};
    for (const it of items) {
        const h = getHourKey(it) || "—";
        (byTime[h] ||= []).push(it);
    }
    const times = Object.keys(byTime);
    const baseHours = Array.from(new Set([...HOURS, ...times])).sort(timeOrder);

    const html = baseHours.map((hour) => {
        const arr = byTime[hour] || [];
        const isBlocked = arr.some(a => a.bloqueado);

        let content = `<div class="timeslot-empty" data-action="schedule" data-time="${hour}">+ Agendar Horário</div>`;

        if (isBlocked) {
            content = `<div class="timeslot-empty" style="cursor:not-allowed; color: var(--text-light); background: transparent; border-style: solid;">
        <strong>Horário Bloqueado</strong>
      </div>`;
        } else if (arr.length > 0) {
            content = arr.map((r) => {
                const corr = getCorrectedAppointment(r);
                const nome = corr.clienteNome || corr.nome || corr.cliente || "—";
                const desc = corr.servico
                    ? `${corr.servico}${typeof corr.valor === "number" ? ` (${formatCurrency(corr.valor)})` : ""}${corr.pagamentoForma ? ` · ${corr.pagamentoForma}` : ""}`
                    : (corr.telefone ? `Tel: ${corr.telefone}` : "—");
                const dataset = r.__src === "res"
                    ? `data-source="res" data-coll="${r.__coll}" data-id="${r.id}"`
                    : `data-source="ag" data-id="${r.id}"`;

                return `
          <div class="appointment-card" style="background:#fceaea;">
            <div class="appointment-info">
              <strong>${nome}</strong><br>
              <span>${desc}</span>
            </div>
            <div class="actions">
              <button class="btn btn-sm btn-edit" data-action="edit-any" ${dataset}><i class='bx bx-edit'></i></button>
              <button class="btn btn-sm btn-del"  data-action="del-any"  ${dataset}><i class='bx bx-trash'></i></button>
            </div>
          </div>`;
            }).join("");
        }

        return `
      <div class="timeslot">
        <div class="timeslot-time">${hour}</div>
        <div class="timeslot-content">${content}</div>
      </div>`;
    }).join("");

    const footer = `
    <div class="card" style="margin-top:16px;border:1px dashed var(--border);background:#fff;padding:12px;border-radius:12px;">
      <div style="display:flex;justify-content:flex-start">
        <button id="openBookingModal" class="btn" style="display:inline-flex;gap:8px;align-items:center">
          <i class='bx bx-calendar-event'></i> Ir para Agendamentos
        </button>
      </div>
    </div>`;

    agendaGrid.innerHTML = html + footer;
}

/* === Buscar (somente por profissional) + filtros locais data/hora === */
async function buscarAgenda() {
    const prof = profissionalSelect.value;
    const ymd = dataFiltro.value || "";
    const hh = horaFiltro.value || "";
    if (!prof) return;

    agendaGrid.innerHTML = `
    <div class="loading-row" style="background:#fff;border-radius:12px;border:1px solid var(--border);">
      Carregando agenda do(a) ${prof}...
    </div>`;

    try {
        const [ag, res] = await Promise.all([
            fetchAgendamentosByProf(prof),
            fetchReservasByProf(prof),
        ]);

        const filtered = [...ag, ...res].filter((it) => {
            const okDate = !ymd ? true : normalize(it.dataISO || it.data) === normalize(ymd);
            const okHour = !hh ? true : getHourKey(it) === hh;
            return okDate && okHour;
        });

        renderAgendaGrid(filtered);
    } catch (e) {
        console.error(e);
        agendaGrid.innerHTML = `<div class="loading-row">Erro ao carregar agenda.</div>`;
    }
}

/* =========================================
   Editar / Apagar (suporta agendamentos e reservas_profissional)
========================================= */
const mainModal = {
    el: $("#mainModal"),
    title: $("#modalTitle"),
    body: $("#modalBody"),
    footer: $("#modalFooter"),
    show(cfg) {
        this.title.textContent = cfg.title || "";
        this.body.innerHTML = cfg.body || "";
        this.footer.innerHTML = "";
        (cfg.buttons || []).forEach((b) => {
            const btn = document.createElement("button");
            btn.className = `btn ${b.class || ""}`;
            btn.innerHTML = b.text || "";
            if (b.style) Object.assign(btn.style, b.style);
            btn.onclick = () => {
                if (b.onClick) {
                    const r = b.onClick();
                    if (r === false) return;
                }
                this.hide();
            };
            this.footer.appendChild(btn);
        });
        this.el.classList.add("show");
    },
    hide() { this.el.classList.remove("show"); }
};
$("#modalClose").addEventListener("click", () => mainModal.hide());
mainModal.el.addEventListener("click", (e) => { if (e.target === mainModal.el) mainModal.hide(); });

async function openEditAny(source, id, collOpt) {
    if (source === "ag") {
        const ref = doc(db, "agendamentos", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return showNotification("Agendamento não encontrado.", "error");
        const data = getCorrectedAppointment(snap.data());

        const HOURS_OPTS = HOURS.map(h => `<option ${h === (data.hora || "") ? "selected" : ""}>${h}</option>`).join("");
        const PAYMENT_OPTS = PAYMENT_METHODS.map(p => `<option ${p === (data.pagamentoForma ?? "") ? "selected" : ""}>${p}</option>`).join("");

        mainModal.show({
            title: "Editar Agendamento",
            body: `
        <div class="form-grid">
          <div class="field"><label>Cliente</label><input id="modalEditCliente" value="${data.clienteNome || ""}"></div>
          <div class="form-row">
            <div class="field"><label>Data</label><input type="date" id="modalEditDate" value="${data.dataISO || ""}"></div>
            <div class="field"><label>Hora</label><select id="modalEditTime">${HOURS_OPTS}</select></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Valor (R$)</label><input type="number" id="modalEditValor" value="${data.valor || 0}" step="0.01"></div>
            <div class="field"><label>Forma de Pagamento</label><select id="modalEditPaymentMethod">${PAYMENT_OPTS}</select></div>
          </div>
        </div>`,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Salvar", class: "btn-primary", onClick: async () => {
                        try {
                            await updateDoc(ref, {
                                clienteNome: capitalizeName($("#modalEditCliente").value),
                                dataISO: $("#modalEditDate").value,
                                hora: $("#modalEditTime").value,
                                valor: Number.parseFloat($("#modalEditValor").value) || 0,
                                pagamentoForma: $("#modalEditPaymentMethod").value,
                            });
                            showNotification("Agendamento atualizado!");
                            buscarAgenda();
                        } catch (err) {
                            console.error(err); showNotification("Erro ao atualizar.", "error"); return false;
                        }
                    }
                }
            ]
        });
    } else {
        // ==== RESERVA (reservas_profissional) – COM SERVIÇO/VALOR/FORMA ====
        const ref = doc(db, collOpt, id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return showNotification("Reserva não encontrada.", "error");
        const d = snap.data();

        const HOURS_OPTS = HOURS.map(h => `<option ${h === (d.hora || "") ? "selected" : ""}>${h}</option>`).join("");
        const PAYMENT_OPTS = PAYMENT_METHODS.map(p => `<option ${p === (d.pagamentoForma ?? "") ? "selected" : ""}>${p}</option>`).join("");

        mainModal.show({
            title: "Editar Reserva",
            body: `
        <div class="form-grid">
          <div class="field"><label>Nome</label><input id="rNome" value="${d.nome || ""}"></div>

          <div class="form-row">
            <div class="field"><label>Data</label><input type="date" id="rData" value="${d.data || ""}"></div>
            <div class="field"><label>Hora</label><select id="rHora">${HOURS_OPTS}</select></div>
          </div>

          <div class="field"><label>Telefone</label><input id="rTel" value="${d.telefone || ""}"></div>

          <div class="field"><label>Serviço</label>
            <input id="rServico" placeholder="Ex.: Design de Sobrancelha" value="${d.servico || ""}">
          </div>

          <div class="form-row">
            <div class="field"><label>Valor (R$)</label>
              <input type="number" step="0.01" id="rValor" value="${(typeof d.valor === "number" ? d.valor : "")}">
            </div>
            <div class="field"><label>Forma de Pagamento</label>
              <select id="rForma">${PAYMENT_OPTS}</select>
            </div>
          </div>
        </div>`,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Salvar", class: "btn-primary", onClick: async () => {
                        const payload = {
                            nome: $("#rNome").value.trim(),
                            data: $("#rData").value,
                            hora: $("#rHora").value,
                            telefone: $("#rTel").value.trim(),
                        };

                        const serv = $("#rServico").value.trim();
                        if (serv) payload.servico = serv;

                        const valorStr = $("#rValor").value;
                        const val = Number.parseFloat(valorStr);
                        if (!Number.isNaN(val)) payload.valor = val;

                        const forma = $("#rForma").value;
                        if (forma) payload.pagamentoForma = forma;

                        try {
                            await updateDoc(ref, payload);
                            showNotification("Reserva atualizada!");
                            buscarAgenda();
                        } catch (err) {
                            console.error(err); showNotification("Erro ao atualizar.", "error"); return false;
                        }
                    }
                }
            ]
        });
    }
}

async function deleteAny(source, id, collOpt) {
    mainModal.show({
        title: "Remover",
        body: `<p>Tem certeza que deseja excluir este registro?</p>`,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            {
                text: "Confirmar", class: "btn-del", onClick: async () => {
                    try {
                        if (source === "ag") await deleteDoc(doc(db, "agendamentos", id));
                        else await deleteDoc(doc(db, collOpt, id)); // reservas_profissional
                        showNotification("Excluído.");
                        buscarAgenda();
                    } catch (err) {
                        console.error(err); showNotification("Erro ao excluir.", "error"); return false;
                    }
                }
            }
        ]
    });
}

agendaGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "schedule") return;

    const source = btn.dataset.source; // "ag" | "res"
    const id = btn.dataset.id;
    const coll = btn.dataset.coll || null;

    if (action === "edit-any") openEditAny(source, id, coll);
    if (action === "del-any") deleteAny(source, id, coll);
});

/* =========================================
   Relatórios / Pagamentos
========================================= */
const renderReportChart = (data) => {
    const ctx = document.getElementById("reportsChart").getContext("2d");
    const revenueByService = new Map();
    data.forEach((i) => {
        const s = i.servico || "Não especificado";
        revenueByService.set(s, (revenueByService.get(s) || 0) + (Number(i.valor) || 0));
    });
    const labels = [...revenueByService.keys()];
    const values = [...revenueByService.values()];

    if (reportsChartInstance) reportsChartInstance.destroy();
    const legendContainer = document.getElementById("reportsChartLegend"); legendContainer.innerHTML = "";

    // eslint-disable-next-line no-undef
    reportsChartInstance = new Chart(ctx, {
        type: "pie",
        data: { labels, datasets: [{ label: "Faturamento", data: values, backgroundColor: ["#374151", "#6D5D6E", "#929AAB", "#e5e7eb", "#ef4444", "#f59e0b", "#10b981", "#3b82f6"], hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: true, plugins: {
                legend: { display: false }, tooltip: {
                    callbacks: {
                        label: (c) => {
                            const label = c.label || ""; const v = c.parsed || 0;
                            const total = c.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "0%";
                            return `${label}: ${formatCurrency(v)} (${p})`;
                        }
                    }
                }
            }
        }
    });

    reportsChartInstance.data.labels.forEach((label, idx) => {
        const color = reportsChartInstance.data.datasets[0].backgroundColor[idx % reportsChartInstance.data.datasets[0].backgroundColor.length];
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `<span class="legend-color-box" style="background-color:${color}"></span><span>${label}</span>`;
        legendContainer.appendChild(item);
    });
};

// helper para filtrar por intervalo de datas (strings YYYY-MM-DD)
const isInISODateRange = (d, de, ate) => {
    if (!d) return false;
    const ge = !de || d >= de;
    const le = !ate || d <= ate;
    return ge && le;
};

// >>> NOVO LISTENER do botão "Gerar"
// Consulta apenas por profissional (não requer índice composto).
// O intervalo De/Até é aplicado no cliente.
relGerarBtn.addEventListener("click", async () => {
    const de = relDe.value, ate = relAte.value, prof = relProf.value;
    if (!prof) return showNotification("Escolha o profissional.", "error");

    relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Gerando...</td></tr>`;

    try {
        const q = query(collection(db, "agendamentos"), where("profissional", "==", prof));
        const snap = await getDocs(q);

        reportCache = snap.docs
            .map((d) => getCorrectedAppointment({ ...d.data() }))
            .filter((d) => !d.bloqueado && isInISODateRange((d.dataISO || "").trim(), de, ate))
            .map(d => ({ ...d, pagamentoForma: (d.pagamentoForma ?? d.formaPagamento ?? "—") }));

        reportCache.sort((a, b) => (a.dataISO + (a.hora || "")).localeCompare(b.dataISO + (b.hora || "")));

        const qtd = reportCache.length;
        const bruto = reportCache.reduce((s, it) => s + (Number(it.valor) || 0), 0);
        const ticket = qtd ? bruto / qtd : 0;
        kpiQtd.textContent = qtd;
        kpiBruto.textContent = formatCurrency(bruto);
        kpiTicket.textContent = formatCurrency(ticket);

        relDetalheTbody.innerHTML =
            reportCache.length === 0
                ? `<tr><td colspan="6" class="loading-row">Nenhum resultado.</td></tr>`
                : reportCache.map((r) => `
          <tr>
            <td data-label="Data">${ymdToDateStr(r.dataISO)}</td>
            <td data-label="Profissional">${r.profissional || "—"}</td>
            <td data-label="Cliente">${r.clienteNome || r.cliente || "—"}</td>
            <td data-label="Serviço">${r.servico || "—"}</td>
            <td data-label="Forma">${r.pagamentoForma || "—"}</td>
            <td data-label="Valor">${formatCurrency(r.valor)}</td>
          </tr>`).join("");

        renderReportChart(reportCache);
    } catch (err) {
        console.error("Erro ao gerar relatório (sem índice): ", err);
        relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Erro ao gerar relatório. Verifique o console.</td></tr>`;
    }
});

exportCsv.addEventListener("click", () => {
    if (reportCache.length === 0) return showNotification("Gere um relatório primeiro.", "error");
    const headers = ["Data", "Profissional", "Cliente", "Serviço", "Forma", "Valor"];
    const rows = reportCache.map((r) => [
        ymdToDateStr(r.dataISO),
        r.profissional || "",
        r.clienteNome || r.cliente || "",
        r.servico || "",
        (r.pagamentoForma || "—"),
        (Number(r.valor) || 0).toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURI(csv);
    link.download = `relatorio_${relDe.value}_a_${relAte.value}.csv`;
    link.click();
});

/* =========================================
   Pagamentos (mantido)
========================================= */
const renderPayments = (payments) => {
    const monthly = payments.filter((p) => p.date && p.date.toDate() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    paymentsTableBody.innerHTML =
        monthly.map((p) => `
      <tr>
        <td data-label="Data">${formatDate(p.date)}</td>
        <td data-label="Cliente">${p.clientName}</td>
        <td data-label="Valor">${formatCurrency(p.value)}</td>
        <td data-label="Ações"><button class="btn btn-sm btn-del" data-payment-id="${p.id}"><i class='bx bx-trash'></i></button></td>
      </tr>`).join("")
        || `<tr><td colspan="4" class="loading-row">Nenhum pagamento este mês.</td></tr>`;
    $("#monthlyTotal").textContent = formatCurrency(monthly.reduce((s, p) => s + p.value, 0));
};

paymentsTableBody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-payment-id]");
    if (button) {
        const id = button.dataset.paymentId;
        mainModal.show({
            title: "Remover Pagamento",
            body: `<p>Deseja remover este registro?</p>`,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Confirmar", class: "btn-del",
                    onClick: async () => {
                        try { await deleteDoc(doc(db, "pagamentos", id)); showNotification("Pagamento removido!"); }
                        catch (err) { console.error("[pagamentos:delete]", err); showNotification("Erro ao remover.", "error"); }
                    }
                }
            ]
        });
    }
});

/* =========================================
   Boot / Init
========================================= */
function showTab(tabId) {
    mainContents.forEach((m) => m.classList.remove("active"));
    $(`#${tabId}Main`).classList.add("active");
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
}
tabBtns.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

const init = async () => {
    const hoje = new Date().toISOString().split("T")[0];
    dataFiltro.value = hoje;
    relDe.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    relAte.value = hoje;

    // >>> apenas UM nome no seletor
    const profOptions = `<option value="Profissional">Profissional</option>`;
    profissionalSelect.innerHTML = profOptions;
    relProf.innerHTML = profOptions;

    horaFiltro.innerHTML += HOURS.map((h) => `<option>${h}</option>`).join("");

    buscarBtn.addEventListener("click", buscarAgenda);
    profissionalSelect.addEventListener("change", buscarAgenda);
    dataFiltro.addEventListener("change", buscarAgenda);
    horaFiltro.addEventListener("change", buscarAgenda);

    onSnapshot(
        query(collection(db, "clientes"), orderBy("name")),
        (snap) => { allClients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })); applyClientFilters(); updateClientKPIs(); },
        (error) => console.error("Erro no listener de clientes:", error)
    );
    onSnapshot(
        query(collection(db, "pagamentos"), orderBy("date", "desc")),
        (snap) => { renderPayments(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))); },
        (error) => console.error("Erro no listener de pagamentos:", error)
    );

    showTab("agenda");
    buscarAgenda();
    validateClientForm();
};

document.addEventListener("DOMContentLoaded", init);

/* ====== (edição de cliente / ações de cliente – mantenha as suas se houver) ====== */
// ...
