// ===============================
// Create Appointment
// ===============================
async function createAppointment(appointment) {
    const { data, error } = await supabase
        .from("appointments")
        .insert([appointment]);

    if (error) {
        alert("Error creating appointment: " + error.message);
        return;
    }

    alert("Appointment saved!");
    loadAppointments();
}

// ===============================
// Load Appointments (Read)
// ===============================
async function loadAppointments() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = "login.html";
        return;
    }

    const userId = session.user.id;

    const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: true });

    if (error) {
        console.error("Error loading appointments:", error.message);
        return;
    }

    displayAppointments(data);
}

// ===============================
// Display Appointments
// ===============================
function displayAppointments(appointments) {
    const list = document.getElementById("appointmentsList");
    list.innerHTML = "";

    if (!appointments || appointments.length === 0) {
        list.innerHTML = "<p>No appointments scheduled.</p>";
        return;
    }

    appointments.forEach((appt) => {
        const item = document.createElement("div");
        item.classList.add("appointment-item");

        item.innerHTML = `
            <h4>${appt.date} — ${appt.type}</h4>
            <p>${appt.name}</p>
            <p>${appt.notes || ""}</p>

            <button onclick="deleteAppointment('${appt.id}')">Delete</button>
        `;

        list.appendChild(item);
    });
}

// ===============================
// Delete Appointment
// ===============================
async function deleteAppointment(id) {
    const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

    if (error) {
        alert("Error deleting appointment: " + error.message);
        return;
    }

    alert("Appointment deleted.");
    loadAppointments();
}

// ===============================
// Load appointments automatically on dashboard
// ===============================
if (window.location.pathname.includes("dashboard.html")) {
    loadAppointments();
}
