const STORAGE_KEY = "fleetwise-demo-v1";
const USER_STORAGE_KEY = "ampernet-fleet-user";
let currentUser = "";
const today = new Date();
const dateOffset = (days) => {
  const value = new Date(today);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const initialData = {
  vehicles: [
    { id: "v1", plate: "RJK-4A82", model: "Mercedes-Benz Sprinter", type: "Van", year: 2023, km: 48290, driverId: "d1", status: "Em rota" },
    { id: "v2", plate: "FTR-9C17", model: "Volvo FH 460", type: "Caminhão", year: 2022, km: 124580, driverId: "d2", status: "Em rota" },
    { id: "v3", plate: "GHT-2B64", model: "Toyota Hilux SRX", type: "Pickup", year: 2024, km: 21640, driverId: "d3", status: "Disponível" },
    { id: "v4", plate: "MNP-7D03", model: "Volkswagen Delivery 11.180", type: "Caminhão", year: 2021, km: 98210, driverId: "d4", status: "Manutenção" },
    { id: "v5", plate: "QAZ-8E51", model: "Fiat Ducato Cargo", type: "Van", year: 2023, km: 35770, driverId: "d5", status: "Em rota" },
    { id: "v6", plate: "BVC-3F29", model: "Chevrolet S10 LTZ", type: "Pickup", year: 2022, km: 66900, driverId: "d6", status: "Disponível" },
    { id: "v7", plate: "LKM-5G76", model: "Iveco Daily 35-160", type: "Van", year: 2024, km: 12830, driverId: "d1", status: "Em rota" },
    { id: "v8", plate: "WSD-1H48", model: "Mercedes-Benz Atego 1719", type: "Caminhão", year: 2020, km: 156400, driverId: "d2", status: "Disponível" },
  ],
  drivers: [
    { id: "d1", name: "Rafael Mendes", category: "D", licenseExpiry: dateOffset(146), phone: "(11) 99842-7610", status: "Ativo" },
    { id: "d2", name: "Carlos Eduardo", category: "E", licenseExpiry: dateOffset(18), phone: "(11) 99173-2048", status: "Ativo" },
    { id: "d3", name: "Juliana Ferreira", category: "C", licenseExpiry: dateOffset(255), phone: "(11) 99712-5583", status: "Ativo" },
    { id: "d4", name: "André Oliveira", category: "D", licenseExpiry: dateOffset(-12), phone: "(11) 98846-9032", status: "Ativo" },
    { id: "d5", name: "Marcos Vinícius", category: "E", licenseExpiry: dateOffset(93), phone: "(11) 99921-1840", status: "Ativo" },
    { id: "d6", name: "Patrícia Almeida", category: "B", licenseExpiry: dateOffset(32), phone: "(11) 98413-6755", status: "Ativo" },
  ],
  maintenance: [
    { id: "m1", vehicleId: "v4", kind: "Corretiva", date: dateOffset(-2), description: "Troca de pastilhas de freio", parts: "Pastilhas dianteiras", cost: 1840, nextKm: 103000, kmAtService: 98210, status: "Em andamento" },
    { id: "m2", vehicleId: "v2", kind: "Preventiva", date: dateOffset(-18), description: "Revisão de 120.000 km", parts: "Óleo, filtros e correia", cost: 3280, nextKm: 135000, kmAtService: 120400, status: "Concluída" },
    { id: "m3", vehicleId: "v5", kind: "Preventiva", date: dateOffset(-32), description: "Revisão programada", parts: "Óleo e filtros", cost: 960, nextKm: 40000, kmAtService: 33700, status: "Concluída" },
    { id: "m4", vehicleId: "v8", kind: "Corretiva", date: dateOffset(-45), description: "Sistema de arrefecimento", parts: "Bomba d'água", cost: 2460, nextKm: 160000, kmAtService: 154800, status: "Concluída" },
  ],
  fuel: [
    { id: "f1", vehicleId: "v1", date: dateOffset(-1), liters: 72, total: 446.4, station: "Posto Rota 66", km: 48290, average: 8.4 },
    { id: "f2", vehicleId: "v2", date: dateOffset(-2), liters: 180, total: 1080, station: "Rede Estradão", km: 124580, average: 3.1 },
    { id: "f3", vehicleId: "v3", date: dateOffset(-3), liters: 58, total: 359.6, station: "Posto Central", km: 21640, average: 9.8 },
    { id: "f4", vehicleId: "v5", date: dateOffset(-4), liters: 80, total: 504, station: "Rede Estradão", km: 35770, average: 7.7 },
    { id: "f5", vehicleId: "v7", date: dateOffset(-6), liters: 67, total: 415.4, station: "Auto Posto Avenida", km: 12830, average: 8.2 },
    { id: "f6", vehicleId: "v6", date: dateOffset(-8), liters: 61, total: 378.2, station: "Posto Central", km: 66900, average: 9.1 },
  ],
  activities: [
    { id: "a1", type: "route", title: "Veículo saiu para rota", detail: "RJK-4A82 · Rafael Mendes · São Paulo → Campinas", date: dateOffset(0), time: "09:42" },
    { id: "a2", type: "success", title: "Abastecimento registrado", detail: "FTR-9C17 · Rede Estradão · 180 litros", date: dateOffset(0), time: "09:18" },
    { id: "a3", type: "warning", title: "CNH próxima do vencimento", detail: "Carlos Eduardo · vence em breve", date: dateOffset(0), time: "08:56" },
    { id: "a4", type: "route", title: "Retorno confirmado", detail: "GHT-2B64 · Juliana Ferreira", date: dateOffset(-1), time: "Ontem" },
  ],
};

const pageTitles = {
  dashboard: "Visão geral",
  vehicles: "Gestão de veículos",
  drivers: "Controle de motoristas",
  maintenance: "Manutenção e oficinas",
  fuel: "Abastecimento",
  reports: "Relatórios gerenciais",
};
const icons = {
  dashboard: "layout-dashboard",
  vehicles: "truck",
  drivers: "contact-round",
  maintenance: "wrench",
  fuel: "fuel",
  reports: "chart-no-axes-combined",
};

let data = loadData();
let currentPage = "dashboard";
let tableSearch = "";
let activeFilters = {};
let toastTimer;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...structuredClone(initialData), ...JSON.parse(saved) } : structuredClone(initialData);
  } catch (error) {
    console.error("Não foi possível carregar os dados salvos da frota.", error);
    return structuredClone(initialData);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Não foi possível salvar os dados da frota no navegador.", error);
    showToast("Falha ao salvar no armazenamento local.", true);
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}
function number(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
}
function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("pt-BR").format(parsed);
}
function daysUntil(value) {
  const target = new Date(`${value}T00:00:00`);
  return Math.ceil((target - new Date(new Date().toDateString())) / 86400000);
}
function driverName(id) {
  return data.drivers.find((driver) => driver.id === id)?.name || "Não atribuído";
}
function vehicle(id) {
  return data.vehicles.find((item) => item.id === id);
}
function vehicleName(id) {
  const item = vehicle(id);
  return item ? `${item.model} · ${item.plate}` : "Veículo removido";
}
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
function setIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function showToast(message, isError = false) {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.innerHTML = `<i data-lucide="${isError ? "circle-alert" : "circle-check"}"></i><span>${escapeHtml(message)}</span>`;
  region.append(toast);
  setIcons();
  window.setTimeout(() => toast.remove(), 3600);
}

