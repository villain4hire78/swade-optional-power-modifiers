# SWADE Optional Power Modifiers

Foundry VTT module for Savage Worlds Adventure Edition 6.0.4+ and Foundry VTT 14. Its Power Point effect reductions integrate with Better Rolls 2 for Savage Worlds.

The canonical Foundry module ID and folder are `swade-optional-power-modifiers`.

Version 2 uses a new module ID and new No Power Points buffer key. Update existing worlds to enable **SWADE Optional Power Modifiers**, and change prior Active Effect keys from `swade-one-power.powerPenaltyBuffer` to `swade-optional-power-modifiers.noPowerPointsPenaltyBuffer`.

## Power Points mode choice

When a GM enters a world, the module offers **Power Points** and **No Power Points**. Choosing either option updates the module's **No Power Points** world setting and SWADE's matching system setting together. The dialog's **Don't show this again** checkbox stores a client preference. The world setting can also be changed at **Game Settings → Configure Settings → Module Settings → SWADE Optional Power Modifiers → No Power Points**; it stays synchronized with SWADE's core setting.

## No Power Points penalty buffer

Create an Active Effect change with key `swade-optional-power-modifiers.noPowerPointsPenaltyBuffer` and a positive numeric value. A value of `5` offsets up to 5 points of BR2's No Power Points power activation penalty. It does not add a trait bonus or cancel power modifier penalties.

The key can be changed with the module setting **No Power Points penalty buffer effect key**. The setting defaults to `swade-optional-power-modifiers.noPowerPointsPenaltyBuffer`.

## Power Point cost reductions

These effects apply when Power Points are enabled. Add changes to an Active Effect that applies to the actor. Positive values are the maximum number of PP reduced per power use; matching changes from multiple active effects add together.

| Function | Active Effect change key | What it reduces |
| --- | --- | --- |
| Modifier cost reduction | `swade-optional-power-modifiers.modifierPPCostReduction` | The net PP cost added by selected power modifiers and other BR2 modifier costs. It never reduces the power's base PP cost. |
| Total cost reduction | `swade-optional-power-modifiers.totalPPCostReduction` | The remaining total cost, including the power's base PP cost. |

Disabled and suppressed effects do not count. The **Keep reduced Power costs at 1 PP minimum** world setting applies to the total cost reduction: when that reduction would make a positive cost zero, the module leaves a 1 PP cost. With the setting unchecked, the total reduction may make the cost free, but never grants PP.

## Better Rolls 2

BR2 must be active for the penalty buffer and PP cost reductions to affect its roll cards and resource spending. The module applies the reductions during BR2's power roll and restores the original card data afterward, so the effect does not rewrite the power or its selected modifier costs.
