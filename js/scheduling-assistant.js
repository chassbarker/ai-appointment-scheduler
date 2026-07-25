"use strict";

(() => {
    const ALLOWED_TYPES = [
        "Consultation",
        "Follow-up",
        "Medical",
        "Dental",
        "Vision",
        "Therapy",
        "Personal",
        "Business",
        "Other"
    ];
    const TYPE_PROMPT = `What appointment type? Choose: ${ALLOWED_TYPES.join(", ")}.`;
    const conversation = document.getElementById("assistantConversation");
    const form = document.getElementById("assistantForm");
    const input = document.getElementById("assistantInput");
    const sendButton = document.getElementById("assistantSendBtn");
    const status = document.getElementById("assistantStatus");
    const actionButtons = Array.from(document.querySelectorAll("[data-assistant-action]"));
    const initialState = () => ({
        mode: "idle",
        fields: {},
        appointments: [],
        selectedAppointment: null
    });
    let state = initialState();
    let isBusy = false;

    if (!conversation || !form || !input || !sendButton || !status) return;

    function dateToStorage(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function todayStorage() {
        return dateToStorage(new Date());
    }

    function validCalendarDate(year, month, day) {
        const value = new Date(year, month - 1, day);
        return value.getFullYear() === year
            && value.getMonth() === month - 1
            && value.getDate() === day;
    }

    function buildDateResult(year, month, day) {
        if (!validCalendarDate(year, month, day)) {
            return { provided: true, error: "Enter a real calendar date." };
        }
        return { provided: true, value: dateToStorage(new Date(year, month - 1, day)) };
    }

    function parseDate(text) {
        const normalized = text.toLowerCase();
        const now = new Date();
        const relativeMatch = normalized.match(/\b(day after tomorrow|today|tomorrow|yesterday)\b/);
        if (relativeMatch) {
            const offsets = { yesterday: -1, today: 0, tomorrow: 1, "day after tomorrow": 2 };
            const value = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsets[relativeMatch[1]]);
            return { provided: true, value: dateToStorage(value) };
        }

        const isoMatch = normalized.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
        if (isoMatch) return buildDateResult(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

        const numericMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
        if (numericMatch) {
            let year = numericMatch[3] ? Number(numericMatch[3]) : now.getFullYear();
            if (year < 100) year += 2000;
            return buildDateResult(year, Number(numericMatch[1]), Number(numericMatch[2]));
        }

        const monthNames = {
            january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
            april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
            august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10,
            oct: 10, november: 11, nov: 11, december: 12, dec: 12
        };
        const monthMatch = normalized.match(/\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/);
        if (monthMatch) {
            return buildDateResult(
                monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear(),
                monthNames[monthMatch[1]],
                Number(monthMatch[2])
            );
        }

        const weekdays = {
            sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
            thursday: 4, friday: 5, saturday: 6
        };
        const weekdayMatch = normalized.match(/\b(?:this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
        if (weekdayMatch) {
            let daysAhead = (weekdays[weekdayMatch[1]] - now.getDay() + 7) % 7;
            if (daysAhead === 0 || weekdayMatch[0].startsWith("next ")) daysAhead += 7;
            const value = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
            return { provided: true, value: dateToStorage(value) };
        }

        const looksLikeDate = /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(normalized);
        return looksLikeDate
            ? { provided: true, error: "Enter a real calendar date." }
            : { provided: false };
    }

    function parseTime(text) {
        const normalized = text.toLowerCase().replace(/\./g, "");
        const twelveHour = normalized.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/);
        if (twelveHour) {
            let hour = Number(twelveHour[1]);
            const minute = Number(twelveHour[2] || "00");
            if (twelveHour[3] === "am" && hour === 12) hour = 0;
            if (twelveHour[3] === "pm" && hour !== 12) hour += 12;
            return { provided: true, value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
        }

        const twentyFourHour = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (twentyFourHour) {
            return {
                provided: true,
                value: `${String(Number(twentyFourHour[1])).padStart(2, "0")}:${twentyFourHour[2]}`
            };
        }

        const looksLikeTime = /\b\d{1,2}:\d{2}\b|\b(?:at\s+)?\d{1,2}\s*(?:am|pm)\b|\bat\s+\d{1,2}\b/.test(normalized);
        return looksLikeTime
            ? { provided: true, error: "Enter a real time, including AM or PM when needed." }
            : { provided: false };
    }

    function parseType(text) {
        const normalized = text.toLowerCase();
        const match = ALLOWED_TYPES.find((type) => {
            const phrase = type === "Follow-up" ? "follow[\\s-]?up" : type.toLowerCase();
            return new RegExp(`\\b${phrase}\\b`, "i").test(normalized);
        });
        return match || null;
    }

    function formatDate(date) {
        const value = new Date(`${date}T12:00:00`);
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(value);
    }

    function formatTime(time) {
        const [hour, minute] = time.slice(0, 5).split(":").map(Number);
        return new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit"
        }).format(new Date(2000, 0, 1, hour, minute));
    }

    function appointmentDateTime(appointment) {
        return new Date(`${appointment.date}T${appointment.time}`);
    }

    function fieldsAreFuture(fields) {
        return new Date(`${fields.date}T${fields.time}`) > new Date();
    }

    function setBusy(busy, message = "") {
        isBusy = busy;
        form.setAttribute("aria-busy", String(busy));
        input.disabled = busy;
        sendButton.disabled = busy;
        actionButtons.forEach((button) => { button.disabled = busy; });
        status.textContent = message;
        status.classList.remove("message-error");
    }

    function showStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle("message-error", isError);
        if (isError) status.focus();
    }

    function scrollConversation() {
        conversation.scrollTop = conversation.scrollHeight;
    }

    function addMessage(text, role = "assistant") {
        const message = document.createElement("div");
        message.className = `assistant-message assistant-message-${role}`;
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        message.append(paragraph);
        conversation.append(message);
        scrollConversation();
        return message;
    }

    function focusInput() {
        if (!isBusy) input.focus();
    }

    function resetConversationState() {
        state = initialState();
    }

    function isYes(text) {
        return /^(yes|y|yes please|yep|sure|ok|okay|confirm|please do|book it|reschedule it|cancel it)[.!]?$/i.test(text.trim());
    }

    function isNo(text) {
        return /^(no|n|no thanks|do not|don't|never mind|nevermind|stop)[.!]?$/i.test(text.trim());
    }

    function isStop(text) {
        return /^(stop|cancel this|never mind|nevermind|start over)$/i.test(text.trim());
    }

    function bookingIntent(text) {
        return /\b(book|schedule|set up|make)\b.*\b(appointment|consultation|follow[\s-]?up|medical|dental|vision|therapy|personal|business)\b|\bbook\b|\bschedule an? appointment\b|\b(want|need|like)\b.*\bappointment\b/i.test(text);
    }

    function rescheduleIntent(text) {
        return /\b(reschedule|move|change)\b.*\bappointment\b|\breschedule\b/i.test(text);
    }

    function cancellationIntent(text) {
        return /\b(cancel|delete)\b.*\bappointment\b|\bcancel an? appointment\b/i.test(text);
    }

    function nextBookingPrompt() {
        if (!state.fields.type) return TYPE_PROMPT;
        if (!state.fields.date) return "What date would you like?";
        if (!state.fields.time) return "What time would you like?";
        return "";
    }

    function bookingSummary() {
        return `I have you down for ${state.fields.type} on ${formatDate(state.fields.date)} at ${formatTime(state.fields.time)}. Should I book it?`;
    }

    function validateAndStoreDateTime(text, fields) {
        const dateResult = fields.date ? { provided: false } : parseDate(text);
        const timeResult = fields.time ? { provided: false } : parseTime(text);

        if (dateResult.error) return { error: dateResult.error, field: "date" };
        if (timeResult.error) return { error: timeResult.error, field: "time" };

        if (dateResult.value) {
            if (dateResult.value < todayStorage()) {
                return { error: "Choose a future date.", field: "date" };
            }
            fields.date = dateResult.value;
        }
        if (timeResult.value) fields.time = timeResult.value;

        if (fields.date && fields.time && !fieldsAreFuture(fields)) {
            if (dateResult.value && timeResult.value) {
                delete fields.date;
                delete fields.time;
                return { error: "Choose a future date and time.", field: "date" };
            }
            if (timeResult.value) {
                delete fields.time;
                return { error: "Choose a future time.", field: "time" };
            }
            delete fields.date;
            return { error: "Choose a future date.", field: "date" };
        }

        return { dateProvided: dateResult.provided, timeProvided: timeResult.provided };
    }

    function collectBookingFields(text, firstMessage = false) {
        const type = state.fields.type ? null : parseType(text);
        const previousCount = Object.keys(state.fields).length;
        if (type) state.fields.type = type;

        const result = validateAndStoreDateTime(text, state.fields);
        if (result.error) {
            addMessage(result.error);
            focusInput();
            return;
        }

        if (!state.fields.type && !firstMessage && Object.keys(state.fields).length === previousCount) {
            addMessage(`That type is not available. ${TYPE_PROMPT}`);
            focusInput();
            return;
        }

        const prompt = nextBookingPrompt();
        if (prompt) {
            addMessage(prompt);
            focusInput();
            return;
        }

        state.mode = "booking-confirm";
        addMessage(bookingSummary());
        focusInput();
    }

    async function currentSession() {
        const session = await window.dashboardSessionPromise;
        if (!session) throw new Error("Your session has expired. Log in again.");
        return session;
    }

    async function refreshDashboard() {
        if (window.appointmentsDashboard?.loadAppointments) {
            await window.appointmentsDashboard.loadAppointments();
        }
    }

    async function saveBooking() {
        setBusy(true, "Saving appointment...");
        try {
            const session = await currentSession();
            const appointment = {
                user_id: session.user.id,
                name: state.fields.type,
                type: state.fields.type,
                date: state.fields.date,
                time: state.fields.time,
                notes: null,
                status: "scheduled"
            };
            const { error } = await supabaseClient.from("appointments").insert(appointment);
            if (error) throw error;
            resetConversationState();
            addMessage("Appointment booked.");
            await refreshDashboard();
            setBusy(false);
            focusInput();
        } catch (error) {
            setBusy(false);
            showStatus(`Unable to book: ${error.message}`, true);
            addMessage("I could not book that appointment. Please try again.");
            focusInput();
        }
    }

    function renderAppointmentChoices(mode) {
        const label = mode === "reschedule" ? "Select an appointment to reschedule." : "Select an appointment to cancel.";
        const message = addMessage(label);
        const list = document.createElement("div");
        list.className = "assistant-choice-list";
        list.setAttribute("role", "group");
        list.setAttribute("aria-label", label);

        state.appointments.forEach((appointment, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-source assistant-choice";
            button.textContent = `${index + 1}. ${appointment.type} — ${formatDate(appointment.date)} at ${formatTime(appointment.time)}`;
            button.addEventListener("click", () => selectAppointment(index));
            list.append(button);
        });
        message.append(list);
        scrollConversation();
        list.querySelector("button")?.focus();
    }

    async function beginSelection(mode) {
        resetConversationState();
        state.mode = `${mode}-select`;
        setBusy(true, "Loading upcoming appointments...");
        try {
            const session = await currentSession();
            const { data, error } = await supabaseClient
                .from("appointments")
                .select("id, user_id, name, type, date, time, status")
                .eq("user_id", session.user.id)
                .eq("status", "scheduled")
                .gte("date", todayStorage())
                .order("date", { ascending: true })
                .order("time", { ascending: true });
            if (error) throw error;
            state.appointments = (data || []).filter((appointment) => appointmentDateTime(appointment) > new Date());
            setBusy(false);
            if (!state.appointments.length) {
                addMessage("You have no upcoming appointments.");
                resetConversationState();
                focusInput();
                return;
            }
            renderAppointmentChoices(mode);
        } catch (error) {
            setBusy(false);
            resetConversationState();
            showStatus(`Unable to load appointments: ${error.message}`, true);
            addMessage("I could not load your appointments. Please try again.");
            focusInput();
        }
    }

    function selectAppointment(index) {
        if (!Number.isInteger(index) || index < 0 || index >= state.appointments.length) {
            addMessage("Select one of the appointments shown.");
            focusInput();
            return;
        }
        state.selectedAppointment = state.appointments[index];
        state.fields = {};
        if (state.mode === "reschedule-select") {
            state.mode = "reschedule-fields";
            addMessage("What new date would you like?");
        } else if (state.mode === "cancel-select") {
            state.mode = "cancel-confirm";
            const appointment = state.selectedAppointment;
            addMessage(`Cancel ${appointment.type} on ${formatDate(appointment.date)} at ${formatTime(appointment.time)}?`);
        }
        focusInput();
    }

    function collectRescheduleFields(text) {
        const result = validateAndStoreDateTime(text, state.fields);
        if (result.error) {
            addMessage(result.error);
            focusInput();
            return;
        }
        if (!state.fields.date) {
            addMessage("What new date would you like?");
            focusInput();
            return;
        }
        if (!state.fields.time) {
            addMessage("What new time would you like?");
            focusInput();
            return;
        }
        state.mode = "reschedule-confirm";
        addMessage(`Move ${state.selectedAppointment.type} to ${formatDate(state.fields.date)} at ${formatTime(state.fields.time)}?`);
        focusInput();
    }

    async function saveReschedule() {
        setBusy(true, "Rescheduling appointment...");
        try {
            const session = await currentSession();
            const { error } = await supabaseClient
                .from("appointments")
                .update({ date: state.fields.date, time: state.fields.time })
                .eq("id", state.selectedAppointment.id)
                .eq("user_id", session.user.id);
            if (error) throw error;
            resetConversationState();
            addMessage("Appointment rescheduled.");
            await refreshDashboard();
            setBusy(false);
            focusInput();
        } catch (error) {
            setBusy(false);
            showStatus(`Unable to reschedule: ${error.message}`, true);
            addMessage("I could not reschedule that appointment. Please try again.");
            focusInput();
        }
    }

    async function saveCancellation() {
        setBusy(true, "Cancelling appointment...");
        try {
            const session = await currentSession();
            const { error } = await supabaseClient
                .from("appointments")
                .delete()
                .eq("id", state.selectedAppointment.id)
                .eq("user_id", session.user.id);
            if (error) throw error;
            resetConversationState();
            addMessage("Appointment cancelled.");
            await refreshDashboard();
            setBusy(false);
            focusInput();
        } catch (error) {
            setBusy(false);
            showStatus(`Unable to cancel: ${error.message}`, true);
            addMessage("I could not cancel that appointment. Please try again.");
            focusInput();
        }
    }

    async function handleConfirmation(text) {
        if (isNo(text)) {
            resetConversationState();
            addMessage("Okay. I did not make any changes.");
            focusInput();
            return;
        }
        if (!isYes(text)) {
            addMessage("Please answer yes or no.");
            focusInput();
            return;
        }
        if (state.mode === "booking-confirm") await saveBooking();
        else if (state.mode === "reschedule-confirm") await saveReschedule();
        else if (state.mode === "cancel-confirm") await saveCancellation();
    }

    async function handleMessage(text) {
        if (isStop(text) && !state.mode.endsWith("-confirm")) {
            resetConversationState();
            addMessage("Okay. What would you like to do?");
            focusInput();
            return;
        }

        if (state.mode.endsWith("-confirm")) {
            await handleConfirmation(text);
            return;
        }

        if (state.mode.endsWith("-select")) {
            const number = text.trim().match(/^(\d+)[.)]?$/);
            if (number) selectAppointment(Number(number[1]) - 1);
            else {
                addMessage("Select one of the appointments shown.");
                focusInput();
            }
            return;
        }

        if (state.mode === "booking-fields") {
            collectBookingFields(text);
            return;
        }

        if (state.mode === "reschedule-fields") {
            collectRescheduleFields(text);
            return;
        }

        if (cancellationIntent(text)) {
            await beginSelection("cancel");
            return;
        }
        if (rescheduleIntent(text)) {
            await beginSelection("reschedule");
            return;
        }
        if (bookingIntent(text)) {
            state.mode = "booking-fields";
            collectBookingFields(text, true);
            return;
        }

        addMessage("I can book, reschedule, or cancel an appointment.");
        focusInput();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isBusy) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        showStatus("");
        addMessage(text, "user");
        try {
            await handleMessage(text);
        } catch (error) {
            showStatus(`Something went wrong: ${error.message}`, true);
            addMessage("I could not complete that request. Please try again.");
            focusInput();
        }
    });

    actionButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            if (isBusy) return;
            showStatus("");
            const action = button.dataset.assistantAction;
            if (action === "book") {
                resetConversationState();
                state.mode = "booking-fields";
                addMessage(TYPE_PROMPT);
                focusInput();
            } else {
                await beginSelection(action);
            }
        });
    });

    addMessage("I can book, reschedule, or cancel an appointment.");
})();
