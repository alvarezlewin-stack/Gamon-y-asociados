"use strict";
const { useState, useEffect, useMemo } = React;
// ---------- Íconos propios (SVG livianos, sin dependencias externas) ----------
const ICON_PATHS = {
  home: "M3 12l9-9 9 9M5 10v10h14V10",
    calendar: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M17.5 15c2.5.3 4 1.8 4 5",
    plus: "M12 5v14M5 12h14",
    x: "M6 6l12 12M18 6L6 18",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.3-4.3",
    bell: "M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9zM10 19a2 2 0 0 0 4 0",
    briefcase: "M4 8h16v11H4zM9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 13h16",
    chevronRight: "M9 5l7 7-7 7",
    trash: "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13",
    gavel: "M14.5 4.5l5 5-2.5 2.5-5-5zM11 8l-7 7 3 3 7-7M4 21h9",
    scale: "M12 3v18M7 3h10M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0zM5 8h0M19 8h0",
    alertTriangle: "M12 4l9 16H3zM12 10v4M12 17.5v.01",
    checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
    stickyNote: "M4 4h13l3 3v13H4zM17 4v4h3",
    arrowLeft: "M19 12H5M11 6l-6 6 6 6",
};
function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.8 }) {
    return (React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: ICON_PATHS[name] || "" })));
}
// El almacenamiento de datos ahora vive en storage-service.js (StorageService).
// App.js ya no lee ni escribe localStorage/IndexedDB directamente.

