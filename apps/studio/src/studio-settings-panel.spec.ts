import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySettingsTab,
  type StudioSettingsTab,
} from "./studio-settings-panel";
import {
  CUSTOM_VALUE,
  modelSelectHtml,
  pickerState,
  readPickerModel,
} from "./llm-catalog";

describe("studio settings tabs", () => {
  it("ativa Run settings e esconde o painel LLM", () => {
    const ui = fakeTabUi();
    applySettingsTab(ui.buttons, ui.panes, "run");
    assert.equal(ui.buttons[0].className, "active");
    assert.equal(ui.buttons[0].attrs["aria-selected"], "true");
    assert.equal(ui.buttons[1].className, "");
    assert.equal(ui.buttons[1].attrs["aria-selected"], "false");
    assert.equal(ui.panes[0].hidden, false);
    assert.equal(ui.panes[1].hidden, true);
  });

  it("ativa LLM settings", () => {
    const ui = fakeTabUi();
    applySettingsTab(ui.buttons, ui.panes, "llm");
    assert.equal(ui.buttons[1].className, "active");
    assert.equal(ui.panes[0].hidden, true);
    assert.equal(ui.panes[1].hidden, false);
  });
});

describe("llm catalog picker", () => {
  it("lê modelo personalizado", () => {
    assert.equal(readPickerModel(CUSTOM_VALUE, " gemini-x "), "gemini-x");
    assert.equal(readPickerModel("gemini-2.5-flash", "ignored"), "gemini-2.5-flash");
  });

  it("marca modelo desconhecido como personalizado", () => {
    const state = pickerState("meu-modelo", new Set(["gemini-2.5-flash"]));
    assert.deepEqual(state, {
      value: CUSTOM_VALUE,
      custom: "meu-modelo",
      known: false,
    });
  });

  it("agrupa recomendados do chat e inclui personalizado", () => {
    const picker = modelSelectHtml("chat", ["gemini-live"], "gemini-2.5-pro");
    assert.match(picker.html, /<optgroup label="Recomendados">/);
    assert.match(picker.html, /gemini-2.5-flash/);
    assert.match(picker.html, /gemini-2.5-pro/);
    assert.match(picker.html, /gemini-live/);
    assert.match(picker.html, /Personalizado…/);
    assert.equal(picker.value, "gemini-2.5-pro");
    assert.equal(picker.custom, "");
  });
});

function fakeTabUi() {
  const button = (tab: StudioSettingsTab, active: boolean) => {
    const classes = new Set<string>(active ? ["active"] : []);
    const attrs: Record<string, string> = {
      "aria-selected": String(active),
    };
    return {
      dataset: { settingsTab: tab },
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
        },
      },
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      attrs,
      get className() {
        return [...classes].join(" ");
      },
    };
  };
  const pane = (tab: StudioSettingsTab, hidden: boolean) => ({
    dataset: { settingsPane: tab },
    hidden,
  });
  return {
    buttons: [button("run", true), button("llm", false)],
    panes: [pane("run", false), pane("llm", true)],
  };
}
