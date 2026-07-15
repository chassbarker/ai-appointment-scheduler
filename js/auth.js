"use strict";

// Supabase project configuration
const SUPABASE_URL = "https://epwuihimruaglftldkje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_vgakDijQh5xDx_Hgw3Gdcw_Ap2N_XW0";

// GitHub Pages URLs
const LOGIN_URL =
    "https://chassbarker.github.io/ai-appointment-scheduler/login.html";

const DASHBOARD_URL =
    "https://chassbarker.github.io/ai-appointment-scheduler/dashboard.html";

// Make sure the Supabase browser library loaded
if (!window.supabase) {
    throw new Error("The Supabase library failed to load.");
}

// Create the Supabase client
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Authentication-page elements
const loginForm = document.getElementById("loginForm");
const signupButton = document.getElementById("signupButton");
const authMessage = document.getElementById("authMessage");

/**
 * Display an authentication status or error message.
 */
function showAuthMessage(message, isError = false) {
    if (!authMessage) {
        return;
    }

    authMessage.textContent = message;
    authMessage.classList.toggle("message-error", isError);
}

/**
 * Read the email address and password from the login form.
 */
function getCredentials() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    return {
        email: emailInput.value.trim(),
        password: passwordInput.value
    };
}

/**
 * Log in an existing user.
 */
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!loginForm.reportValidity()) {
            return;
        }

        showAuthMessage("Logging in…");

        const { email, password } = getCredentials();

        const { error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            showAuthMessage(
                `Login failed: ${error.message}`,
                true
            );

            return;
        }

        window.location.replace(DASHBOARD_URL);
    });
}

/**
 * Create a new account.
 */
if (signupButton) {
    signupButton.addEventListener("click", async () => {
        if (!loginForm || !loginForm.reportValidity()) {
            return;
        }

        signupButton.disabled = true;
        showAuthMessage("Creating your account…");

        const { email, password } = getCredentials();

        const { data, error } =
            await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: LOGIN_URL
                }
            });

        signupButton.disabled = false;

        if (error) {
            showAuthMessage(
                `Sign-up failed: ${error.message}`,
                true
            );

            return;
        }

        // Some Supabase projects log the user in immediately when
        // email confirmation is disabled.
        if (data.session) {
            window.location.replace(DASHBOARD_URL);
            return;
        }

        showAuthMessage(
            "Account created. Check your email to confirm your address, then log in."
        );
    });
}

/**
 * Log out the current user.
 */
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            logoutBtn.disabled = false;
            window.alert(`Logout failed: ${error.message}`);
            return;
        }

        window.location.replace(LOGIN_URL);
    });
}

/**
 * Protect the dashboard and display the user's email address.
 */
async function protectDashboard() {
    const welcomeMessage =
        document.getElementById("welcomeMessage");

    // This is not the dashboard page.
    if (!welcomeMessage) {
        return null;
    }

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();

    if (error || !session) {
        window.location.replace(LOGIN_URL);
        return null;
    }

    welcomeMessage.textContent =
        `Welcome, ${session.user.email}!`;

    return session;
}

// appointments.js waits for this promise before accessing data.
window.dashboardSessionPromise = protectDashboard();
