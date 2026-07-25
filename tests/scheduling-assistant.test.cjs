"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeClassList {
    constructor(element) {
        this.element = element;
        this.values = new Set();
    }

    add(...names) {
        names.forEach((name) => this.values.add(name));
        this.element.className = Array.from(this.values).join(" ");
    }

    remove(...names) {
        names.forEach((name) => this.values.delete(name));
        this.element.className = Array.from(this.values).join(" ");
    }

    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.values.has(name) : force;
        if (shouldAdd) this.add(name);
        else this.remove(name);
        return shouldAdd;
    }
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.listeners = new Map();
        this.attributes = new Map();
        this.dataset = {};
        this.className = "";
        this.classList = new FakeClassList(this);
        this.textContent = "";
        this.value = "";
        this.disabled = false;
        this.scrollTop = 0;
    }

    get scrollHeight() {
        return this.children.length;
    }

    append(...children) {
        this.children.push(...children);
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    async dispatch(type) {
        const event = { preventDefault() {} };
        for (const listener of this.listeners.get(type) || []) {
            await listener(event);
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    focus() {
        global.document.activeElement = this;
    }

    querySelector(selector) {
        const tagName = selector.toUpperCase();
        for (const child of this.children) {
            if (child.tagName === tagName) return child;
            const nested = child.querySelector?.(selector);
            if (nested) return nested;
        }
        return null;
    }
}

const elements = {
    assistantConversation: new FakeElement("div"),
    assistantForm: new FakeElement("form"),
    assistantInput: new FakeElement("input"),
    assistantSendBtn: new FakeElement("button"),
    assistantStatus: new FakeElement("p")
};
const actionButtons = ["book", "reschedule", "cancel"].map((action) => {
    const button = new FakeElement("button");
    button.dataset.assistantAction = action;
    return button;
});

global.document = {
    activeElement: null,
    getElementById(id) {
        return elements[id] || null;
    },
    querySelectorAll(selector) {
        return selector === "[data-assistant-action]" ? actionButtons : [];
    },
    createElement(tagName) {
        return new FakeElement(tagName);
    }
};

function futureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const existingAppointment = {
    id: "appointment-1",
    user_id: "user-1",
    name: "Dental",
    type: "Dental",
    date: futureDate(5),
    time: "10:00",
    status: "scheduled"
};
const writes = { inserts: [], updates: [], deletes: [] };

class FakeQuery {
    constructor() {
        this.operation = "select";
        this.filters = [];
        this.values = null;
    }

    select() {
        this.operation = "select";
        return this;
    }

    insert(values) {
        writes.inserts.push(values);
        return Promise.resolve({ error: null });
    }

    update(values) {
        this.operation = "update";
        this.values = values;
        return this;
    }

    delete() {
        this.operation = "delete";
        return this;
    }

    eq(field, value) {
        this.filters.push([field, value]);
        return this;
    }

    gte() {
        return this;
    }

    order() {
        return this;
    }

    then(resolve, reject) {
        let result = { data: [existingAppointment], error: null };
        if (this.operation === "update") {
            writes.updates.push({ values: this.values, filters: this.filters });
            result = { error: null };
        }
        if (this.operation === "delete") {
            writes.deletes.push({ filters: this.filters });
            result = { error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
    }
}

global.supabaseClient = {
    from(table) {
        assert.equal(table, "appointments");
        return new FakeQuery();
    }
};
global.window = {
    dashboardSessionPromise: Promise.resolve({ user: { id: "user-1" } }),
    appointmentsDashboard: { async loadAppointments() {} }
};

const scriptPath = path.join(__dirname, "..", "js", "scheduling-assistant.js");
vm.runInThisContext(fs.readFileSync(scriptPath, "utf8"), { filename: scriptPath });

function messages() {
    return elements.assistantConversation.children.map((message) => message.children[0]?.textContent || "");
}

async function submit(text) {
    elements.assistantInput.value = text;
    await elements.assistantForm.dispatch("submit");
}

function latestChoice() {
    const message = elements.assistantConversation.children.at(-1);
    return message.children[1]?.children[0] || null;
}

async function run() {
    await submit("Book dental tomorrow at 3 PM");
    assert.match(messages().at(-1), /^I have you down for Dental on .+ at 3:00 PM\. Should I book it\?$/);
    assert.equal(writes.inserts.length, 0, "booking must wait for confirmation");

    await submit("Yes!");
    assert.equal(writes.inserts.length, 1);
    assert.deepEqual(
        {
            user_id: writes.inserts[0].user_id,
            type: writes.inserts[0].type,
            time: writes.inserts[0].time
        },
        { user_id: "user-1", type: "Dental", time: "15:00" }
    );

    await actionButtons[0].dispatch("click");
    await submit("Haircut");
    assert.match(messages().at(-1), /That type is not available/);
    await submit("Therapy tomorrow at 4 PM");
    assert.match(messages().at(-1), /^I have you down for Therapy/);
    await submit("No thanks.");
    assert.equal(writes.inserts.length, 1, "declined booking must not insert");

    await actionButtons[0].dispatch("click");
    await submit("Dental");
    assert.equal(messages().at(-1), "What date would you like?");
    await submit("tomorrow");
    assert.equal(messages().at(-1), "What time would you like?");
    await submit("Medical at 4 PM");
    assert.match(messages().at(-1), /^I have you down for Dental/, "confirmed fields must not be overwritten");
    await submit("no");

    await actionButtons[0].dispatch("click");
    await submit("Medical on February 30, 2027 at 3 PM");
    assert.equal(messages().at(-1), "Enter a real calendar date.");
    assert.equal(writes.inserts.length, 1);
    await submit("December 31, 2099 at 3 PM");
    await submit("no");

    await actionButtons[1].dispatch("click");
    const rescheduleChoice = latestChoice();
    assert.ok(rescheduleChoice, "rescheduling must display appointment choices");
    await submit("Dental");
    assert.equal(messages().at(-1), "Select one of the appointments shown.");
    assert.equal(writes.updates.length, 0, "descriptive text must not infer a selection");
    await rescheduleChoice.dispatch("click");
    await submit("December 31, 2099 at 4 PM");
    assert.match(messages().at(-1), /^Move Dental to/);
    assert.equal(writes.updates.length, 0, "rescheduling must wait for confirmation");
    await submit("yes");
    assert.equal(writes.updates.length, 1);
    assert.ok(writes.updates[0].filters.some(([field, value]) => field === "id" && value === "appointment-1"));
    assert.ok(writes.updates[0].filters.some(([field, value]) => field === "user_id" && value === "user-1"));

    await actionButtons[2].dispatch("click");
    assert.ok(latestChoice(), "cancellation must display appointment choices");
    await latestChoice().dispatch("click");
    await submit("no");
    assert.equal(writes.deletes.length, 0, "declined cancellation must not delete");

    await actionButtons[2].dispatch("click");
    await latestChoice().dispatch("click");
    await submit("yes");
    assert.equal(writes.deletes.length, 1);
    assert.ok(writes.deletes[0].filters.some(([field, value]) => field === "id" && value === "appointment-1"));
    assert.ok(writes.deletes[0].filters.some(([field, value]) => field === "user_id" && value === "user-1"));

    console.log("Scheduling assistant interaction tests passed.");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
