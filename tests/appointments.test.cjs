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

    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.values.has(name) : force;
        if (shouldAdd) this.values.add(name);
        else this.values.delete(name);
        this.element.className = Array.from(this.values).join(" ");
        return shouldAdd;
    }
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.listeners = new Map();
        this.attributes = new Map();
        this.className = "";
        this.classList = new FakeClassList(this);
        this.textContent = "";
        this.value = "";
        this.disabled = false;
        this.hidden = false;
        this.min = "";
    }

    get options() {
        return this.children;
    }

    append(...children) {
        this.children.push(...children);
    }

    replaceChildren(...children) {
        this.children = children;
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

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    focus() {
        global.document.activeElement = this;
    }

    reset() {}

    scrollIntoView() {}
}

function futureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const elements = {
    appointmentForm: new FakeElement("form"),
    upcomingAppointmentsList: new FakeElement("div"),
    pastAppointmentsList: new FakeElement("div"),
    appointmentMessage: new FakeElement("p"),
    cancelEditBtn: new FakeElement("button"),
    saveAppointmentBtn: new FakeElement("button"),
    date: new FakeElement("input"),
    provider: new FakeElement("select"),
    duration: new FakeElement("select"),
    appointmentSearch: new FakeElement("input"),
    typeFilter: new FakeElement("select"),
    appointmentId: new FakeElement("input"),
    timeHour: new FakeElement("select"),
    timeMinute: new FakeElement("select"),
    timePeriod: new FakeElement("select"),
    time: new FakeElement("input"),
    name: new FakeElement("input"),
    type: new FakeElement("select"),
    notes: new FakeElement("textarea"),
    refreshBtn: new FakeElement("button"),
    manualAppointmentSection: new FakeElement("details"),
    openManualFormBtn: new FakeElement("button")
};

global.document = {
    activeElement: null,
    getElementById(id) {
        return elements[id] || null;
    },
    createElement(tagName) {
        return new FakeElement(tagName);
    }
};

const existingAppointment = {
    id: "appointment-1",
    user_id: "user-1",
    provider_id: "provider-1",
    providers: { name: "Primary Provider" },
    name: "Dental checkup",
    type: "Dental",
    date: futureDate(5),
    time: "10:00",
    duration_minutes: 30,
    notes: null,
    status: "scheduled",
    created_at: new Date().toISOString()
};
const writes = { inserts: [], updates: [], deletes: [] };
let mutationAffectsRow = true;
let selectThrows = false;

class FakeQuery {
    constructor() {
        this.operation = "select";
        this.filters = [];
        this.values = null;
    }

    select() {
        return this;
    }

    insert(values) {
        this.operation = "insert";
        this.values = values;
        return this;
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

    order() {
        return this;
    }

    then(resolve, reject) {
        if (selectThrows && this.operation === "select") {
            selectThrows = false;
            return Promise.reject(new Error("Network unavailable")).then(resolve, reject);
        }

        let result = { data: [existingAppointment], error: null };
        if (this.operation === "insert") {
            writes.inserts.push(this.values);
            result = { data: null, error: null };
        } else if (this.operation === "update") {
            writes.updates.push({ values: this.values, filters: this.filters });
            result = { data: mutationAffectsRow ? [{ id: existingAppointment.id }] : [], error: null };
        } else if (this.operation === "delete") {
            writes.deletes.push({ filters: this.filters });
            result = { data: mutationAffectsRow ? [{ id: existingAppointment.id }] : [], error: null };
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
    providerDirectoryPromise: Promise.resolve([
        { id: "provider-1", name: "Primary Provider", timezone: "America/Chicago" }
    ]),
    confirm() {
        return true;
    }
};

const scriptPath = path.join(__dirname, "..", "js", "appointments.js");
vm.runInThisContext(fs.readFileSync(scriptPath, "utf8"), { filename: scriptPath });

async function run() {
    elements.provider.value = "provider-1";
    elements.duration.value = "30";
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(elements.upcomingAppointmentsList.children.length, 1, "initial load should render the appointment");

    await elements.openManualFormBtn.dispatch("click");
    assert.equal(elements.manualAppointmentSection.open, true, "manual shortcut should expand the appointment form");
    assert.equal(document.activeElement, elements.name, "manual shortcut should focus the first field");
    elements.manualAppointmentSection.open = false;

    elements.name.value = "Therapy session";
    elements.type.value = "Therapy";
    elements.date.value = futureDate(10);
    elements.timeHour.value = "3";
    elements.timeMinute.value = "30";
    elements.timePeriod.value = "PM";
    elements.notes.value = "";
    await elements.appointmentForm.dispatch("submit");
    assert.equal(writes.inserts.length, 1);
    assert.equal(writes.inserts[0].user_id, "user-1");
    assert.equal(writes.inserts[0].provider_id, "provider-1");
    assert.equal(writes.inserts[0].duration_minutes, 30);
    assert.equal(writes.inserts[0].time, "15:30");
    assert.equal(writes.inserts[0].notes, null);
    assert.equal(elements.saveAppointmentBtn.disabled, false, "save button must be restored");

    const article = elements.upcomingAppointmentsList.children[0];
    const actions = article.children[1];
    const editButton = actions.children[0];
    const cancelButton = actions.children[1];
    await editButton.dispatch("click");
    assert.equal(elements.manualAppointmentSection.open, true, "editing should expand the appointment form");
    elements.date.value = futureDate(12);
    mutationAffectsRow = false;
    await elements.appointmentForm.dispatch("submit");
    assert.equal(writes.updates.length, 1);
    assert.ok(writes.updates[0].filters.some(([field, value]) => field === "id" && value === "appointment-1"));
    assert.ok(writes.updates[0].filters.some(([field, value]) => field === "user_id" && value === "user-1"));
    assert.match(elements.appointmentMessage.textContent, /no longer exists or is not available/);
    assert.equal(elements.saveAppointmentBtn.disabled, false, "save button must be restored after failure");

    await cancelButton.dispatch("click");
    assert.equal(writes.updates.length, 2);
    assert.equal(writes.updates[1].values.status, "cancelled");
    assert.ok(writes.updates[1].filters.some(([field, value]) => field === "id" && value === "appointment-1"));
    assert.match(elements.appointmentMessage.textContent, /Unable to cancel appointment/);

    mutationAffectsRow = true;
    selectThrows = true;
    await elements.refreshBtn.dispatch("click");
    assert.match(elements.upcomingAppointmentsList.children[0].textContent, /Network unavailable/);

    console.log("Manual appointment interaction tests passed.");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
