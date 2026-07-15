"use strict";

// Supabase project configuration
const SUPABASE_URL =
    "https://epwuihimruaglftldkje.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_vgakDijQh5xDx_Hgw3Gdcw_Ap2N_XW0";

// GitHub Pages addresses
const SITE_URL =
    "https://chassbarker.github.io/ai-appointment-scheduler/";

const LOGIN_URL = `${SITE_URL}login.html`;
const DASHBOARD_URL = `${SITE_URL}dashboard.html`;

// Verify that the Supabase browser library loaded
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
 * Read values from the authentication form.
 */
function getCredentials() {
    const fullNameInput =
        document.getElementById("fullName");

    const emailInput =
        document.getElementById("email");

    const passwordInput =
        document.getElementById("password");

    return {
        fullName: fullNameInput
            ? fullNameInput.value.trim()
            : "",
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

        window
