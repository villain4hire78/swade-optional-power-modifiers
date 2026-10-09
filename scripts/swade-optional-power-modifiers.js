const MODULE_ID = "swade-optional-power-modifiers";
const NO_POWER_POINTS_BUFFER_KEY = "swade-optional-power-modifiers.noPowerPointsPenaltyBuffer";
const MODIFIER_PP_REDUCTION_KEY = "swade-optional-power-modifiers.modifierPPCostReduction";
const TOTAL_PP_REDUCTION_KEY = "swade-optional-power-modifiers.totalPPCostReduction";
const SWADE_NO_PP_SETTING = "noPowerPoints";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "noPowerPoints", {
    name: "No Power Points",
    hint: "Use the SWADE No Power Points rules. This option is kept in sync with SWADE's system setting.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "noPowerPointsBufferKey", {
    name: "No Power Points penalty buffer effect key",
    hint: `Change the Active Effect key used for the No Power Points penalty buffer. Default: ${NO_POWER_POINTS_BUFFER_KEY}`,
    scope: "world",
    config: true,
    type: String,
    default: NO_POWER_POINTS_BUFFER_KEY,
  });

  game.settings.register(MODULE_ID, "hideStartupDialog", {
    name: "Don't show the Power Points choice again",
    hint: "The initial Power Points choice dialog will not appear again for this user.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "minimumPowerPointCost", {
    name: "Keep reduced Power costs at 1 PP minimum",
    hint: "When a total PP cost reduction would reduce a power's cost to 0 or less, charge 1 PP instead.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
});

Hooks.once("ready", async () => {
  await synchronizeModeFromSWADE();
  if (game.user.isGM && !game.settings.get(MODULE_ID, "hideStartupDialog")) {
    showStartupDialog();
  }
});

Hooks.on("updateSetting", async (setting) => {
  if (setting?.namespace === MODULE_ID && setting?.key === "noPowerPoints") {
    await setSWADENoPowerPoints(game.settings.get(MODULE_ID, "noPowerPoints"));
  } else if (setting?.namespace === "swade" && setting?.key === SWADE_NO_PP_SETTING) {
    const coreMode = game.settings.get("swade", SWADE_NO_PP_SETTING);
    if (game.settings.get(MODULE_ID, "noPowerPoints") !== coreMode) {
      await game.settings.set(MODULE_ID, "noPowerPoints", coreMode);
    }
  }
});

function showStartupDialog() {
  const content = `
    <form>
      <p>Choose which Power Point rules this world uses.</p>
      <div class="form-group">
        <label><input type="checkbox" name="hideStartupDialog"> Don't show this again</label>
      </div>
    </form>`;

  new foundry.applications.api.DialogV2({
    window: { title: "SWADE Optional Power Modifiers" },
    content,
    buttons: [
      {
        action: "power-points",
        label: "Power Points",
        callback: async (_event, _button, dialog) => {
          await saveStartupChoice(dialog, false);
        },
      },
      {
        action: "no-power-points",
        label: "No Power Points",
        callback: async (_event, _button, dialog) => {
          await saveStartupChoice(dialog, true);
        },
      },
    ],
  }).render(true);
}

async function saveStartupChoice(dialog, noPowerPoints) {
  const hideDialog = !!dialog.element.querySelector('[name="hideStartupDialog"]')?.checked;
  await game.settings.set(MODULE_ID, "noPowerPoints", noPowerPoints);
  if (hideDialog) await game.settings.set(MODULE_ID, "hideStartupDialog", true);
  await setSWADENoPowerPoints(noPowerPoints);
}

async function synchronizeModeFromSWADE() {
  if (!game.settings.settings.has(`swade.${SWADE_NO_PP_SETTING}`)) {
    ui.notifications.error(
      "SWADE Optional Power Modifiers could not find SWADE's No Power Points setting. Confirm that Savage Worlds Adventure Edition 6.0.4 or newer is active.",
      { permanent: true },
    );
    return;
  }

  const coreMode = game.settings.get("swade", SWADE_NO_PP_SETTING);
  if (game.settings.get(MODULE_ID, "noPowerPoints") !== coreMode) {
    await game.settings.set(MODULE_ID, "noPowerPoints", coreMode);
  }
}

async function setSWADENoPowerPoints(enabled) {
  if (!game.settings.settings.has(`swade.${SWADE_NO_PP_SETTING}`)) {
    ui.notifications.error(
      "SWADE Optional Power Modifiers could not find SWADE's No Power Points setting. Confirm that Savage Worlds Adventure Edition 6.0.4 or newer is active.",
      { permanent: true },
    );
    return;
  }

  if (game.settings.get("swade", SWADE_NO_PP_SETTING) !== enabled) {
    await game.settings.set("swade", SWADE_NO_PP_SETTING, enabled);
  }
}

