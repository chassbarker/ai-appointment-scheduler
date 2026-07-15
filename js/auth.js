// ===============================
// Supabase Client Initialization
// ===============================
const supabaseUrl = "https://epwuihimruaglftldkje.supabase.co";
const supabaseKey = "sb_publishable_vgakDijQh5xDx_Hgw3Gdcw_Ap2N_XW0";
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ===============================
// Login Handler
// ===============================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            alert("Login failed: " + error.message);
            return;
        }

        // Redirect to dashboard
        window.location.href = "dashboard.html";
    });
}

// ===============================
// Sign Up Handler
// ===============================
const signupLink = document.getElementById("signupLink");

if (signupLink) {
    signupLink.addEventListener("click", async () => {
        const email = prompt("Enter your email:");
        const password = prompt("Create a password:");

        if (!email || !password) {
            alert("Email and password are required.");
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            alert("Sign-up failed: " + error.message);
            return;
        }

        alert("Account created! Please check your email to verify.");
    });
}

// ===============================
// Logout Handler
// ===============================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });
}

// ===============================
// Dashboard Protection
// ===============================
async function protectDashboard() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Not logged in → redirect
        window.location.href = "login.html";
        return;
    }

    // Logged in → personalize dashboard
    const userEmail = session.user.email;
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome ${userEmail}!`;
    }
}

// Run protection only on dashboard.html
if (window.location.pathname.includes("dashboard.html")) {
    protectDashboard();
}
