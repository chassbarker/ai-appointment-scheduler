"use strict";

(() => {
    const providerSelect = document.getElementById("provider");
    const providerField = document.getElementById("providerField");
    const appointmentMessage = document.getElementById("appointmentMessage");

    function createOption(value, text) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        return option;
    }

    function showProviderError(message) {
        if (providerSelect) {
            providerSelect.replaceChildren(
                createOption("", "Providers unavailable")
            );
            providerSelect.disabled = true;
            providerSelect.setAttribute("aria-invalid", "true");
            providerSelect.removeAttribute("aria-busy");
        }

        if (providerField) {
            providerField.hidden = false;
        }

        if (appointmentMessage) {
            appointmentMessage.textContent =
                `Unable to load providers: ${message}`;
            appointmentMessage.classList.add("message-error");
        }
    }

    async function loadProviders() {
        if (providerSelect) {
            providerSelect.disabled = true;
            providerSelect.setAttribute("aria-busy", "true");
        }

        const session = await window.dashboardSessionPromise;

        if (!session) {
            throw new Error("Your session has expired. Log in again.");
        }

        const { data, error } = await supabaseClient
            .from("providers")
            .select("id, name, timezone")
            .eq("active", true)
            .order("name", { ascending: true });

        if (error) {
            throw error;
        }

        const providers = data || [];

        if (!providers.length) {
            throw new Error(
                "No appointment providers are currently available."
            );
        }

        if (providerSelect) {
            providerSelect.replaceChildren(
                createOption("", "Select a provider"),
                ...providers.map((provider) =>
                    createOption(provider.id, provider.name)
                )
            );

            providerSelect.disabled = false;
            providerSelect.removeAttribute("aria-invalid");
            providerSelect.removeAttribute("aria-busy");

            if (providers.length === 1) {
                providerSelect.value = providers[0].id;
            }
        }

        if (providerField) {
            providerField.hidden = false;
        }

        return Object.freeze(
            providers.map((provider) =>
                Object.freeze({ ...provider })
            )
        );
    }

    window.providerDirectoryPromise = loadProviders().catch((error) => {
        showProviderError(error.message);
        throw error;
    });
})();
