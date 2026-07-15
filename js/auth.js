"use strict";

const SUPABASE_URL = "https://epwuihimruaglftldkje.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vgakDijQh5xDx_Hgw3Gdcw_Ap2N_XW0";

if (!window.supabase) {
    throw new Error("The Supabase library failed to load.");
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginForm = document.getElementById("loginForm");
const signupButton = document.getElementById("signupButton");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
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
        const { fullName, email, password } = getCredentials();
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            showAuthMessage(`Login failed: ${error.message}`, true);
            return;
        }

        if (fullName) {
            const { error: nameError } = await supabaseClient.auth.updateUser({
                data: { full_name: fullName }
            });

            if (nameError) {
                showAuthMessage(`Logged in, but your name could not be saved: ${nameError.message}`, true);
                return;
            }
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

if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", async () => {
        const emailInput = document.getElementById("email");
        const email = emailInput.value.trim();

        if (!email || !emailInput.checkValidity()) {
            showAuthMessage("Enter your email address first, then select Forgot your password.", true);
            emailInput.focus();
            return;
        }

        forgotPasswordButton.disabled = true;
        showAuthMessage("Sending password-reset instructions…");
        const redirectTo = new URL("reset-password.html", window.location.href).href;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
        forgotPasswordButton.disabled = false;

        if (error) {
            showAuthMessage(`Unable to send reset email: ${error.message}`, true);
            return;
        }

        showAuthMessage("Check your email for a password-reset link.");
    });
}

const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetMessage = document.getElementById("resetMessage");

if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = document.getElementById("newPassword").value;
        const confirmation = document.getElementById("confirmPassword").value;

        if (password !== confirmation) {
            resetMessage.textContent = "The passwords do not match.";
            resetMessage.classList.add("message-error");
            return;
        }

        resetMessage.textContent = "Updating your password…";
        resetMessage.classList.remove("message-error");
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            resetMessage.textContent = "This reset link is invalid or has expired. Request a new link from the login page.";
            resetMessage.classList.add("message-error");
            return;
        }

        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) {
            resetMessage.textContent = `Unable to update password: ${error.message}`;
            resetMessage.classList.add("message-error");
            return;
        }

        resetMessage.textContent = "Password updated. Returning to login…";
        await supabaseClient.auth.signOut();
        window.setTimeout(() => window.location.replace("login.html?reset=success"), 1000);
    });
}

if (authMessage && new URLSearchParams(window.location.search).get("reset") === "success") {
    showAuthMessage("Your password was updated. Log in with your new password.");
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

    const displayName = session.user.user_metadata?.full_name?.trim();
    document.getElementById("welcomeMessage").textContent = displayName
        ? `Welcome, ${displayName}!`
        : "Welcome back!";
    return session;
}

window.dashboardSessionPromise = protectDashboard();
