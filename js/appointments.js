"use strict";

const appointmentForm = document.getElementById("appointmentForm");
const upcomingList = document.getElementById("upcomingAppointmentsList");
const pastList = document.getElementById("pastAppointmentsList");
const appointmentMessage = document.getElementById("appointmentMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveAppointmentBtn = document.getElementById("saveAppointmentBtn");
const dateInput = document.getElementById("date");
const searchInput = document.getElementById("appointmentSearch");
const typeFilter = document.getElementById("typeFilter");
let appointmentsCache = [];

function todayString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

dateInput.min = todayString();

function showAppointmentMessage(message, isError = false) {
    appointmentMessage.textContent = message;
    appointmentMessage.classList.toggle("message-error", isError);
}

function appointmentDate(appointment) {
    return new Date(`${appointment.date}T${appointment.time}`);
}

function formatAppointmentDate(date, time) {
    const value = new Date(`${date}T${time}`);
    if (Number.isNaN(value.getTime())) return `${date} at ${time}`;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function getSelectedTime() {
    const hour = Number(document.getElementById("timeHour").value);
    const minute = document.getElementById("timeMinute").value;
    const period = document.getElementById("timePeriod").value;
    let hour24 = hour;
    if (period === "AM" && hour === 12) hour24 = 0;
    if (period === "PM" && hour !== 12) hour24 = hour + 12;
    return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function setSelectedTime(time) {
    const [hourText, minuteText] = time.slice(0, 5).split(":");
    const hour24 = Number(hourText);
    document.getElementById("timeHour").value = String(hour24 % 12 || 12);
    document.getElementById("timeMinute").value = minuteText;
    document.getElementById("timePeriod").value = hour24 >= 12 ? "PM" : "AM";
    document.getElementById("time").value = time.slice(0, 5);
}

function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

function renderGroup(target, appointments, emptyMessage) {
    target.replaceChildren();
    if (!appointments.length) {
        target.append(makeElement("p", emptyMessage, "empty-state"));
        return;
    }

    appointments.forEach((appointment) => {
        const article = makeElement("article", undefined, `appointment-item${appointment.status === "completed" ? " is-completed" : ""}`);
        const content = makeElement("div", undefined, "appointment-content");
        const headingRow = makeElement("div", undefined, "appointment-title-row");
        headingRow.append(makeElement("h4", appointment.name));
        if (appointment.status === "completed") headingRow.append(makeElement("span", "Completed", "status-badge"));
        content.append(headingRow, makeElement("p", appointment.type, "appointment-type"), makeElement("p", formatAppointmentDate(appointment.date, appointment.time), "appointment-date"));
        if (appointment.notes) content.append(makeElement("p", appointment.notes, "appointment-notes"));

        const actions = makeElement("div", undefined, "appointment-actions");
        if (appointment.status !== "completed") {
            const completeButton = makeElement("button", "Mark completed", "btn btn-secondary btn-small");
            completeButton.type = "button";
            completeButton.addEventListener("click", () => markCompleted(appointment.id));
            actions.append(completeButton);
        }
        const deleteButton = makeElement("button", "Delete", "btn btn-danger btn-small");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteAppointment(appointment.id));
        if (appointment.status !== "completed" && appointmentDate(appointment) >= new Date()) {
            const editButton = makeElement("button", "Edit", "btn btn-secondary btn-small");
            editButton.type = "button";
            editButton.addEventListener("click", () => beginEdit(appointment.id));
            actions.append(editButton);
        }
        actions.append(deleteButton);
        article.append(content, actions);
        target.append(article);
    });
}

function displayAppointments() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const filtered = appointmentsCache.filter((appointment) => {
        const text = `${appointment.name} ${appointment.type} ${appointment.notes || ""}`.toLowerCase();
        return (!search || text.includes(search)) && (!selectedType || appointment.type === selectedType);
    });
    const now = new Date();
    const upcoming = filtered.filter((item) => item.status !== "completed" && appointmentDate(item) >= now);
    const past = filtered.filter((item) => item.status === "completed" || appointmentDate(item) < now).sort((a, b) => appointmentDate(b) - appointmentDate(a));
    renderGroup(upcomingList, upcoming, "No upcoming appointments match your filters.");
    renderGroup(pastList, past, "No past or completed appointments match your filters.");
}

async function loadAppointments() {
    const session = await window.dashboardSessionPromise;
    if (!session) return;
    upcomingList.replaceChildren(makeElement("p", "Loading appointments..."));
    const { data, error } = await supabaseClient.from("appointments").select("id, user_id, name, type, date, time, notes, status, created_at").eq("user_id", session.user.id).order("date", { ascending: true }).order("time", { ascending: true });
    if (error) {
        upcomingList.replaceChildren(makeElement("p", `Unable to load appointments: ${error.message}`, "message-error"));
        return;
    }
    appointmentsCache = data || [];
    displayAppointments();
}

function resetAppointmentForm() {
    appointmentForm.reset();
    dateInput.min = todayString();
    document.getElementById("appointmentId").value = "";
    saveAppointmentBtn.textContent = "Save appointment";
    cancelEditBtn.hidden = true;
}

function beginEdit(id) {
    const appointment = appointmentsCache.find((item) => item.id === id);
    if (!appointment) return;
    document.getElementById("appointmentId").value = appointment.id;
    document.getElementById("name").value = appointment.name;
    document.getElementById("type").value = appointment.type;
    dateInput.min = appointment.date < todayString() ? appointment.date : todayString();
    dateInput.value = appointment.date;
    setSelectedTime(appointment.time);
    document.getElementById("notes").value = appointment.notes || "";
    saveAppointmentBtn.textContent = "Update appointment";
    cancelEditBtn.hidden = false;
    appointmentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("name").focus();
}

appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const session = await window.dashboardSessionPromise;
    if (!session) return;
    const id = document.getElementById("appointmentId").value;
    const selectedTime = getSelectedTime();
    const selectedDate = dateInput.value;
    if (new Date(`${selectedDate}T${selectedTime}`) <= new Date()) {
        showAppointmentMessage("Choose a future date and time.", true);
        return;
    }
    const appointment = { user_id: session.user.id, name: document.getElementById("name").value.trim(), type: document.getElementById("type").value, date: selectedDate, time: selectedTime, notes: document.getElementById("notes").value.trim() || null };
    saveAppointmentBtn.disabled = true;
    showAppointmentMessage(id ? "Updating appointment..." : "Saving appointment...");
    const query = id ? supabaseClient.from("appointments").update(appointment).eq("id", id).eq("user_id", session.user.id) : supabaseClient.from("appointments").insert(appointment);
    const { error } = await query;
    saveAppointmentBtn.disabled = false;
    if (error) { showAppointmentMessage(`Unable to save appointment: ${error.message}`, true); return; }
    resetAppointmentForm();
    showAppointmentMessage(id ? "Appointment updated." : "Appointment saved.");
    await loadAppointments();
});

async function markCompleted(id) {
    const session = await window.dashboardSessionPromise;
    if (!session) return;
    const { error } = await supabaseClient.from("appointments").update({ status: "completed" }).eq("id", id).eq("user_id", session.user.id);
    if (error) { showAppointmentMessage(`Unable to complete appointment: ${error.message}`, true); return; }
    showAppointmentMessage("Appointment marked completed.");
    await loadAppointments();
}

async function deleteAppointment(id) {
    if (!window.confirm("Permanently delete this appointment?")) return;
    const session = await window.dashboardSessionPromise;
    if (!session) return;
    const { error } = await supabaseClient.from("appointments").delete().eq("id", id).eq("user_id", session.user.id);
    if (error) { showAppointmentMessage(`Unable to delete appointment: ${error.message}`, true); return; }
    showAppointmentMessage("Appointment deleted.");
    await loadAppointments();
}

cancelEditBtn.addEventListener("click", resetAppointmentForm);
document.getElementById("refreshBtn").addEventListener("click", loadAppointments);
searchInput.addEventListener("input", displayAppointments);
typeFilter.addEventListener("change", displayAppointments);
loadAppointments();
