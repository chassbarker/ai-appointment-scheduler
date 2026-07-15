"use strict";

const appointmentForm = document.getElementById("appointmentForm");
const appointmentsList = document.getElementById("appointmentsList");
const appointmentMessage = document.getElementById("appointmentMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveAppointmentBtn = document.getElementById("saveAppointmentBtn");
let appointmentsCache = [];

function showAppointmentMessage(message, isError = false) {
    appointmentMessage.textContent = message;
    appointmentMessage.classList.toggle("message-error", isError);
}

function formatAppointmentDate(date, time) {
    const value = new Date(`${date}T${time}`);
    if (Number.isNaN(value.getTime())) return `${date} at ${time}`;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(value);
}

function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

function displayAppointments(appointments) {
    appointmentsList.replaceChildren();

    if (!appointments.length) {
        appointmentsList.append(makeElement("p", "No appointments scheduled yet.", "empty-state"));
        return;
    }

    appointments.forEach((appointment) => {
        const article = makeElement("article", undefined, "appointment-item");
        const content = makeElement("div", undefined, "appointment-content");
        content.append(
            makeElement("h3", appointment.name),
            makeElement("p", appointment.type, "appointment-type"),
            makeElement("p", formatAppointmentDate(appointment.date, appointment.time), "appointment-date")
        );
        if (appointment.notes) content.append(makeElement("p", appointment.notes, "appointment-notes"));

        const actions = makeElement("div", undefined, "appointment-actions");
        const editButton = makeElement("button", "Edit", "btn btn-secondary btn-small");
        editButton.type = "button";
        editButton.addEventListener("click", () => beginEdit(appointment.id));
        const deleteButton = makeElement("button", "Delete", "btn btn-danger btn-small");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteAppointment(appointment.id));
        actions.append(editButton, deleteButton);
        article.append(content, actions);
        appointmentsList.append(article);
    });
}

async function loadAppointments() {
    const session = await window.dashboardSessionPromise;
    if (!session) return;

    appointmentsList.replaceChildren(makeElement("p", "Loading appointments…"));
    const { data, error } = await supabaseClient
        .from("appointments")
        .select("id, user_id, name, type, date, time, notes, created_at")
        .eq("user_id", session.user.id)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

    if (error) {
        appointmentsList.replaceChildren(makeElement("p", `Unable to load appointments: ${error.message}`, "message-error"));
        return;
    }

    appointmentsCache = data || [];
    displayAppointments(appointmentsCache);
}

function resetAppointmentForm() {
    appointmentForm.reset();
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
    document.getElementById("date").value = appointment.date;
    document.getElementById("time").value = appointment.time.slice(0, 5);
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
    const appointment = {
        user_id: session.user.id,
        name: document.getElementById("name").value.trim(),
        type: document.getElementById("type").value.trim(),
        date: document.getElementById("date").value,
        time: document.getElementById("time").value,
        notes: document.getElementById("notes").value.trim() || null
    };

    saveAppointmentBtn.disabled = true;
    showAppointmentMessage(id ? "Updating appointment…" : "Saving appointment…");

    const query = id
        ? supabaseClient.from("appointments").update(appointment).eq("id", id).eq("user_id", session.user.id)
        : supabaseClient.from("appointments").insert(appointment);
    const { error } = await query;
    saveAppointmentBtn.disabled = false;

    if (error) {
        showAppointmentMessage(`Unable to save appointment: ${error.message}`, true);
        return;
    }

    resetAppointmentForm();
    showAppointmentMessage(id ? "Appointment updated." : "Appointment saved.");
    await loadAppointments();
});

async function deleteAppointment(id) {
    if (!window.confirm("Delete this appointment?")) return;
    const session = await window.dashboardSessionPromise;
    if (!session) return;
    const { error } = await supabaseClient.from("appointments").delete().eq("id", id).eq("user_id", session.user.id);

    if (error) {
        showAppointmentMessage(`Unable to delete appointment: ${error.message}`, true);
        return;
    }

    showAppointmentMessage("Appointment deleted.");
    await loadAppointments();
}

cancelEditBtn.addEventListener("click", resetAppointmentForm);
document.getElementById("refreshBtn").addEventListener("click", loadAppointments);
loadAppointments();
