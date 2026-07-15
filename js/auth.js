use strict";

const SUPABASE_URL = "https://epwuihimruaglftldkje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vgakDijQh5xDx_Hgw3Gdcw_Ap2N_XW0";

if (!window.supabase) {
    throw new Error("The Supabase library failed to load.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginForm = document.getElementById("loginForm");
const signupButton = document.getElementById("signupButton");
const authMessage = document.getElementById("authMessage");

function showAuthMessage(message, isError = false) {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.classList.toggle("message-error", isError);
}

function getCredentials() {
    return {
        fullName: document.getElementById("fullName").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
    };
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showAuthMessage("Logging in…");
        const { email, password } = getCredentials();
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            showAuthMessage(`Login failed: ${error.message}`, true);
            return;
        }

        window.location.replace("dashboard.html");
    });
}

if (signupButton) {
    signupButton.addEventListener("click", async () => {
        if (!loginForm.reportValidity()) return;
        showAuthMessage("Creating your account…");
        const { fullName, email, password } = getCredentials();
        if (!fullName) {
            showAuthMessage("Enter your full name to create an account.", true);
            document.getElementById("fullName").focus();
            return;
        }

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName }
            }
        });

        if (error) {
            showAuthMessage(`Sign-up failed: ${error.message}`, true);
            return;
        }

        if (data.session) {
            window.location.replace("dashboard.html");
        } else {
            showAuthMessage("Account created. Check your email to confirm your address, then log in.");
        }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;
        await supabaseClient.auth.signOut();
        window.location.replace("login.html");
    });
}

async function protectDashboard() {
    if (!document.getElementById("welcomeMessage")) return null;
    const { data, error } = await supabaseClient.auth.getSession();
    const session = data.session;

    if (error || !session) {
        window.location.replace("login.html");
        return null;
    }

    const displayName = session.user.user_metadata?.full_name || session.user.email;
    document.getElementById("welcomeMessage").textContent = `Welcome, ${displayName}!`;
    return session;
}

window.dashboardSessionPromise = protectDashboard();
