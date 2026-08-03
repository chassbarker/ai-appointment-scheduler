"use strict";

const appointmentForm = document.getElementById("appointmentForm");
const upcomingList = document.getElementById("upcomingAppointmentsList");
const pastList = document.getElementById("pastAppointmentsList");
const appointmentMessage = document.getElementById("appointmentMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveAppointmentBtn = document.getElementById("saveAppointmentBtn");
const dateInput = document.getElementById("date");
const providerSelect = document.getElementById("provider");
const durationSelect = document.getElementById("duration");
const searchInput = document.getElementById("appointmentSearch");
const typeFilter = document.getElementById("typeFilter");
const manualAppointmentSection = document.getElementById("manualAppointmentSection");
const openManualFormBtn = document.getElementById("openManualFormBtn");
let appointmentsCache = [];

const STATUS_LABELS = Object.freeze({
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show"
});

function todayString() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

dateInput.min = todayString();

function showAppointmentMessage(message, isError = false) {
    appointmentMessage.textContent = message;
    appointmentMessage.classList.toggle("message-error", isError);
    if (isError) appointmentMessage.focus();
}

function schedulingErrorMessage(error) {
    if (error?.code === "23P01") {
        return "That provider is already booked during the selected time. Choose another provider or time.";
    }

    if (error?.code === "P0001" && error.message) {
        return error.message;
    }

    return error?.message || "An unexpected scheduling error occurred.";
}

function requireAffectedAppointment(data) {
    if (!Array.isArray(data) || data.length !== 1) {
        throw new Error("The appointment no longer exists or is not available to this account.");
    }
}

function appointmentDate(appointment) {
    return new Date(`${appointment.date}T${appointment.time}`);
}

function formatAppointmentDate(date, time) {
    const value = new Date(`${date}T${time}`);
    if (Number.isNaN(value.getTime())) return `${date} at ${time}`;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(value);
}

function formatDuration(minutes) {
    if (minutes === 60) return "1 hour";
    if (minutes === 90) return "1 hour 30 minutes";
    return `${minutes} minutes`;
}

function providerName(appointment) {
    return appointment.providers?.name || "Provider unavailable";
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

function appendStatusBadge(target, status) {
    if (status === "scheduled") return;
    target.append(makeElement("span", STATUS_LABELS[status] || status, "status-badge"));
}

function renderGroup(target, appointments, emptyMessage) {
    target.replaceChildren();
    if (!appointments.length) {
        target.append(makeElement("p", emptyMessage, "empty-state"));
        return;
    }

    appointments.forEach((appointment) => {
        const article = makeElement(
            "article",
            undefined,
            `appointment-item${appointment.status !== "scheduled" ? " is-completed" : ""}`
        );
        const content = makeElement("div", undefined, "appointment-content");
        const headingRow = makeElement("div", undefined, "appointment-title-row");
        headingRow.append(makeElement("h4", appointment.name));
        appendStatusBadge(headingRow, appointment.status);

        content.append(
            headingRow,
            makeElement("p", appointment.type, "appointment-type"),
            makeElement("p", `Provider: ${providerName(appointment)}`, "appointment-provider"),
            makeElement(
                "p",
                `${formatAppointmentDate(appointment.date, appointment.time)} · ${formatDuration(appointment.duration_minutes)}`,
                "appointment-date"
            )
        );

        if (appointment.notes) {
            content.append(makeElement("p", appointment.notes, "appointment-notes"));
        }

        const actions = makeElement("div", undefined, "appointment-actions");
        const isFuture = appointmentDate(appointment) > new Date();

        if (appointment.status === "scheduled") {
            if (!isFuture) {
                const completeButton = makeElement(
                    "button",
                    "Mark completed",
                    "btn btn-secondary btn-small"
                );
                completeButton.type = "button";
                completeButton.addEventListener("click", () => markCompleted(appointment.id));
                actions.append(completeButton);
            }

            if (isFuture) {
                const editButton = makeElement("button", "Edit", "btn btn-secondary btn-small");
                editButton.type = "button";
                editButton.addEventListener("click", () => beginEdit(appointment.id));

                const cancelButton = makeElement("button", "Cancel", "btn btn-danger btn-small");
                cancelButton.type = "button";
                cancelButton.addEventListener("click", () => cancelAppointment(appointment.id));
                actions.append(editButton, cancelButton);
            }
        }

        article.append(content, actions);
        target.append(article);
    });
}

function displayAppointments() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const filtered = appointmentsCache.filter((appointment) => {
        const text = `${appointment.name} ${appointment.type} ${providerName(appointment)} ${appointment.notes || ""}`.toLowerCase();
        return (!search || text.includes(search))
            && (!selectedType || appointment.type === selectedType);
    });

    const now = new Date();
    const upcoming = filtered.filter((item) =>
        item.status === "scheduled" && appointmentDate(item) >= now
    );
    const history = filtered
        .filter((item) => item.status !== "scheduled" || appointmentDate(item) < now)
        .sort((a, b) => appointmentDate(b) - appointmentDate(a));

    renderGroup(upcomingList, upcoming, "No upcoming appointments match your filters.");
    renderGroup(pastList, history, "No appointment history matches your filters.");
}

async function loadAppointments() {
    const session = await window.dashboardSessionPromise;
    if (!session) return;

    upcomingList.replaceChildren(makeElement("p", "Loading appointments..."));

    try {
        await window.providerDirectoryPromise;
        const { data, error } = await supabaseClient
            .from("appointments")
            .select("id, user_id, provider_id, name, type, date, time, duration_minutes, notes, status, created_at, cancelled_at, completed_at, no_show_at, providers(name)")
            .eq("user_id", session.user.id)
            .order("date", { ascending: true })
            .order("time", { ascending: true });

        if (error) throw error;
        appointmentsCache = data || [];
        displayAppointments();
    } catch (error) {
        upcomingList.replaceChildren(
            makeElement("p", `Unable to load appointments: ${error.message}`, "message-error")
        );
    }
}

function selectOnlyProvider() {
    const availableOptions = Array.from(providerSelect.options).filter((option) => option.value);
    if (availableOptions.length === 1) providerSelect.value = availableOptions[0].value;
}

function resetAppointmentForm() {
    appointmentForm.reset();
    dateInput.min = todayString();
    document.getElementById("appointmentId").value = "";
    durationSelect.value = "30";
    selectOnlyProvider();
    saveAppointmentBtn.textContent = "Save appointment";
    cancelEditBtn.hidden = true;
}

function beginEdit(id) {
    const appointment = appointmentsCache.find((item) => item.id === id);
    if (!appointment) return;

    document.getElementById("appointmentId").value = appointment.id;
    document.getElementById("name").value = appointment.name;
    document.getElementById("type").value = appointment.type;
    providerSelect.value = appointment.provider_id;
    durationSelect.value = String(appointment.duration_minutes);
    dateInput.min = appointment.date < todayString() ? appointment.date : todayString();
    dateInput.value = appointment.date;
    setSelectedTime(appointment.time);
    document.getElementById("notes").value = appointment.notes || "";
    saveAppointmentBtn.textContent = "Update appointment";
    cancelEditBtn.hidden = false;
    manualAppointmentSection.open = true;
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

    if (!providerSelect.value) {
        providerSelect.setAttribute("aria-invalid", "true");
        showAppointmentMessage("Select an appointment provider.", true);
        providerSelect.focus();
        return;
    }

    if (new Date(`${selectedDate}T${selectedTime}`) <= new Date()) {
        dateInput.setAttribute("aria-invalid", "true");
        showAppointmentMessage("Choose a future date and time.", true);
        return;
    }

    providerSelect.removeAttribute("aria-invalid");
    dateInput.removeAttribute("aria-invalid");

    const appointment = {
        user_id: session.user.id,
        provider_id: providerSelect.value,
        name: document.getElementById("name").value.trim(),
        type: document.getElementById("type").value,
        date: selectedDate,
        time: selectedTime,
        duration_minutes: Number(durationSelect.value),
        notes: document.getElementById("notes").value.trim() || null,
        status: "scheduled"
    };

    saveAppointmentBtn.disabled = true;
    showAppointmentMessage(id ? "Updating appointment..." : "Saving appointment...");

    try {
        const result = id
            ? await supabaseClient
                .from("appointments")
                .update(appointment)
                .eq("id", id)
                .eq("user_id", session.user.id)
                .select("id")
            : await supabaseClient.from("appointments").insert(appointment);

        if (result.error) throw result.error;
        if (id) requireAffectedAppointment(result.data);
        resetAppointmentForm();
        showAppointmentMessage(id ? "Appointment updated." : "Appointment saved.");
        await loadAppointments();
    } catch (error) {
        showAppointmentMessage(`Unable to save appointment: ${schedulingErrorMessage(error)}`, true);
    } finally {
        saveAppointmentBtn.disabled = false;
    }
});