function setPage(page) {
  if (!pageTitles[page]) return;
  currentPage = page;
  tableSearch = "";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });
  document.querySelector("#breadcrumb-page").textContent = pageTitles[page];
  document.querySelector("#sidebar").classList.remove("open");
  renderPage();
}

function pageHeader(kicker, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function button(label, icon, attrs = "", primary = false) {
  return `<button class="button${primary ? " button-primary" : ""}" ${attrs}><i data-lucide="${icon}"></i>${label}</button>`;
}
function kpi(label, value, icon, foot, tone = "#ff858a", glow = "rgba(229,57,69,.12)") {
  return `<article class="glass-card kpi-card" style="--tone:${tone};--glow:${glow}"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon"><i data-lucide="${icon}"></i></span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></article>`;
}
function getAlerts() {
  const licenseAlerts = data.drivers.filter((driver) => daysUntil(driver.licenseExpiry) <= 30).length;
  const dueMaintenance = data.vehicles.filter((item) => {
    const last = data.maintenance.filter((entry) => entry.vehicleId === item.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    return last && item.km >= Number(last.nextKm);
  }).length;
  return licenseAlerts + dueMaintenance;
}

function renderDashboard() {
  const total = data.vehicles.length;
  const onRoute = data.vehicles.filter((item) => item.status === "Em rota").length;
  const inMaintenance = data.vehicles.filter((item) => item.status === "Manutenção").length;
  const monthlyFuel = data.fuel.filter((item) => item.date.slice(0, 7) === new Date().toISOString().slice(0, 7));
  const liters = monthlyFuel.reduce((sum, item) => sum + Number(item.liters), 0);
  const avgConsumption = monthlyFuel.length ? monthlyFuel.reduce((sum, item) => sum + Number(item.average), 0) / monthlyFuel.length : 0;
  const alerts = getAlerts();
  const recent = [...data.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  return `${pageHeader("PAINEL EXECUTIVO", `<span id="dashboard-greeting">${getTimeGreeting()}, ${escapeHtml(currentUser.split(/\s+/)[0] || "usuário")}</span> <span aria-hidden='true'>✦</span>`, "Aqui está o resumo da operação da sua frota hoje.", button("Baixar relatório", "download", "data-action='export-summary'"))}
    <section class="kpi-grid">
      ${kpi("Veículos na frota", number(total), "truck", `<span class="trend">● ${data.vehicles.filter((v) => v.status === "Disponível").length} disponíveis</span> no momento`)}
      ${kpi("Veículos em rota", number(onRoute), "route", `${total ? Math.round(onRoute / total * 100) : 0}% da frota em operação`, "#ff777e", "rgba(229,57,69,.15)")}
      ${kpi("Em manutenção", number(inMaintenance), "wrench", `${data.maintenance.filter((m) => m.status === "Em andamento").length} ordem(ns) em aberto`, "#f3b95c", "rgba(243,185,92,.13)")}
      ${kpi("Consumo médio", avgConsumption ? `${avgConsumption.toFixed(1).replace(".", ",")} <small style="font-size:12px;color:#91a1b7">km/L</small>` : "—", "fuel", `${number(Math.round(liters))} litros registrados no mês`, "#ff858a", "rgba(229,57,69,.12)")}
      ${kpi("Alertas pendentes", number(alerts), "bell-ring", "CNHs e revisões que precisam de atenção", alerts ? "#ff9aa7" : "#39d6a1", alerts ? "rgba(255,113,130,.14)" : "rgba(57,214,161,.12)")}
    </section>
    <section class="dashboard-grid">
      <article class="glass-card chart-card"><div class="card-heading"><div><h2>Custos operacionais</h2><p>Despesas consolidadas · últimos 6 meses</p></div><div class="chart-legend"><span><i class="legend-dot"></i>Combustível</span><span><i class="legend-dot cyan"></i>Manutenção</span></div></div><canvas class="chart-canvas" id="cost-chart" aria-label="Gráfico de custos operacionais"></canvas></article>
      <article class="glass-card chart-card"><div class="card-heading"><div><h2>Status da frota</h2><p>Distribuição atual dos veículos</p></div><span class="status-badge available">Ao vivo</span></div><div class="donut-wrap"><div class="donut" id="fleet-donut"><div class="donut-center"><strong>${total}</strong><span>veículos</span></div></div><div class="status-legend" id="status-legend"></div></div></article>
    </section>
    <section class="glass-card activity-card"><div class="card-heading"><div><h2>Atividades recentes</h2><p>Acompanhe os últimos eventos registrados na operação.</p></div>${button("Ver veículos", "arrow-right", "data-page-link='vehicles'")}</div><div class="activity-list">${recent.length ? recent.map(activityMarkup).join("") : `<div class="table-empty">Nenhuma atividade registrada.</div>`}</div></section>`;
}

function activityMarkup(item) {
  const icon = item.type === "success" ? "fuel" : item.type === "warning" ? "triangle-alert" : "truck";
  return `<div class="activity-item"><span class="activity-icon ${item.type}"><i data-lucide="${icon}"></i></span><div class="activity-main"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></div><time class="activity-time">${item.time === "Ontem" ? "Ontem" : `${formatDate(item.date)} · ${escapeHtml(item.time)}`}</time></div>`;
}

const tableConfigs = {
  vehicles: {
    title: "Frota de veículos", description: "Gerencie os veículos, atribuições e disponibilidade da operação.",
    add: "Adicionar veículo", entity: "vehicle", filters: [["all", "Todos os status"], ["Em rota", "Em rota"], ["Disponível", "Disponível"], ["Manutenção", "Manutenção"]],
    headers: ["Veículo", "Placa", "Ano", "Quilometragem", "Motorista", "Status", "Ações"],
    rows: () => data.vehicles.map((item) => ({
      search: `${item.model} ${item.plate} ${driverName(item.driverId)} ${item.type}`,
      filter: item.status,
      cells: [`<div class="vehicle-cell"><span class="vehicle-glyph"><i data-lucide="${item.type === "Caminhão" ? "truck" : "van"}"></i></span><span class="primary-cell">${escapeHtml(item.model)}<span class="secondary-cell">${escapeHtml(item.type)}</span></span></div>`,
        `<span class="plate">${escapeHtml(item.plate)}</span>`, number(item.year), `${number(item.km)} km`, escapeHtml(driverName(item.driverId)), statusBadge(item.status),
        rowActions("vehicle", item.id, true)],
    })),
  },
  drivers: {
    title: "Equipe de motoristas", description: "Acompanhe cadastros, habilitações e validade das CNHs.",
    add: "Adicionar motorista", entity: "driver", filters: [["all", "Todos os motoristas"], ["Ativo", "Ativos"], ["Inativo", "Inativos"]],
    headers: ["Motorista", "Categoria CNH", "Vencimento CNH", "Telefone", "Situação", "Ações"],
    rows: () => data.drivers.map((item) => {
      const remaining = daysUntil(item.licenseExpiry);
      const licenseStatus = remaining < 0 ? "Vencida" : remaining <= 30 ? "Vence em breve" : item.status;
      return {
        search: `${item.name} ${item.phone} ${item.category}`,
        filter: item.status,
        cells: [`<span class="primary-cell">${escapeHtml(item.name)}<span class="secondary-cell">${data.vehicles.filter((v) => v.driverId === item.id).length} veículo(s) atribuído(s)</span></span>`,
          `Categoria ${escapeHtml(item.category)}`, `<span class="status-badge ${remaining < 0 ? "expired" : remaining <= 30 ? "soon" : "available"}">${formatDate(item.licenseExpiry)}</span>`, escapeHtml(item.phone),
          `<span class="status-badge ${remaining < 0 ? "expired" : remaining <= 30 ? "soon" : "available"}">${licenseStatus}${remaining < 0 ? "" : remaining <= 30 ? ` · ${remaining} dias` : ""}</span>`, rowActions("driver", item.id)],
      };
    }),
  },
  maintenance: {
    title: "Ordens de manutenção", description: "Planeje revisões e acompanhe custos e serviços da frota.",
    add: "Registrar manutenção", entity: "maintenance", filters: [["all", "Todos os serviços"], ["Em andamento", "Em andamento"], ["Concluída", "Concluídas"]],
    headers: ["Veículo", "Serviço", "Tipo", "Data", "Custo", "Próxima revisão", "Status", "Ações"],
    rows: () => data.maintenance.map((item) => ({
      search: `${vehicleName(item.vehicleId)} ${item.description} ${item.parts} ${item.kind}`,
      filter: item.status,
      cells: [`<span class="primary-cell">${escapeHtml(vehicleName(item.vehicleId))}</span>`,
        `<span class="primary-cell">${escapeHtml(item.description)}<span class="secondary-cell">${escapeHtml(item.parts)}</span></span>`,
        escapeHtml(item.kind), formatDate(item.date), money(item.cost), `${number(item.nextKm)} km`, statusBadge(item.status), rowActions("maintenance", item.id)],
    })),
  },
  fuel: {
    title: "Controle de abastecimento", description: "Registre abastecimentos e monitore consumo e custo por veículo.",
    add: "Registrar abastecimento", entity: "fuel", filters: [["all", "Todos os veículos"], ...data.vehicles.map((v) => [v.id, v.plate])],
    headers: ["Veículo", "Data", "Posto", "Quilometragem", "Litros", "Média km/L", "Valor total", "Ações"],
    rows: () => data.fuel.map((item) => ({
      search: `${vehicleName(item.vehicleId)} ${item.station}`,
      filter: item.vehicleId,
      cells: [`<span class="primary-cell">${escapeHtml(vehicleName(item.vehicleId))}</span>`, formatDate(item.date), escapeHtml(item.station), `${number(item.km)} km`, `${Number(item.liters).toLocaleString("pt-BR")} L`, `${Number(item.average).toLocaleString("pt-BR")} km/L`, money(item.total), rowActions("fuel", item.id)],
    })),
  },
};

function statusBadge(status) {
  const cls = status === "Disponível" || status === "Concluída" || status === "Ativo" ? "available" : status === "Em rota" ? "route" : status === "Vencida" ? "expired" : status === "Vence em breve" ? "soon" : "maintenance";
  return `<span class="status-badge ${cls}">${escapeHtml(status)}</span>`;
}
function rowActions(entity, id, history = false) {
  return `<div class="row-actions">${history ? `<button class="action-button" title="Ver histórico" aria-label="Ver histórico" data-action="history" data-id="${escapeHtml(id)}"><i data-lucide="history"></i></button>` : ""}<button class="action-button" title="Editar" aria-label="Editar" data-action="edit" data-entity="${entity}" data-id="${escapeHtml(id)}"><i data-lucide="pencil"></i></button><button class="action-button danger" title="Excluir" aria-label="Excluir" data-action="delete" data-entity="${entity}" data-id="${escapeHtml(id)}"><i data-lucide="trash-2"></i></button></div>`;
}

function renderTablePage(page) {
  const config = tableConfigs[page];
  const rows = config.rows().filter((row) => {
    const matchesSearch = row.search.toLocaleLowerCase("pt-BR").includes(tableSearch.toLocaleLowerCase("pt-BR"));
    const selectedFilter = activeFilters[page] || "all";
    return matchesSearch && (selectedFilter === "all" || row.filter === selectedFilter);
  });
  const filters = config.filters.map(([value, label]) => `<option value="${escapeHtml(value)}" ${(activeFilters[page] || "all") === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  const alert = page === "drivers" && data.drivers.some((driver) => daysUntil(driver.licenseExpiry) <= 30)
    ? `<div class="alert-banner"><i data-lucide="triangle-alert"></i><span><strong>Atenção:</strong> ${data.drivers.filter((driver) => daysUntil(driver.licenseExpiry) <= 30).length} CNH(s) vencida(s) ou próximas do vencimento. Verifique a documentação dos motoristas.</span></div>` : "";
  const due = page === "maintenance" ? data.vehicles.filter((item) => {
    const last = data.maintenance.filter((entry) => entry.vehicleId === item.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    return last && item.km >= Number(last.nextKm);
  }).length : 0;
  const maintenanceAlert = due ? `<div class="alert-banner"><i data-lucide="triangle-alert"></i><span><strong>Revisão por quilometragem:</strong> ${due} veículo(s) atingiram ou ultrapassaram a marca da próxima revisão.</span></div>` : "";
  const body = rows.length ? rows.map((row) => `<tr>${row.cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td class="table-empty" colspan="${config.headers.length}">Nenhum registro encontrado. Ajuste os filtros ou cadastre um novo item.</td></tr>`;
  const headActions = button(config.add, "plus", `data-action="add" data-entity="${config.entity}"`, true);
  return `${pageHeader("OPERAÇÃO", config.title, config.description, headActions)}${alert}${maintenanceAlert}
    <section class="glass-card section-card">
      <div class="table-toolbar"><div class="toolbar-group"><label class="search-field"><i data-lucide="search"></i><input id="table-search" type="search" placeholder="Buscar registros..." value="${escapeHtml(tableSearch)}" aria-label="Buscar registros" /></label><select class="filter-select" id="table-filter" aria-label="Filtrar registros">${filters}</select></div><div class="toolbar-group"><span class="status-badge available">${rows.length} registro(s)</span></div></div>
      <div class="table-scroll"><table class="data-table"><thead><tr>${config.headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="table-summary"><span>Exibindo ${rows.length} de ${config.rows().length} registros</span><span>Dados atualizados em tempo real</span></div>
    </section>`;
}

function renderReports() {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const monthlyFuel = data.fuel.filter((item) => item.date.startsWith(monthKey)).reduce((sum, item) => sum + Number(item.total), 0);
  const monthlyMaintenance = data.maintenance.filter((item) => item.date.startsWith(monthKey)).reduce((sum, item) => sum + Number(item.cost), 0);
  const rows = data.vehicles.map((item) => {
    const fuelCost = data.fuel.filter((entry) => entry.vehicleId === item.id).reduce((sum, entry) => sum + Number(entry.total), 0);
    const maintenanceCost = data.maintenance.filter((entry) => entry.vehicleId === item.id).reduce((sum, entry) => sum + Number(entry.cost), 0);
    return `<tr><td><span class="primary-cell">${escapeHtml(item.model)}<span class="secondary-cell">${escapeHtml(item.plate)}</span></span></td><td>${number(item.km)} km</td><td>${money(fuelCost)}</td><td>${money(maintenanceCost)}</td><td class="primary-cell">${money(fuelCost + maintenanceCost)}</td><td>${statusBadge(item.status)}</td></tr>`;
  }).join("");
  const actions = `${button("Exportar CSV", "file-spreadsheet", "data-action='export-csv'")}${button("Exportar PDF", "file-down", "data-action='print'")}`;
  return `${pageHeader("INTELIGÊNCIA DE DADOS", "Relatórios gerenciais", "Visibilidade financeira e operacional para decisões mais inteligentes.", actions)}
    <section class="glass-card report-hero"><div><h2>Resumo executivo da operação</h2><p>Consolidado por veículo · valores acumulados dos registros disponíveis.</p></div><div class="report-period"><i data-lucide="calendar-days"></i> ${new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now)}</div></section>
    <section class="metric-strip">
      <article class="glass-card metric-mini"><span>Abastecimento no mês</span><strong>${money(monthlyFuel)}</strong></article>
      <article class="glass-card metric-mini"><span>Manutenção no mês</span><strong>${money(monthlyMaintenance)}</strong></article>
      <article class="glass-card metric-mini"><span>Custo total registrado</span><strong>${money(monthlyFuel + monthlyMaintenance)}</strong></article>
    </section>
    <section class="glass-card section-card"><div class="card-heading" style="padding:16px 16px 0;margin-bottom:8px"><div><h2>Custos e quilometragem por veículo</h2><p>Dados calculados a partir dos lançamentos registrados no sistema.</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Veículo</th><th>Quilometragem atual</th><th>Combustível</th><th>Manutenção</th><th>Custo total</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="table-empty">Cadastre veículos para gerar relatórios.</td></tr>`}</tbody></table></div></section>`;
}

function renderPage() {
  const content = document.querySelector("#app-content");
  if (currentPage === "dashboard") content.innerHTML = renderDashboard();
  else if (tableConfigs[currentPage]) content.innerHTML = renderTablePage(currentPage);
  else content.innerHTML = renderReports();
  updateVehicleCount();
  setIcons();
  if (currentPage === "dashboard") {
    drawCostChart();
    drawStatusChart();
  }
}

function updateVehicleCount() {
  document.querySelector("#vehicle-count").textContent = String(data.vehicles.length).padStart(2, "0");
}

function drawCostChart() {
  const canvas = document.querySelector("#cost-chart");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  const months = [];
  for (let offset = 5; offset >= 0; offset--) {
    const date = new Date();
    date.setMonth(date.getMonth() - offset, 1);
    months.push(date.toISOString().slice(0, 7));
  }
  const fuel = months.map((month) => data.fuel.filter((entry) => entry.date.startsWith(month)).reduce((sum, entry) => sum + Number(entry.total), 0));
  const maintenance = months.map((month) => data.maintenance.filter((entry) => entry.date.startsWith(month)).reduce((sum, entry) => sum + Number(entry.cost), 0));
  const max = Math.max(1000, ...fuel.map((v, i) => v + maintenance[i])) * 1.18;
  const left = 34, right = 8, top = 10, bottom = 25;
  const plotW = width - left - right, plotH = height - top - bottom;
  ctx.font = "9px DM Sans";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 4; i++) {
    const y = top + plotH * i / 3;
    ctx.strokeStyle = "rgba(156,177,204,.11)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
    ctx.fillStyle = "#7889a0";
    ctx.textAlign = "left";
    ctx.fillText(i === 0 ? "R$ 0" : `${Math.round(max * (3 - i) / 3 / 1000)}k`, 1, y);
  }
  const groupW = plotW / months.length;
  months.forEach((month, index) => {
    const x = left + groupW * index + groupW * .22;
    const barW = Math.min(13, groupW * .25);
    const fuelH = fuel[index] / max * plotH;
    const maintH = maintenance[index] / max * plotH;
    ctx.fillStyle = "#e8424b";
    roundRect(ctx, x, top + plotH - fuelH, barW, fuelH, 3);
    ctx.fill();
    ctx.fillStyle = "#ff858a";
    roundRect(ctx, x + barW + 3, top + plotH - maintH, barW, maintH, 3);
    ctx.fill();
    ctx.fillStyle = "#8292a8";
    ctx.textAlign = "center";
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${month}-01T12:00:00`)).replace(".", "");
    ctx.fillText(label, left + groupW * (index + .5), height - 8);
  });
}
function roundRect(ctx, x, y, width, height, radius) {
  const adjustedHeight = Math.max(2, height);
  ctx.beginPath();
  ctx.roundRect(x, y + height - adjustedHeight, width, adjustedHeight, Math.min(radius, adjustedHeight / 2));
}
function drawStatusChart() {
  const stats = [
    ["Em rota", data.vehicles.filter((item) => item.status === "Em rota").length, ""],
    ["Disponível", data.vehicles.filter((item) => item.status === "Disponível").length, "green"],
    ["Manutenção", data.vehicles.filter((item) => item.status === "Manutenção").length, "amber"],
  ];
  const total = data.vehicles.length;
  let cumulative = 0;
  const colors = ["#e8424b", "#39d6a1", "#f3b95c"];
  const stops = stats.map(([, count], index) => {
    const start = total ? cumulative / total * 100 : 0;
    cumulative += count;
    const end = total ? cumulative / total * 100 : 100;
    return `${colors[index]} ${start}% ${end}%`;
  });
  const donut = document.querySelector("#fleet-donut");
  if (donut) donut.style.background = `conic-gradient(${stops.join(",")})`;
  const legend = document.querySelector("#status-legend");
  if (legend) legend.innerHTML = stats.map(([label, count, cls]) => `<div><i class="${cls}"></i><span>${label}</span><b>${count}</b></div>`).join("");
}

const formDefinitions = {
  vehicle: {
    title: "Veículo", collection: "vehicles",
    fields: [
      ["plate", "Placa", "text", true, "ABC-1D23"], ["model", "Modelo", "text", true, "Ex.: Ford Transit"],
      ["type", "Tipo de veículo", "select", true, ["Van", "Caminhão", "Pickup", "Carro", "Ônibus"]],
      ["year", "Ano", "number", true, { min: 1980, max: 2100 }],
      ["km", "Quilometragem atual", "number", true, { min: 0 }],
      ["driverId", "Motorista responsável", "select", false, "drivers"],
      ["status", "Status operacional", "select", true, ["Disponível", "Em rota", "Manutenção"]],
    ],
  },
  driver: {
    title: "Motorista", collection: "drivers",
    fields: [
      ["name", "Nome completo", "text", true, "Nome do motorista"],
      ["category", "Categoria CNH", "select", true, ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"]],
      ["licenseExpiry", "Vencimento da CNH", "date", true],
      ["phone", "Telefone", "tel", true, "(11) 99999-9999"],
      ["status", "Situação", "select", true, ["Ativo", "Inativo"]],
    ],
  },
  maintenance: {
    title: "Manutenção", collection: "maintenance",
    fields: [
      ["vehicleId", "Veículo", "select", true, "vehicles"],
      ["kind", "Tipo de manutenção", "select", true, ["Preventiva", "Corretiva"]],
      ["description", "Serviço realizado", "text", true, "Ex.: Revisão programada"],
      ["parts", "Peças / observações", "text", false, "Peças trocadas ou detalhes"],
      ["date", "Data da revisão", "date", true],
      ["kmAtService", "Quilometragem no serviço", "number", true, { min: 0 }],
      ["nextKm", "Próxima revisão por km", "number", true, { min: 0 }],
      ["cost", "Custo total (R$)", "number", true, { min: 0, step: "0.01" }],
      ["status", "Status", "select", true, ["Em andamento", "Concluída"]],
    ],
  },
  fuel: {
    title: "Abastecimento", collection: "fuel",
    fields: [
      ["vehicleId", "Veículo", "select", true, "vehicles"],
      ["date", "Data", "date", true],
      ["station", "Posto de combustível", "text", true, "Nome do posto"],
      ["km", "Quilometragem no momento", "number", true, { min: 0 }],
      ["liters", "Litros abastecidos", "number", true, { min: 0, step: "0.01" }],
      ["total", "Valor total (R$)", "number", true, { min: 0, step: "0.01" }],
      ["average", "Média de consumo (km/L)", "number", false, { min: 0, step: "0.1" }],
    ],
  },
};

function optionMarkup(options, selected, firstLabel) {
  if (options === "drivers") {
    return `<option value="">Não atribuído</option>${data.drivers.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}`;
  }
  if (options === "vehicles") {
    return data.vehicles.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.model)} · ${escapeHtml(item.plate)}</option>`).join("");
  }
  return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function openForm(entity, id = "") {
  const definition = formDefinitions[entity];
  if (!definition) return;
  const existing = data[definition.collection].find((item) => item.id === id) || {};
  const fields = definition.fields.map(([name, label, type, required, extra]) => {
    const value = existing[name] ?? (name === "date" ? new Date().toISOString().slice(0, 10) : name === "status" ? (entity === "vehicle" ? "Disponível" : entity === "driver" ? "Ativo" : entity === "maintenance" ? "Em andamento" : "") : "");
    let input;
    if (type === "select") input = `<select class="form-control" name="${name}" ${required ? "required" : ""}>${optionMarkup(extra, value, label)}</select>`;
    else {
      const attrs = typeof extra === "object" && extra ? Object.entries(extra).map(([key, val]) => `${key}="${escapeHtml(val)}"`).join(" ") : extra ? `placeholder="${escapeHtml(extra)}"` : "";
      input = `<input class="form-control" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${name === "average" ? 'readonly placeholder="Calculada automaticamente"' : ""} ${attrs} />`;
    }
    return `<div class="form-field"><label for="field-${name}">${label}${required ? " *" : ""}</label>${input.replace(`name="${name}"`, `id="field-${name}" name="${name}"`)}</div>`;
  }).join("");
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><h2 id="modal-title">${id ? "Editar" : "Adicionar"} ${definition.title.toLocaleLowerCase("pt-BR")}</h2><p>Preencha os dados para atualizar a operação.</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Fechar"><i data-lucide="x"></i></button></header><form class="modal-form" id="record-form" data-entity="${entity}" data-id="${escapeHtml(id)}"><div class="form-grid">${fields}</div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit"><i data-lucide="check"></i>Salvar registro</button></div></form></div>`;
  setIcons();
  if (entity === "fuel" && !id) {
    const selectedVehicle = vehicle(root.querySelector('[name="vehicleId"]')?.value);
    if (selectedVehicle) root.querySelector("#field-km").value = selectedVehicle.km;
  }
  if (entity === "maintenance" && !id) {
    const selectedVehicle = vehicle(root.querySelector('[name="vehicleId"]')?.value);
    if (selectedVehicle) root.querySelector("#field-kmAtService").value = selectedVehicle.km;
  }
  root.querySelector(".form-control")?.focus();
}

function openHistory(id) {
  const item = vehicle(id);
  if (!item) return;
  const maintenance = data.maintenance.filter((entry) => entry.vehicleId === id).map((entry) => ({ date: entry.date, title: `Manutenção · ${entry.description}`, text: `${entry.kind} · ${entry.parts} · ${money(entry.cost)} · próxima revisão ${number(entry.nextKm)} km` }));
  const fuel = data.fuel.filter((entry) => entry.vehicleId === id).map((entry) => ({ date: entry.date, title: "Abastecimento", text: `${entry.station} · ${entry.liters} L · ${money(entry.total)} · ${entry.average} km/L` }));
  const events = [...maintenance, ...fuel].sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector("#modal-root").innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><h2 id="modal-title">Histórico do veículo</h2><p>${escapeHtml(item.model)} · ${escapeHtml(item.plate)}</p></div><button class="modal-close" data-action="close-modal" aria-label="Fechar"><i data-lucide="x"></i></button></header><div class="history-list">${events.length ? events.map((event) => `<article class="history-entry"><strong>${formatDate(event.date)} · ${escapeHtml(event.title)}</strong><p>${escapeHtml(event.text)}</p></article>`).join("") : `<div class="table-empty">Nenhum abastecimento ou serviço registrado para este veículo.</div>`}</div></div>`;
  setIcons();
}

function recordActivity(type, title, detail) {
  data.activities.unshift({ id: `a${Date.now()}`, type, title, detail, date: new Date().toISOString().slice(0, 10), time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()) });
  data.activities = data.activities.slice(0, 20);
}

function formValue(form, name) {
  return form.elements.namedItem(name)?.value?.trim() ?? "";
}
function handleFormSubmit(form) {
  const entity = form.dataset.entity;
  const definition = formDefinitions[entity];
  if (!definition) return;
  const record = {};
  for (const [name, , type] of definition.fields) {
    const raw = formValue(form, name);
    record[name] = type === "number" ? Number(raw) : raw;
  }
  if (entity === "vehicle") record.plate = record.plate.toUpperCase();
  if (entity === "maintenance") {
    const currentVehicle = vehicle(record.vehicleId);
    if (currentVehicle) currentVehicle.status = record.status === "Em andamento" ? "Manutenção" : currentVehicle.status === "Manutenção" ? "Disponível" : currentVehicle.status;
  }
  if (entity === "fuel") {
    const prior = data.fuel.filter((entry) => entry.vehicleId === record.vehicleId && entry.km < record.km).sort((a, b) => b.km - a.km)[0];
    const currentVehicle = vehicle(record.vehicleId);
    record.average = prior && record.liters > 0 ? Number(((record.km - prior.km) / record.liters).toFixed(1)) : 0;
    if (currentVehicle) currentVehicle.km = Math.max(currentVehicle.km, record.km);
  }
  const id = form.dataset.id;
  if (id) {
    const index = data[definition.collection].findIndex((item) => item.id === id);
    if (index >= 0) data[definition.collection][index] = { ...data[definition.collection][index], ...record };
    showToast(`${definition.title} atualizado com sucesso.`);
  } else {
    data[definition.collection].unshift({ id: `${entity[0]}${Date.now()}`, ...record });
    showToast(`${definition.title} cadastrado com sucesso.`);
  }
  if (entity === "vehicle" && record.driverId) {
    recordActivity("route", "Veículo atualizado", `${record.plate} · ${record.model}`);
  } else if (entity === "fuel") {
    recordActivity("success", "Abastecimento registrado", `${vehicle(record.vehicleId)?.plate || ""} · ${record.station} · ${record.liters} litros`);
  } else if (entity === "maintenance") {
    recordActivity("warning", "Manutenção registrada", `${vehicle(record.vehicleId)?.plate || ""} · ${record.description}`);
  }
  saveData();
  closeModal();
  renderPage();
}

function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

function deleteRecord(entity, id) {
  const config = formDefinitions[entity];
  if (!config) return;
  const record = data[config.collection].find((item) => item.id === id);
  if (!record) return;
  const label = entity === "vehicle" ? `${record.model} (${record.plate})` : entity === "driver" ? record.name : entity === "maintenance" ? record.description : `abastecimento de ${record.station}`;
  if (!window.confirm(`Deseja excluir ${label}? Esta ação não pode ser desfeita.`)) return;
  data[config.collection] = data[config.collection].filter((item) => item.id !== id);
  if (entity === "vehicle") {
    data.maintenance = data.maintenance.filter((item) => item.vehicleId !== id);
    data.fuel = data.fuel.filter((item) => item.vehicleId !== id);
  }
  if (entity === "driver") {
    data.vehicles.forEach((item) => { if (item.driverId === id) item.driverId = ""; });
  }
  saveData();
  renderPage();
  showToast(`${config.title} excluído com sucesso.`);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
function downloadCsv(filename, rows) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Arquivo CSV exportado.");
}
function exportReport() {
  const rows = [["Veículo", "Placa", "Quilometragem", "Status", "Combustível (R$)", "Manutenção (R$)", "Custo total (R$)"]];
  for (const item of data.vehicles) {
    const fuel = data.fuel.filter((entry) => entry.vehicleId === item.id).reduce((sum, entry) => sum + Number(entry.total), 0);
    const maintenance = data.maintenance.filter((entry) => entry.vehicleId === item.id).reduce((sum, entry) => sum + Number(entry.cost), 0);
    rows.push([item.model, item.plate, item.km, item.status, fuel.toFixed(2), maintenance.toFixed(2), (fuel + maintenance).toFixed(2)]);
  }
  downloadCsv("fleetwise-relatorio-veiculos.csv", rows);
}
function exportSummary() {
  downloadCsv("fleetwise-resumo-frota.csv", [
    ["Indicador", "Valor"],
    ["Veículos na frota", data.vehicles.length],
    ["Veículos em rota", data.vehicles.filter((item) => item.status === "Em rota").length],
    ["Veículos disponíveis", data.vehicles.filter((item) => item.status === "Disponível").length],
    ["Veículos em manutenção", data.vehicles.filter((item) => item.status === "Manutenção").length],
    ["Alertas pendentes", getAlerts()],
  ]);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-page]");
  if (nav) { event.preventDefault(); setPage(nav.dataset.page); return; }
  const linkedPage = event.target.closest("[data-page-link]");
  if (linkedPage) { setPage(linkedPage.dataset.pageLink); return; }
  const action = event.target.closest("[data-action]");
  if (!action) {
    if (event.target === document.querySelector("#modal-root")) closeModal();
    return;
  }
  switch (action.dataset.action) {
    case "add": openForm(action.dataset.entity); break;
    case "edit": openForm(action.dataset.entity, action.dataset.id); break;
    case "delete": deleteRecord(action.dataset.entity, action.dataset.id); break;
    case "history": openHistory(action.dataset.id); break;
    case "close-modal": closeModal(); break;
    case "export-csv": exportReport(); break;
    case "export-summary": exportSummary(); break;
    case "print": window.print(); break;
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id !== "record-form") return;
  event.preventDefault();
  if (!event.target.reportValidity()) return;
  handleFormSubmit(event.target);
});
document.addEventListener("input", (event) => {
  if (["km", "liters"].includes(event.target.name) && event.target.closest("#record-form")?.dataset.entity === "fuel") {
    recalculateFuelAverage();
    return;
  }
  if (event.target.id !== "table-search") return;
  tableSearch = event.target.value;
  const position = event.target.selectionStart;
  renderPage();
  const search = document.querySelector("#table-search");
  search?.focus();
  search?.setSelectionRange(position, position);
});
document.addEventListener("change", (event) => {
  if (event.target.id === "table-filter") {
    activeFilters[currentPage] = event.target.value;
    renderPage();
  }
  if (event.target.name === "vehicleId" && event.target.closest("#record-form")?.dataset.entity === "fuel") {
    const current = vehicle(event.target.value);
    const kmInput = document.querySelector("#field-km");
    if (current && kmInput && !event.target.closest("#record-form").dataset.id) kmInput.value = current.km;
    recalculateFuelAverage();
  }
  if (event.target.name === "vehicleId" && event.target.closest("#record-form")?.dataset.entity === "maintenance") {
    const current = vehicle(event.target.value);
    const kmInput = document.querySelector("#field-kmAtService");
    if (current && kmInput && !event.target.closest("#record-form").dataset.id) kmInput.value = current.km;
  }
  if (["km", "liters"].includes(event.target.name) && event.target.closest("#record-form")?.dataset.entity === "fuel") recalculateFuelAverage();
});
document.querySelector("#menu-toggle").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#login-name").value.trim().replace(/\s+/g, " ");
  const error = document.querySelector("#login-error");
  if (name.length < 2) {
    error.textContent = "Digite seu nome para acessar o painel.";
    error.hidden = false;
    return;
  }
  try {
    localStorage.setItem(USER_STORAGE_KEY, name);
  } catch (storageError) {
    console.error("Não foi possível salvar o nome neste navegador.", storageError);
    error.textContent = "Não foi possível salvar seu nome neste navegador. Verifique as configurações de armazenamento.";
    error.hidden = false;
    return;
  }
  enterApp(name);
});
document.querySelector("#user-profile").addEventListener("click", () => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.error("Não foi possível encerrar a identificação neste navegador.", error);
  }
  currentUser = "";
  document.querySelector("#app-shell").hidden = true;
  document.querySelector("#login-screen").hidden = false;
  document.querySelector("#login-name").value = "";
  document.querySelector("#login-error").hidden = true;
  document.querySelector("#login-name").focus();
  setIcons();
});
document.querySelector("#notification-button").addEventListener("click", () => {
  const alerts = getAlerts();
  showToast(alerts ? `Você tem ${alerts} alerta(s) que precisam de atenção.` : "Nenhum alerta pendente.");
});
window.addEventListener("resize", () => { if (currentPage === "dashboard") { drawCostChart(); drawStatusChart(); } });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