// ---------- Utilidades ----------
const TIPOS_EVENTO = [
    { id: "audiencia", label: "Audiencia", icon: "gavel" },
    { id: "vencimiento", label: "Vencimiento", icon: "alertTriangle" },
    { id: "reunion", label: "Reunión", icon: "users" },
    { id: "otro", label: "Otro", icon: "stickyNote" },
];
function uid() {
    // A partir de la Arquitectura 0.7, todos los IDs nuevos son UUID v4 reales
    // (StorageService.generateId), necesario para sincronización futura entre
    // dispositivos/servidor sin choques de ID. Los registros viejos no se tocan.
    return StorageService.generateId();
}
function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr) {
    const today = new Date(todayISO());
    const target = new Date(dateStr);
    return Math.round((target - today) / 86400000);
}
function formatDateLong(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}
function formatDateShort(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function addBusinessDays(startDateStr, numDays, feriados) {
    let d = new Date(startDateStr + "T00:00:00");
    let added = 0;
    const dir = numDays >= 0 ? 1 : -1;
    const target = Math.abs(numDays);
    const feriadosSet = new Set(feriados || []);
    while (added < target) {
        d.setDate(d.getDate() + dir);
        const day = d.getDay();
        const iso = d.toISOString().slice(0, 10);
        if (day !== 0 && day !== 6 && !feriadosSet.has(iso))
            added++;
    }
    return d.toISOString().slice(0, 10);
}
function urgencyOf(dateStr) {
    const diff = daysUntil(dateStr);
    if (diff < 0)
        return { color: "var(--danger)", label: "Vencido" };
    if (diff === 0)
        return { color: "var(--danger)", label: "Hoy" };
    if (diff <= 2)
        return { color: "#D97A3C", label: `En ${diff} día${diff === 1 ? "" : "s"}` };
    if (diff <= 7)
        return { color: "#D9A63C", label: `En ${diff} días` };
    return { color: "var(--success)", label: `En ${diff} días` };
}
// ---------- Componentes reutilizables ----------
function SealDot({ color, size = 10 }) {
    return React.createElement("span", { style: { display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 0 2px ${color}22`, flexShrink: 0 } });
}
function FolderTab({ children }) {
    return (React.createElement("div", { className: "relative" },
        React.createElement("div", { className: "absolute -top-2 left-4 h-2 w-14 rounded-t-md", style: { background: "var(--gold)" } }),
        children));
}
function EmptyState({ icon, title, hint }) {
    return (React.createElement("div", { className: "flex flex-col items-center justify-center text-center py-14 px-6" },
        React.createElement("div", { className: "w-14 h-14 rounded-full flex items-center justify-center mb-4", style: { background: "#ECEDEF12" } },
            React.createElement(Icon, { name: icon, size: 24, color: "var(--text)" })),
        React.createElement("p", { style: { fontFamily: "'Fraunces', serif", color: "var(--text)" }, className: "text-lg font-medium" }, title),
        React.createElement("p", { className: "text-sm mt-1 max-w-[240px]", style: { color: "#ECEDEFAA" } }, hint)));
}
function Modal({ title, onClose, children }) {
    return (React.createElement("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center", style: { background: "#000000CC" }, onClick: onClose },
        React.createElement("div", { className: "w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl", style: { background: "var(--card)" }, onClick: (e) => e.stopPropagation() },
            React.createElement("div", { className: "sticky top-0 flex items-center justify-between px-5 py-4 border-b", style: { background: "var(--card)", borderColor: "var(--hairline)" } },
                React.createElement("h3", { style: { fontFamily: "'Fraunces', serif", color: "var(--text)" }, className: "text-lg font-semibold" }, title),
                React.createElement("button", { onClick: onClose, className: "p-1 rounded-full", style: { color: "var(--text)" } },
                    React.createElement(Icon, { name: "x", size: 20 }))),
            React.createElement("div", { className: "p-5" }, children))));
}
function Field({ label, children }) {
    return (React.createElement("label", { className: "block mb-4" },
        React.createElement("span", { className: "block text-xs font-semibold uppercase tracking-wide mb-1.5", style: { color: "#ECEDEFAA", fontFamily: "'IBM Plex Mono', monospace" } }, label),
        children));
}
const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline)",
    background: "var(--bg)", color: "var(--text)", fontFamily: "'Public Sans', sans-serif", fontSize: 15, outline: "none",
};
// ---------- App principal ----------
function App() {
    const [clients, setClients] = useState([]);
    const [events, setEvents] = useState([]);
    const [notes, setNotes] = useState([]);
    const [procesosActivos, setProcesosActivos] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("inicio");
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [search, setSearch] = useState("");
    const [saveError, setSaveError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        StorageService.init()
            .then(() => Promise.all([
                StorageService.getAll("clients"),
                StorageService.getAll("events"),
                StorageService.getAll("notes"),
                ProcesoService.listAll(),
            ]))
            .then(([loadedClients, loadedEvents, loadedNotes, loadedProcesos]) => {
                if (cancelled) return;
                setClients(loadedClients);
                setEvents(loadedEvents);
                setNotes(loadedNotes);
                setProcesosActivos(loadedProcesos.length);
            })
            .catch(() => { if (!cancelled) setSaveError(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    function addClient(client) {
        const record = Object.assign(Object.assign({}, client), { id: uid(), createdAt: todayISO() });
        StorageService.put("clients", record)
            .then(() => setClients((prev) => [...prev, record]))
            .catch(() => setSaveError(true));
    }
    function deleteClient(id) {
        StorageService.remove("clients", id)
            .then(() => setClients((prev) => prev.filter((c) => c.id !== id)))
            .catch(() => setSaveError(true));
        setSelectedClient(null);
    }
    function addEvent(ev) {
        const record = Object.assign(Object.assign({}, ev), { id: uid(), done: false });
        StorageService.put("events", record)
            .then(() => setEvents((prev) => [...prev, record]))
            .catch(() => setSaveError(true));
    }
    function toggleEventDone(id) {
        const target = events.find((e) => e.id === id);
        if (!target) return;
        const updated = Object.assign(Object.assign({}, target), { done: !target.done });
        StorageService.put("events", updated)
            .then(() => setEvents((prev) => prev.map((e) => (e.id === id ? updated : e))))
            .catch(() => setSaveError(true));
    }
    function deleteEvent(id) {
        StorageService.remove("events", id)
            .then(() => setEvents((prev) => prev.filter((e) => e.id !== id)))
            .catch(() => setSaveError(true));
    }
    function addNote(note) {
        const record = Object.assign(Object.assign({}, note), { id: uid(), createdAt: todayISO() });
        StorageService.put("notes", record)
            .then(() => setNotes((prev) => [...prev, record]))
            .catch(() => setSaveError(true));
    }
    function deleteNote(id) {
        StorageService.remove("notes", id)
            .then(() => setNotes((prev) => prev.filter((n) => n.id !== id)))
            .catch(() => setSaveError(true));
    }
    const clientById = (id) => clients.find((c) => c.id === id);
    const upcomingEvents = useMemo(() => [...events].filter((e) => !e.done).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))), [events]);
    const vencimientos = useMemo(() => upcomingEvents.filter((e) => e.tipo === "vencimiento"), [upcomingEvents]);
    const filteredClients = useMemo(() => {
        if (!search.trim())
            return clients;
        const q = search.toLowerCase();
        return clients.filter((c) => c.nombre.toLowerCase().includes(q) || (c.expediente || "").toLowerCase().includes(q));
    }, [clients, search]);
    const eventsByDay = useMemo(() => {
        const groups = {};
        upcomingEvents.forEach((e) => { (groups[e.date] = groups[e.date] || []).push(e); });
        return groups;
    }, [upcomingEvents]);
    if (loading) {
        return (React.createElement("div", { className: "min-h-screen flex items-center justify-center", style: { background: "var(--bg)" } },
            React.createElement("img", { src: "logo.jpg", alt: "Gam\u00F3n & Asociados", className: "h-14 object-contain" })));
    }
    return (React.createElement("div", { className: "min-h-screen flex flex-col", style: { background: "var(--bg)", fontFamily: "'Public Sans', sans-serif" } },
        React.createElement("header", { className: "px-5 pt-4 pb-4 sticky top-0 z-30 flex flex-col items-center", style: { background: "#000000", borderBottom: "1px solid var(--hairline)" } },
            React.createElement("span", { className: "eyebrow", style: { color: "var(--gold-bright)" } }, "LEXFLOW\u2122"),
            React.createElement("img", { src: "logo.jpg", alt: "Gam\u00F3n & Asociados", className: "h-14 object-contain rounded-md mt-2" }),
            React.createElement("p", { style: { color: "var(--text)", fontFamily: "'Fraunces', serif", fontStyle: "italic", fontWeight: 500 }, className: "text-[15px] tracking-wide mt-2" }, I18N.construirSaludoCompleto()),
            React.createElement("p", { style: { color: "var(--gold)", fontFamily: "'IBM Plex Mono', monospace" }, className: "text-[11px] tracking-wide mt-1 capitalize" }, new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
            saveError && React.createElement("p", { className: "text-[11px] mt-2", style: { color: "#E0917D" } }, "No se pudo guardar. El almacenamiento del celular puede estar lleno.")),
        React.createElement("main", { className: "flex-1 px-4 pt-5 pb-24 max-w-xl w-full mx-auto" },
            tab === "inicio" && React.createElement(InicioTab, { clients: clients, eventsByDay: eventsByDay, vencimientos: vencimientos, procesosActivos: procesosActivos, onToggleDone: toggleEventDone, onGoTab: setTab }),
            tab === "agenda" && React.createElement(AgendaTab, { eventsByDay: eventsByDay, clientById: clientById, onToggleDone: toggleEventDone, onDelete: deleteEvent }),
            tab === "clientes" && !selectedClient && React.createElement(ClientesTab, { clients: filteredClients, search: search, setSearch: setSearch, events: events, onSelect: setSelectedClient }),
            tab === "clientes" && selectedClient && (React.createElement(ClienteDetail, { client: selectedClient, events: events.filter((e) => e.clienteId === selectedClient.id), notes: notes.filter((n) => n.clienteId === selectedClient.id), onBack: () => setSelectedClient(null), onDeleteClient: deleteClient, onToggleDone: toggleEventDone, onDeleteEvent: deleteEvent, onDeleteNote: deleteNote })),
            tab === "vencimientos" && (React.createElement(VencimientosTab, { vencimientos: vencimientos, clientById: clientById, onToggleDone: toggleEventDone, onAddCalculated: (date, label) => setShowAddEvent({ presetDate: date, presetTitle: label, presetTipo: "vencimiento" }) })),
            tab === "notas" && React.createElement(NotasTab, { notes: notes, clientById: clientById, onDelete: deleteNote })),
        React.createElement("button", { onClick: () => { if (tab === "clientes")
                setShowAddClient(true);
            else if (tab === "notas")
                setShowAddNote(true);
            else
                setShowAddEvent(true); }, className: "fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30", style: { background: "var(--gold)" }, "aria-label": "Agregar" },
            React.createElement(Icon, { name: "plus", size: 26, color: "var(--bg)", strokeWidth: 2.5 })),
        React.createElement("nav", { className: "fixed bottom-0 left-0 right-0 flex justify-around items-center py-2.5 z-30 border-t", style: { background: "var(--card)", borderColor: "var(--hairline)" } }, [
            { id: "inicio", label: "Inicio", icon: "home" },
            { id: "agenda", label: "Agenda", icon: "calendar" },
            { id: "clientes", label: "Clientes", icon: "briefcase" },
            { id: "vencimientos", label: "Vencimientos", icon: "alertTriangle" },
            { id: "notas", label: "Notas", icon: "stickyNote" },
        ].map(({ id, label, icon }) => (React.createElement("button", { key: id, onClick: () => { setTab(id); setSelectedClient(null); }, className: "flex flex-col items-center gap-1 px-3 py-1" },
            React.createElement(Icon, { name: icon, size: 20, color: tab === id ? "var(--gold)" : "#ECEDEF70", strokeWidth: tab === id ? 2.3 : 1.8 }),
            React.createElement("span", { className: "text-[10px] font-medium", style: { color: tab === id ? "var(--gold)" : "#ECEDEF70" } }, label))))),
        showAddEvent && React.createElement(AddEventModal, { clients: clients, preset: typeof showAddEvent === "object" ? showAddEvent : null, onClose: () => setShowAddEvent(false), onSave: (ev) => { addEvent(ev); setShowAddEvent(false); } }),
        showAddClient && React.createElement(AddClientModal, { onClose: () => setShowAddClient(false), onSave: (c) => { addClient(c); setShowAddClient(false); } }),
        showAddNote && React.createElement(AddNoteModal, { clients: clients, onClose: () => setShowAddNote(false), onSave: (n) => { addNote(n); setShowAddNote(false); } })));
}
// ---------- Tabs ----------
// ---------- Centro de Inicio (lexflow-design-system.html, DESIGN-HANDOFF.md sección 7) ----------
// Datos reales, sin nada ficticio: Audiencias hoy y Vencimientos vienen de Agenda/Vencimientos
// (ya en uso real); Procesos activos viene de ProcesoService. No incluye "Tareas" ni "Alertas"
// porque esos módulos todavía no existen — mostrar un número inventado sería mentirle al usuario.
function InicioTab({ clients, eventsByDay, vencimientos, procesosActivos, onToggleDone, onGoTab }) {
    const hoyISO = todayISO();
    const eventosHoy = eventsByDay[hoyISO] || [];
    const proximosVencimientos = vencimientos.slice(0, 3);
    return (React.createElement("div", null,
        React.createElement("div", { className: "grid grid-cols-2 gap-3 mb-6" },
            React.createElement("div", { className: "lf-card p-4" },
                React.createElement("p", { className: "eyebrow mb-1" }, "Audiencias hoy"),
                React.createElement("p", { className: "text-3xl", style: { fontFamily: "'Fraunces', serif", color: "var(--text)" } }, eventosHoy.length)),
            React.createElement("div", { className: "lf-card p-4" },
                React.createElement("p", { className: "eyebrow mb-1" }, "Vencimientos \u00B7 7 d\u00EDas"),
                React.createElement("p", { className: "text-3xl", style: { fontFamily: "'Fraunces', serif", color: "var(--text)" } }, vencimientos.length)),
            React.createElement("div", { className: "lf-card p-4" },
                React.createElement("p", { className: "eyebrow mb-1" }, "Procesos activos"),
                React.createElement("p", { className: "text-3xl", style: { fontFamily: "'Fraunces', serif", color: "var(--gold)" } }, procesosActivos)),
            React.createElement("div", { className: "lf-card p-4" },
                React.createElement("p", { className: "eyebrow mb-1" }, "Clientes"),
                React.createElement("p", { className: "text-3xl", style: { fontFamily: "'Fraunces', serif", color: "var(--text)" } }, clients.length))),
        React.createElement("div", { className: "flex items-center justify-between mb-2 px-1" },
            React.createElement("h3", { style: { fontFamily: "'Fraunces', serif", color: "var(--text)" }, className: "font-semibold" }, "Agenda de hoy"),
            React.createElement("button", { onClick: () => onGoTab("agenda"), className: "text-xs", style: { color: "var(--gold)" } }, "Ver agenda completa \u2192")),
        eventosHoy.length === 0 ? (React.createElement("div", { className: "lf-card p-5 mb-6 text-center" },
            React.createElement("p", { className: "text-sm", style: { color: "var(--text-dim, #8B929E)" } }, "Sin audiencias ni eventos para hoy."))) : (React.createElement("div", { className: "space-y-2.5 mb-6" }, eventosHoy.map((ev) => React.createElement(EventCard, { key: ev.id, event: ev, client: clients.find((c) => c.id === ev.clienteId), onToggleDone: onToggleDone, onDelete: () => { } })))),
        React.createElement("div", { className: "flex items-center justify-between mb-2 px-1" },
            React.createElement("h3", { style: { fontFamily: "'Fraunces', serif", color: "var(--text)" }, className: "font-semibold" }, "Pr\u00F3ximos vencimientos"),
            React.createElement("button", { onClick: () => onGoTab("vencimientos"), className: "text-xs", style: { color: "var(--gold)" } }, "Ver todos \u2192")),
        proximosVencimientos.length === 0 ? (React.createElement("div", { className: "lf-card p-5 text-center" },
            React.createElement("p",