Hooks.on("brswReady", () => {
  if (!game.modules.get("betterrolls-swade2")?.active) return;

  const module = game.modules.get(MODULE_ID);
  module.api ??= {};
  module.api.getNoPowerPointsPenaltyBuffer = (actor) => getEffectValue(actor, getNoPowerPointsBufferKey());
  module.api.getModifierPPCostReduction = (actor) => getEffectValue(actor, MODIFIER_PP_REDUCTION_KEY);
  module.api.getTotalPPCostReduction = (actor) => getEffectValue(actor, TOTAL_PP_REDUCTION_KEY);

  const brswApi = game.brsw;
  const originalRollItem = brswApi?.rollItem;
  if (typeof originalRollItem !== "function" || originalRollItem.__swadeOptionalPowerModifiersWrapped) return;

  const wrappedRollItem = async function (brCard, ...args) {
    if (!isPowerCard(brCard)) return originalRollItem.call(this, brCard, ...args);

    const restore = [];
    const actor = brCard.actor;
    const useCoreNoPowerPoints = game.settings.get("swade", SWADE_NO_PP_SETTING);

    if (useCoreNoPowerPoints) {
      applyNoPowerPointsPenaltyBuffer(brCard, restore);
    } else {
      applyPPCostReductions(brCard, actor, restore);
    }

    try {
      return await originalRollItem.call(this, brCard, ...args);
    } finally {
      for (const callback of restore.reverse()) callback();
    }
  };
  wrappedRollItem.__swadeOptionalPowerModifiersWrapped = true;
  brswApi.rollItem = wrappedRollItem;
});

function applyNoPowerPointsPenaltyBuffer(brCard, restore) {
  const selected = brCard.getSelectedActions?.() ?? [];
  let remaining = getEffectValue(brCard.actor, getNoPowerPointsBufferKey());
  const noPowerPointsActions = selected.filter((action) =>
    action?.code?.id?.startsWith("no_pp_") && Number(action.code.skillMod) < 0,
  );
  remaining = Math.min(remaining, noPowerPointsActions.reduce(
    (total, action) => total + Math.abs(Number(action.code.skillMod)),
    0,
  ));
  if (remaining <= 0) return;

  const adjustedValues = new Map();
  for (const action of noPowerPointsActions) {
    const value = Number(action.code.skillMod);
    const reduction = Math.min(remaining, Math.abs(value));
    adjustedValues.set(action, { action, value });
    action.code.skillMod = value + reduction;
    remaining -= reduction;
    if (remaining <= 0) break;
  }
  restore.push(() => {
    for (const { action, value } of adjustedValues.values()) action.code.skillMod = value;
  });
}

function applyPPCostReductions(brCard, actor, restore) {
  const modifierReduction = getEffectValue(actor, MODIFIER_PP_REDUCTION_KEY);
  const totalReduction = getEffectValue(actor, TOTAL_PP_REDUCTION_KEY);
  if (modifierReduction <= 0 && totalReduction <= 0) return;

  const originalModifiers = brCard.ppModifiers;
  const adjustedModifiers = structuredClone(originalModifiers ?? {});
  const modifierCost = getModifierCost(adjustedModifiers);
  let appliedModifierReduction = 0;
  if (modifierReduction > 0 && modifierCost > 0) {
    appliedModifierReduction = Math.min(modifierReduction, modifierCost);
    adjustedModifiers.extraCost = (Number(adjustedModifiers.extraCost) || 0) - appliedModifierReduction;
  }

  const baseCost = Number(brCard.item.system.pp) || 0;
  const costAfterModifierReduction = Math.max(0, baseCost + modifierCost - appliedModifierReduction);
  let appliedTotalReduction = Math.min(totalReduction, costAfterModifierReduction);
  if (
    appliedTotalReduction >= costAfterModifierReduction &&
    costAfterModifierReduction > 0 &&
    game.settings.get(MODULE_ID, "minimumPowerPointCost")
  ) {
    appliedTotalReduction = costAfterModifierReduction - 1;
  }
  if (appliedTotalReduction > 0) {
    adjustedModifiers.extraCost = (Number(adjustedModifiers.extraCost) || 0) - appliedTotalReduction;
  }

  brCard.ppModifiers = adjustedModifiers;
  const originalGetData = brCard.get_data;
  brCard.get_data = function (...args) {
    const data = originalGetData.apply(this, args);
    data.ppModifiers = originalModifiers;
    return data;
  };
  restore.push(() => {
    brCard.ppModifiers = originalModifiers;
    brCard.get_data = originalGetData;
  });
}

function getModifierCost(ppModifiers) {
  let total = Number(ppModifiers.extraCost) || 0;
  const recipients = ppModifiers.additionalRecipientsMod ?? {};
  total += (Number(recipients.cost) || 0) * (Number(recipients.count) || 0);

  for (const group of [ppModifiers.genericMods, ppModifiers.powerMods]) {
    for (const modifier of group ?? []) {
      if (!modifier.selected) continue;
      const cost = Number.parseInt(modifier.cost, 10);
      if (Number.isFinite(cost)) total += cost;
    }
  }
  return total;
}

function getEffectValue(actor, key) {
  if (!actor || !key) return 0;
  return (actor.effects ?? []).reduce((total, effect) => {
    if (effect.disabled || effect.isSuppressed) return total;
    const value = (effect.changes ?? [])
      .filter((change) => change.key === key)
      .reduce((sum, change) => sum + Math.max(0, Number(change.value) || 0), 0);
    return total + value;
  }, 0);
}

function getNoPowerPointsBufferKey() {
  return game.settings.get(MODULE_ID, "noPowerPointsBufferKey") || NO_POWER_POINTS_BUFFER_KEY;
}

function isPowerCard(brCard) {
  return Boolean(brCard?.item && (brCard.render_data?.isPower || brCard.item.type === "power"));
}