document.querySelector("#topbar-date").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
document.querySelector("#copyright-year").textContent = new Date().getFullYear();
document.querySelector("#login-year").textContent = new Date().getFullYear();
renderPage();
window.setInterval(() => {
  const greeting = document.querySelector("#dashboard-greeting");
  if (greeting) {
    greeting.textContent = `${getTimeGreeting()}, ${currentUser.split(/\s+/)[0] || "usuário"}`;
  }
}, 60_000);
try {
  const savedUser = localStorage.getItem(USER_STORAGE_KEY)?.trim();
  if (savedUser) enterApp(savedUser);
  else document.querySelector("#login-name").focus();
} catch (error) {
  console.error("Não foi possível recuperar o nome salvo neste navegador.", error);
  document.querySelector("#login-error").textContent = "Não foi possível recuperar o nome salvo. Informe seu nome para continuar.";
  document.querySelector("#login-error").hidden = false;
}

function recalculateFuelAverage() {
  const form = document.querySelector("#record-form");
  if (form?.dataset.entity !== "fuel") return;
  const vehicleId = formValue(form, "vehicleId");
  const km = Number(formValue(form, "km"));
  const liters = Number(formValue(form, "liters"));
  const prior = data.fuel.filter((entry) => entry.vehicleId === vehicleId && entry.km < km).sort((a, b) => b.km - a.km)[0];
  const averageInput = form.elements.namedItem("average");
  if (averageInput) averageInput.value = prior && liters > 0 ? ((km - prior.km) / liters).toFixed(1) : "";
}

function enterApp(name) {
  currentUser = name;
  document.querySelector("#user-name").textContent = name;
  document.querySelector("#user-avatar").textContent = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase("pt-BR") || "")
    .join("");
  document.querySelector("#login-screen").hidden = true;
  document.querySelector("#app-shell").hidden = false;
  renderPage();
}