async function markCompleted(id) {
    const session = await window.dashboardSessionPromise;
    if (!session) return;

    try {
        const { data, error } = await supabaseClient
            .from("appointments")
            .update({ status: "completed" })
            .eq("id", id)
            .eq("user_id", session.user.id)
            .select("id");

        if (error) throw error;
        requireAffectedAppointment(data);
        showAppointmentMessage("Appointment marked completed.");
        await loadAppointments();
    } catch (error) {
        showAppointmentMessage(`Unable to complete appointment: ${error.message}`, true);
    }
}

async function cancelAppointment(id) {
    if (!window.confirm("Cancel this appointment? It will remain in appointment history.")) return;

    const session = await window.dashboardSessionPromise;
    if (!session) return;

    try {
        const { data, error } = await supabaseClient
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("id", id)
            .eq("user_id", session.user.id)
            .select("id");

        if (error) throw error;
        requireAffectedAppointment(data);
        showAppointmentMessage("Appointment cancelled.");
        await loadAppointments();
    } catch (error) {
        showAppointmentMessage(`Unable to cancel appointment: ${error.message}`, true);
    }
}

cancelEditBtn.addEventListener("click", resetAppointmentForm);
openManualFormBtn.addEventListener("click", () => {
    manualAppointmentSection.open = true;
    appointmentForm.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("name").focus();
});
document.getElementById("refreshBtn").addEventListener("click", loadAppointments);
searchInput.addEventListener("input", displayAppointments);
typeFilter.addEventListener("change", displayAppointments);
window.appointmentsDashboard = Object.freeze({ loadAppointments });
loadAppointments();
