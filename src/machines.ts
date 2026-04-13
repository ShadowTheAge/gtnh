import { RecipeModel, OverclockResult } from "./page.js";
import { Fluid, Goods, Item, Recipe, RecipeInOut, RecipeIoType, RecipeType, Repository } from "./repository.js";
import { TIER_LV, TIER_MV, TIER_LUV, TIER_ZPM, TIER_UV, TIER_UHV, TIER_UEV, TIER_UIV, TIER_UXV, CoilTierNames } from "./utils.js";
import { voltageTier, getFusionTierByStartupCost, formatTicksAsTime } from "./utils.js";

export type MachineCoefficient<T> = Exclude<T, Function> | ((recipe:RecipeModel, choices:{[key:string]:number}) => T);

export abstract class Overclocker {
    public abstract calculate(recipeModel:RecipeModel, overclockTiers:number): OverclockResult;
}

export class StandardOverclocker extends Overclocker{
    maxPerfect: number;
    maxNormal: number;
    multiplier: number;

    private constructor(maxPerfect:number, maxNormal:number, multiplier:number) {
        super();
        this.maxPerfect = maxPerfect;
        this.maxNormal = maxNormal;
        this.multiplier = multiplier;
    }

    static onlyPerfect(maxPerfect=MAX_OVERCLOCK, multiplier:number=4) {
        return new StandardOverclocker(maxPerfect, 0, multiplier);
    }

    static onlyNormal(maxNormal=MAX_OVERCLOCK) {
        return new StandardOverclocker(0, maxNormal, 4);
    }

    static perfectThenNormal(maxPerfect=MAX_OVERCLOCK) {
        return new StandardOverclocker(maxPerfect, MAX_OVERCLOCK, 4);
    }

    public calculate(recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
        let overclockSpeed = 1;
        let overclockPower = 1;
        let nameParts : string[] = [];

        if (this.maxPerfect == 0 && this.maxNormal == 0) {
            return {overclockSpeed:1, overclockPower:1, perfectOverclocks:0, overclockName: "Can't overclock"};
        } else {

            let perfectOverclocks = Math.min(this.maxPerfect, overclockTiers);
            let normalOverclocks = Math.min(this.maxNormal, overclockTiers - perfectOverclocks);

            if (perfectOverclocks > 0) {
                overclockSpeed = Math.pow(this.multiplier, perfectOverclocks);
                let showCapped = perfectOverclocks == this.maxPerfect && normalOverclocks == 0;
                let suffix = showCapped ? " (capped)" : "";
                if (this.multiplier == 4) {
                    nameParts.push("Perfect OC x" + perfectOverclocks + suffix)
                } else {
                    nameParts.push(this.multiplier + "/" + this.multiplier + " OC x" + perfectOverclocks + suffix)
                }
            }
            if (normalOverclocks > 0) {
                let showCapped = normalOverclocks == this.maxNormal;
                let suffix = showCapped ? " (capped)" : "";
                let coef = Math.pow(2, normalOverclocks);
                overclockSpeed *= coef;
                overclockPower *= coef;
                nameParts.push("OC x" + normalOverclocks + suffix)
            }

            let overclockName = nameParts.join(", ");
            return { overclockSpeed, overclockPower, perfectOverclocks, overclockName };
        }
    }
}

export class NullOverclocker extends Overclocker {
    private constructor() {
        super()
    }

    public calculate(recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
        return {overclockSpeed:1, overclockPower:1, perfectOverclocks:0, overclockName: "Can't overclock"};
    }

    public static instance = new NullOverclocker();
}

export class OverclockerFromClosure extends Overclocker {
    closure: (recipe:RecipeModel, overclockTiers: number) => OverclockResult;

    constructor(closure:(recipe:RecipeModel, overclockTiers: number) => OverclockResult) {
        super();
        this.closure = closure;
    }

    public calculate(recipeModel: RecipeModel, overclockTiers: number): OverclockResult {
        return this.closure(recipeModel, overclockTiers);
    }
}

const MAX_OVERCLOCK = Number.POSITIVE_INFINITY;

export type Machine = {
    choices?: {[key:string]:Choice};
    enforceChoiceConstraints?: (recipe:RecipeModel, choices:{[key:string]:number}) => void;
    overclocker: MachineCoefficient<Overclocker>;
    speed: MachineCoefficient<number>;
    power: MachineCoefficient<number>;
    parallels: MachineCoefficient<number>;
    recipe?: (recipe:RecipeModel, choices:{[key:string]:number}, items:RecipeInOut[]) => RecipeInOut[];
    info?: MachineCoefficient<string>;
    ignoreParallelLimit?: boolean;
    fixedVoltageTier?: MachineCoefficient<number>;
    excludesRecipe?: (recipe:Recipe) => boolean;
    roundAfterParallels?: boolean;
}

export function GetParameter<T>(coefficient: MachineCoefficient<T>, recipeModel:RecipeModel): T {
    if (typeof coefficient === "function")
        return (coefficient as ((recipe:RecipeModel, choices:{[key:string]:number}) => T))(recipeModel, recipeModel.choices);
    else 
        return coefficient;
}

export type Choice = {
    description: string;
    choices?: string[];
    min?: number;
    max?: number;
}

function createEditableCopy(items: RecipeInOut[]): RecipeInOut[] {
    return items.map(item => ({ ...item }));
}

let CoilTierChoice:Choice = {
    description: "Coils",
    choices: CoilTierNames.map((name, index) => `T${index+1}: ${name}`),
}

type MachineList = {
    [key: string]: Machine;
}

export const machines: MachineList = {};

export const singleBlockMachine:Machine = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    excludesRecipe: (recipe:Recipe) => {
        return (recipe.gtRecipe.MetadataByKey("compression_tier") ?? 0) > 0;
    }
};

const singleBlockMachineWith22Overclock:Machine = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: (recipe, choices) => {
        return Math.pow(0.5, recipe.voltageTier);
    },
    parallels: 1,
};

export function GetSingleBlockMachine(recipeType:RecipeType):Machine {
    if (recipeType.name == "Mass Fabrication")
        return singleBlockMachineWith22Overclock;
    return singleBlockMachine;
}

function IsRecipeType(recipe:RecipeModel, type:string):boolean {
    return recipe.recipe ? recipe.recipe.recipeType.name == type : false;
}

export const notImplementedMachine:Machine = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented (Calculated as a singleblock)",
}

// Steam Compressor / Steam Alloy Smelter / Steam Extractor / Steam Furnace / Steam Forge Hammer / Steam Macerator
machines["gt.blockmachines.bronzemachine.compressor"] = machines["gt.blockmachines.bronzemachine.alloysmelter"] = machines["gt.blockmachines.bronzemachine.extractor"] = machines["gt.blockmachines.bronzemachine.furnace"] = machines["gt.blockmachines.bronzemachine.hammer"] = machines["gt.blockmachines.bronzemachine.macerator"] = {
    overclocker: NullOverclocker.instance,
    speed: 0.5,
    power: 0,
    parallels: 1,
    excludesRecipe: makeCompressorRecipeExcluder(0),
    info: "Steam machine: Steam consumption not calculated",
}

// High Pressure Steam Compressor / High Pressure Alloy Smelter / High Pressure Steam Extractor / High Pressure Steam Furnace / High Pressure Steam Forge Hammer / High Pressure Steam Macerator
machines["gt.blockmachines.hpmachine.compressor"] = machines["gt.blockmachines.hpmachine.alloysmelter"] = machines["gt.blockmachines.hpmachine.extractor"] = machines["gt.blockmachines.hpmachine.furnace"] = machines["gt.blockmachines.hpmachine.hammer"] = machines["gt.blockmachines.hpmachine.macerator"] = {
    overclocker: NullOverclocker.instance,
    speed: 1,
    power: 0,
    parallels: 1,
    excludesRecipe: makeCompressorRecipeExcluder(0),
    info: "High pressure steam machine: Steam consumption not calculated",
}

// Steam Squasher / Steam Separator / Steam Presser / Steam Grinder / Steam Purifier / Steam Blender
machines["gt.blockmachines.gtpp.multimachine.steam.compressor"] = machines["gt.blockmachines.gtpp.multimachine.steam.centrifuge"] = machines["gt.blockmachines.gtpp.multimachine.steam.forge.hammer"] = machines["gt.blockmachines.gtpp.multimachine.steam.macerator"] = machines["gt.blockmachines.gtpp.multimachine.steam.washer"] = machines["gt.blockmachines.gtpp.multimachine.steam.mixer"] = {
    overclocker: NullOverclocker.instance,
    speed: (recipe, choices) => choices.pressure == 1 ? 1.25 : 0.625,
    power: 0,
    parallels: 8,
    excludesRecipe: makeCompressorRecipeExcluder(0),
    info: "Steam multiblock machine: Steam consumption not calculated",
    choices: {
        pressure: {
            description: "Pressure",
            choices: ["Normal", "High"],
        },
    },
}

// Large Electric Compressor
machines["gt.blockmachines.multimachine.basiccompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2,
    power: 0.9,
    excludesRecipe: makeCompressorRecipeExcluder(0),
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

// Hot Isostatic Pressurization Unit
machines["gt.blockmachines.multimachine.hipcompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    // TODO: 250% faster/slower than singleblock machines of the same voltage
    speed: 2.5,
    // TODO: 75%/110%
    power: 0.75,
    // TODO: 4/1 per voltage tier
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
    excludesRecipe: makeCompressorRecipeExcluder(1),
    info: "Assumes it is not overheated"
};

// Pseudostable Black Hole Containment Field
machines["gt.blockmachines.multimachine.blackholecompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 5,
    power: 0.7,
    parallels: (recipe, choices) => {
        // TODO: 2x/4x when stability is BELOW 50/20
        return (recipe.voltageTier + 1) * 8;
    },
    excludesRecipe: makeCompressorRecipeExcluder(2),
    info: "Parallels depend on stability, which is not represented.",
};

// Bacterial Vat
machines["gt.blockmachines.bw.biovat"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Assumes perfect fill rate (x1001)",
    recipe: (recipe, choices, items) => {
        items = createEditableCopy(items);
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if ((item.type == RecipeIoType.FluidInput || item.type == RecipeIoType.FluidOutput) && item.goods instanceof Fluid) {
                item.amount = item.amount * 1001;
            }
        }
        return items;
    },
};

// Circuit Assembly Line
machines["gt.blockmachines.circuitassemblyline"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Component Assembly Line
machines["gt.blockmachines.componentassemblyline"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipeModel, choices) => {
        const recipeCoalTier = recipeModel.recipe?.gtRecipe.MetadataByKey("coal_casing_tier") ?? 1;
        const actualCoalTier = choices.componentTier + 1;
        return Math.pow(2, actualCoalTier - recipeCoalTier);
    },
    power: 1,
    parallels: 1,
    enforceChoiceConstraints: (recipeModel, choices) => {
        const recipeCoalTier = recipeModel.recipe?.gtRecipe.MetadataByKey("coal_casing_tier") ?? 1;
        choices.componentTier = Math.max(choices.componentTier, recipeCoalTier - 1);
    },
    choices: {
        componentTier: { 
            description: "Components Tier", 
            choices: voltageTier.slice(0, 13).map(v => v.name)
        }
    }
};

// Extreme Heat Exchanger
machines["gt.blockmachines.extremeheatexchanger"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Naquadah Fuel Refinery
machines["gt.blockmachines.frf"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    overclocker: (recipeModel, choices) => {
        const buildingTierCoil = choices.coils + 1;
        const recipeTierCoil = recipeModel.recipe?.gtRecipe.MetadataByKey("nfr_coil_tier") ?? 1;
        const maxPerfectOverclocks = Math.max(0, buildingTierCoil - recipeTierCoil);
        return StandardOverclocker.onlyPerfect(maxPerfectOverclocks);
    },
    choices: {coils: {
        description: "Coils",
        choices: ["T1 Field Restriction Coil", "T2 Advanced Field Restriction Coil", "T3 Ultimate Field Restriction Coil", "T4 Temporal Field Restriction Coil"],
    }},
    enforceChoiceConstraints: (recipe, choices) => {
        const recipeTier = recipe.recipe?.gtRecipe.MetadataByKey("nfr_coil_tier") ?? 1;
        choices.coils = Math.max(choices.coils, recipeTier - 1);
    }
};

// Neutron Activator
machines["gt.blockmachines.neutronactivator"] = {
    speed: (recipe, choices) => Math.pow((1/0.9), (choices.speedingPipeCasing - 4)),
    power: 0,
    parallels: 1,
    overclocker: NullOverclocker.instance,
    choices: {speedingPipeCasing: {
        description: "Speeding Pipe Casing",
        min: 4,
    }},
    info: (recipeModel, choices) => {
        const nke = recipeModel.recipe?.gtRecipe.MetadataByKey("nke_range") ?? 0;
        const nkeMin = nke % 10000;
        const nkeMax = Math.floor(nke / 10000);
        const nkeRange = nkeMax - nkeMin;
        const baseAverageEvPerEU = (10 + 20) / 2;
        const averageEvPerEU = baseAverageEvPerEU * Math.pow(0.95, choices.speedingPipeCasing - 4);
        const voltage = voltageTier[recipeModel.voltageTier].voltage;
        const averageEvPerTick = averageEvPerEU * voltage;
        const estimatedTicksToReachMinNke = nkeMin * 1000000 / averageEvPerTick;
        const estimatedTicksToReachMaxNke = nkeMax * 1000000 / averageEvPerTick;
        const estimatedTicksInRange = estimatedTicksToReachMaxNke - estimatedTicksToReachMinNke;
        return   "INFO: Power usage not calculated</br>"
               + "INFO: Requires " + nkeMin.toString() + "MeV. Estimated " + formatTicksAsTime(estimatedTicksToReachMinNke) + " to reach, " + formatTicksAsTime(estimatedTicksInRange) + " in range.";
    },
};

// Precise Auto-Assembler MT-3662
machines["gt.blockmachines.preciseassembler"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => {
        return IsRecipeType(recipe, "Precise Assembler") ? 1 : 2;
    },
    power: 1,
    parallels: (recipe, choices) => {
        return Math.pow(2, choices.precisionTier) * 16;
    },
    choices: {precisionTier: {
        description: "Precision Tier",
        choices: ["Imprecise (MK-0)", "MK-I", "MK-II", "MK-III", "MK-IV"],
    }},
};

// Fluid Shaper
machines["gt.blockmachines.multimachine.solidifier"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 0.8,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * (2 + 3 * choices.widthExpansion),
    choices: {widthExpansion: {description: "Width Expansion", max: 6}},
    info: "Assuming running at max speed.",
};

// Zyngen
machines["gt.blockmachines.industrialalloysmelter.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => 1 + choices.coilTier * 0.05,
    power: 1,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * choices.coilTier,
    choices: {coilTier: CoilTierChoice},
};

// High Current Industrial Arc Furnace
machines["gt.blockmachines.industrialarcfurnace.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3.5,
    power: 1,
    parallels: (recipe, choices) => {
        return IsRecipeType(recipe, "Plasma Arc Furnace") ? (recipe.voltageTier + 1) * 8 * choices.w : (recipe.voltageTier + 1) * choices.w;
    },
    choices: {w: {description: "W", min: 1}},
};

// Large Scale Auto-Assembler v1.01
machines["gt.blockmachines.gtplusplus.autocrafter.multi"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

function makeSpaceAssemblerRecipeExcluder(tier:number) {
    return (recipe:Recipe) => recipe.gtRecipe.MetadataByKey("space_elevator_module_tier") > tier;
}

// Space Assembler Module MK-I
machines["gt.blockmachines.projectmoduleassemblert1"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 4,
    fixedVoltageTier: TIER_UHV + 1,
    excludesRecipe: makeSpaceAssemblerRecipeExcluder(1),
    info: "NOTE: overrides voltage tier"
};

// Space Assembler Module MK-II
machines["gt.blockmachines.projectmoduleassemblert2"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 16,
    fixedVoltageTier: TIER_UIV + 2,
    excludesRecipe: makeSpaceAssemblerRecipeExcluder(2),
    info: "NOTE: overrides voltage tier"
};

// Space Assembler Module MK-III
machines["gt.blockmachines.projectmoduleassemblert3"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 64,
    fixedVoltageTier: TIER_UXV + 3,
    excludesRecipe: makeSpaceAssemblerRecipeExcluder(3),
    info: "NOTE: overrides voltage tier"
};

let PipeItemCasingTierChoice: Choice = {
    description: "Item Pipe Casing Tier",
    choices: ["T1: Tin", "T2: Brass", "T3: Electrum", "T4: Platinum", "T5: Osmium", "T6: Quantium", "T7: Fluxed Electrum", "T8: Black Plutonium"],
}
let PipeFluidCasingTierChoice: Choice = {
    description: "Fluid Pipe Casing Tier",
    choices: ["T1: Bronze", "T2: Steel", "T3: Titanium", "T4: Tungstensteel"],
}
// Industrial Autoclave
machines["gt.blockmachines.multimachine.autoclave"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => 1.25 + choices.coilTier * 0.25,
    power: (recipe, choices) => (11 - choices.pipeFluidCasingTier) / 12,
    parallels: (recipe, choices) => choices.pipeCasingTier * 12 + 12,
    choices: {coilTier: CoilTierChoice, pipeCasingTier: PipeItemCasingTierChoice, pipeFluidCasingTier:PipeFluidCasingTierChoice},
};

function getEbfExcessHeat(recipe:RecipeModel, choices:{[key:string]:number}) {
    const recipeHeat = recipe.recipe?.gtRecipe.specialValue ?? 0;
    const coilHeat = 1801 + choices.coilTier * 900;
    const voltageHeat = Math.max(0, recipe.voltageTier - TIER_MV) * 100;
    const actualHeat = coilHeat + voltageHeat;
    return actualHeat - recipeHeat;
}

function makeEbfOverclocker(recipe:RecipeModel, choices:{[key:string]:number}) {
    const excessHeat = getEbfExcessHeat(recipe, choices);
    const maxPerfectOverclocks = Math.floor(excessHeat / 1800);
    return StandardOverclocker.perfectThenNormal(maxPerfectOverclocks);
}

function ebfPower(recipe:RecipeModel, choices:{[key:string]:number}) {
    const excessHeat = getEbfExcessHeat(recipe, choices);
    const energyReductions = Math.floor(excessHeat / 900);
    return Math.pow(0.95, energyReductions);
}

function isEbfMufflerReducedFluid(fluidUnlocalizedName:string): boolean {
    return fluidUnlocalizedName === "fluid.carbondioxide"
        || fluidUnlocalizedName === "fluid.sulfurdioxide"
        || fluidUnlocalizedName === "fluid.carbonmonoxide";
}

// Electric Blast Furnace
machines["gt.blockmachines.multimachine.blastfurnace"] = {
    overclocker: makeEbfOverclocker,
    speed: 1,
    power: ebfPower,
    parallels: 1,
    recipe: (recipe, choices, items) => {   
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if (item.type == RecipeIoType.FluidOutput && item.goods instanceof Fluid && 
                isEbfMufflerReducedFluid(item.goods.unlocalizedName)) {
                items = createEditableCopy(items);
                items[i].amount = choices.muffler * item.amount * 0.125;
                break;
            }
        }
        return items;
    },
    choices: {coilTier: CoilTierChoice, muffler: {description: "Muffler hatch", choices: ["LV (0%)", "MV (12.5%)", "HV (25%)", "EV (37.5%)", "IV (50%)", "LuV (62.5%)", "ZPM (75%)", "UV (87.5%)", "UHV (100%)"]}},
};

// Volcanus
machines["gt.blockmachines.multimachine.adv.blastfurnace"] = {
    overclocker: makeEbfOverclocker,
    speed: 2.2,
    power: (recipe, choices) => ebfPower(recipe, choices) * 0.9,
    parallels: 8,
    choices: {coilTier: CoilTierChoice},
    info: "Blazing pyrotheum required (Not calculated)",
};

// Name before 2.8
machines["gt.blockmachines.megablastfurnace"] = {
    overclocker: makeEbfOverclocker,
    speed: 1,
    power: ebfPower,
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
};

// Big Barrel Brewery
machines["gt.blockmachines.multimachine.brewery"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// TurboCan Pro
machines["gt.blockmachines.multimachine.canner"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

// Ore Washing Plant
machines["gt.blockmachines.industrialwashplant.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// Oil Cracking Unit
machines["gt.blockmachines.multimachine.cracker"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: (recipe, choices) => 1 - Math.min(0.5, (choices.coilTier + 1) * 0.1),
    parallels: 1,
    choices: {coilTier: CoilTierChoice},
};

// Mega Oil Cracker
machines["gt.blockmachines.megaoilcracker"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: (recipe, choices) => 1 - Math.min(0.5, (choices.coilTier + 1) * 0.1),
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
};

// Industrial Cutting Factory
machines["gt.blockmachines.industrialcuttingmachine.controller.tier.01"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// Distillation Tower
machines["gt.blockmachines.multimachine.distillationtower"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Dangote Distillus
machines["gt.blockmachines.multimachine.adv.distillationtower"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => IsRecipeType(recipe, "Distillation Tower") ? 3.5 : 2,
    power: (recipe, choices) => IsRecipeType(recipe, "Distillation Tower") ? 1 : 0.85,
    parallels: (recipe, choices) => IsRecipeType(recipe, "Distillation Tower") ? 12 : (recipe.voltageTier + 1) * 8,
};

// Mega Distillation Tower
machines["gt.blockmachines.megadistillationtower"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 256,
};

// Electric Implosion Compressor
machines["gt.blockmachines.electricimplosioncompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: (recipe, choices) => Math.pow(4, choices.containmentBlockTier),
    choices: {containmentBlockTier: {description: "Containment Block Tier", choices: ["Neutronium", "Infinity", "Transcendent Metal", "SpaceTime", "Universum"]}},
};

let electroMagnets:{name:string, speed:number, power:number, parallels:number}[] = [
    {name: "Iron Electromagnet", speed: 1.1, power: 0.8, parallels: 8},
    {name: "Steel Electromagnet", speed: 1.25, power: 0.75, parallels: 24},
    {name: "Neodymium Electromagnet", speed: 1.5, power: 0.7, parallels: 48},
    {name: "Samarium Electromagnet", speed: 2, power: 0.6, parallels: 96},
    {name: "Tengam Electromagnet", speed: 2.5, power: 0.5, parallels: 256},
]

// Magnetic Flux Exhibitor
machines["gt.blockmachines.multimachine.electromagneticseparator"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => electroMagnets[choices.electromagnet].speed,
    power: (recipe, choices) => electroMagnets[choices.electromagnet].power,
    parallels: (recipe, choices) => electroMagnets[choices.electromagnet].parallels,
    choices: {electromagnet: {description: "Electromagnet", choices: electroMagnets.map(m => m.name)}},
};

// Dissection Apparatus
machines["gt.blockmachines.multimachine.extractor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 0.85,
    parallels: (recipe, choices) => (choices.pipeCasingTier + 1) * 8,
    choices: {pipeCasingTier: PipeItemCasingTierChoice},
};

// Industrial Extrusion Machine
machines["gt.blockmachines.industrialextruder.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// Assembly Line
machines["gt.blockmachines.multimachine.assemblyline"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

function laserOverclockCalculator(recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
    const amperage = recipeModel.choices.inputAmperage;
    const availableEut = voltageTier[recipeModel.voltageTier].voltage * amperage;
    let currentEut = (recipeModel.recipe?.gtRecipe?.voltage || 32) * recipeModel.getItemInputCount();
    
    // We will need to limit to 1 per tick at most for AAL.
    const parallel = recipeModel.getItemInputCount();
    const durationTicks = (recipeModel.recipe?.gtRecipe.durationTicks || Number.POSITIVE_INFINITY);

    let overclockSpeed = 1;
    let overclockPower = 1;

    const maxRegularOverclocks = recipeModel.voltageTier - (recipeModel.recipe?.gtRecipe?.voltageTier || TIER_LV);
    let regularOverclocks = 0;
    while (currentEut * 4 < availableEut && regularOverclocks < maxRegularOverclocks) {
        currentEut *= 4;
        overclockSpeed *= 2;
        overclockPower *= 2;
        regularOverclocks += 1;
    }

    let laserOverclocks = 0;
    while (true) {
        const multiplier = 4.0 + 0.3 * (laserOverclocks + 1);
        const potentialEU = currentEut * multiplier;
        const estimatedDurationTicks = durationTicks / Math.pow(2, laserOverclocks + regularOverclocks + 1);
        if (potentialEU >= availableEut) break;
        if (estimatedDurationTicks < parallel) break;

        currentEut = potentialEU;
        overclockSpeed *= 2;
        overclockPower *= multiplier / 2;
        laserOverclocks += 1;

        if (laserOverclocks + regularOverclocks > maxRegularOverclocks + (Math.log(amperage) / Math.log(4))) break;
    }

    let overclockNameParts = new Array();
    if (regularOverclocks > 0) {
        overclockNameParts.push("OC x" + regularOverclocks);
    }

    if (laserOverclocks > 0 ) {
        overclockNameParts.push("Laser OC x" + laserOverclocks);
    }

    // Display cap information if we're at the last possible overclock.
    const estimatedDurationTicks = durationTicks / Math.pow(2, laserOverclocks + regularOverclocks);
    if (estimatedDurationTicks / 2 < parallel) {
        overclockNameParts.push("1 tick cap");
    }

    return {
        overclockSpeed : overclockSpeed, 
        overclockPower : overclockPower, 
        perfectOverclocks : 0,
        overclockName : overclockNameParts.join(", ")
    };
};

// Advanced Assembly Line
machines["gt.blockmachines.ggfab.machine.adv_assline"] = {
    speed: 1,
    power: 1,
    overclocker: new OverclockerFromClosure(laserOverclockCalculator),
    parallels: (recipe) => recipe.getItemInputCount(),
    ignoreParallelLimit: true, // prevent parallel limitation as solver does not understand separate ampearage
    choices: {inputAmperage: {description: "Input Amperage", min: 16}},
    roundAfterParallels: true,
    info: "NOTE: Voltage determines the energy hatch voltage, not maximum voltage.",
};

// Large Fluid Extractor
machines["gt.blockmachines.multimachine.fluidextractor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => 1.5 + choices.coilTier * 0.1,
    power: (recipe, choices) => 0.80 * Math.pow(0.90, choices.coilTier),
    parallels: (recipe, choices) => (choices.solenoidTier + 2) * 8,
    choices: {coilTier: CoilTierChoice, solenoidTier: {description: "Solenoid Tier", choices: ["MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV"]}},
};

// Thermic Heating Device
machines["gt.blockmachines.industrialfluidheater.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.2,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

// Furnace
machines["tile.furnace"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Multi Smelter
machines["gt.blockmachines.multimachine.multifurnace"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: (recipe, choices) => {
        return 8 * Math.pow(2, choices.coilTier);
    },
    choices: {coilTier: CoilTierChoice},
    info: "Parallel amount needs testing!",
};

// Industrial Sledgehammer
machines["gt.blockmachines.industrialhammer.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2,
    power: 1,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * (choices.anvilTier + 1) * 8,
    choices: {anvilTier: {description: "Anvil Tier", choices: ["T1 - Vanilla", "T2 - Steel", "T3 - Dark Steel / Thaumium", "T4 - Void Metal"]}},
};

// Nuclear Reactor
machines["ic2.blockNuclearReactor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Implosion Compressor
machines["gt.blockmachines.multimachine.implosioncompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Density^2
machines["gt.blockmachines.multimachine.adv.implosioncompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2,
    power: 1,
    parallels: (recipe) => Math.floor((recipe.voltageTier + 1) / 2) + 1,
};

// Large Chemical Reactor
machines["gt.blockmachines.multimachine.chemicalreactor"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Mega Chemical Reactor
machines["gt.blockmachines.megachemicalreactor"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 1,
    parallels: 256,
};

// Hyper-Intensity Laser Engraver
machines["gt.blockmachines.multimachine.engraver"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3.5,
    power: 0.8,
    parallels: (recipe, choices) => Math.floor(Math.cbrt(choices.laserAmperage)),
    choices: {laserAmperage: {description: "Laser Amperage", min: 1}},
};

let precisionLatheParallels:number[] = [1, 1, 2, 4, 8, 12, 16, 32];
let precisionLatheSpeed:number[] = [0.75, 0.8, 0.9, 1, 1.5, 2, 3, 4];

// Industrial Precision Lathe
machines["gt.blockmachines.multimachine.lathe"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => ((precisionLatheSpeed[choices.itemPipeCasings] + recipe.voltageTier + 1) / 4),
    power: 0.8,
    parallels: (recipe, choices) => precisionLatheParallels[choices.itemPipeCasings] + (recipe.voltageTier + 1) * 2,
    choices: {itemPipeCasings:PipeItemCasingTierChoice}
};

// Industrial Maceration Stack
machines["gt.blockmachines.industrialmacerator.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1.6,
    power: 1,
    parallels: (recipe, choices) => {
        const hasUpgrade = choices.upgradeChip == 1;
        const n = hasUpgrade ? 8 : 2;
        return n * (recipe.voltageTier + 1);
    },
    choices: {upgradeChip: {description: "Upgrade Chip", choices: ["No Upgrade", "Maceration Upgrade Chip"]}},
};

// Industrial Material Press
machines["gt.blockmachines.industrialbender.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 6,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// Nano Forge
machines["gt.blockmachines.multimachine.nanoforge"] = {
    overclocker: (recipeModel, choices) => {
        // if ((mSpecialTier < 4 || recipe.mSpecialValue < 3) && mSpecialTier > recipe.mSpecialValue) {
        //     OCFactor = 4.0;
        // } else if (recipe.mSpecialValue == 3 && maxParallel > 1) {
        //     OCFactor = 4.0;
        // }
        // where specialValue is required tier, specialTier is building tier
        const neededTier = recipeModel.recipe?.gtRecipe.MetadataByKey("nano_forge_tier") ?? 1;
        const buildingTier = choices.tier + 1;
        if ((buildingTier < 4 || neededTier < 3) && buildingTier > neededTier)
            return StandardOverclocker.onlyPerfect();
        else if (neededTier == 3 && choices.parallels > 1)
            return StandardOverclocker.onlyPerfect();
        return StandardOverclocker.onlyNormal();
    },
    speed: (recipe, choices) => {
        return (choices.tier == 3 && choices.parallels > 1) ? 1 / Math.pow(0.9999, choices.parallels) : 1;
    },
    power: 1,
    parallels: (recipe, choices) => choices.parallels,
    recipe: (recipe, choices, items) => {
        if (choices.tier < 3 || choices.parallels <= 1) {
            return items;
        }

        items = createEditableCopy(items);

        for (let i = 0; i < items.length; ++i) {
            let item = items[i];
            if (item.type == RecipeIoType.ItemOutput) {
                let naniteItem = createEditableCopy([item])[0];
                naniteItem.type = RecipeIoType.ItemInput;
                // Simulate needing 1 of an output nanite in the input to trigger parallels by
                // spreading the input over all parallels.
                naniteItem.amount = 1.0 / choices.parallels;
                naniteItem.slot = 0;
                items.push(naniteItem);
            }
        }

        let magmatterFluid : RecipeInOut = {
            type : RecipeIoType.FluidInput,
            goodsPtr : 0,
            goods : Repository.current.GetById<Fluid>("f:gregtech:molten.magmatter") as Fluid,
            slot : 0,
            // maxParallel = Math.max((int) (drainedMagmatter / (288 / GTUtility.powInt(2, 4 - recipe.mSpecialValue))), 1)
            // maxParallel = drainedMagmatter / (288 / GTUtility.powInt(2, 4 - recipe.mSpecialValue))
            // maxParallel * (288 / GTUtility.powInt(2, 4 - recipe.mSpecialValue)) = drainedMagmatter
            amount : choices.parallels * (288 / Math.pow(2, 4 - choices.tier)),
            probability : 1.0
        };
        items.push(magmatterFluid);

        return items;
    },
    choices: {
        tier: {description: "Tier", choices: ["T1 (Carbon Nanite)", "T2 (Neutronium Nanite)", "T3 (Transcendent Metal Nanite)", "T4 (Eternity Nanite)"]},
        parallels: {description: "Parallels", min: 1}
    },
    enforceChoiceConstraints: (recipeModel, choices) => {
        const tier = recipeModel.recipe?.gtRecipe.MetadataByKey("nano_forge_tier") ?? 1;
        choices.tier = Math.max(choices.tier, tier - 1);

        if (choices.tier != 3) {
            choices.parallels = 1;
        }
    }
};

function makeCompressorRecipeExcluder(tier:number) {
    return (recipe:Recipe) => tier < (recipe.gtRecipe.MetadataByKey("compression_tier") ?? 0);
}

// Neutronium Compressor
machines["gt.blockmachines.multimachine.neutroniumcompressor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 8,
    excludesRecipe: makeCompressorRecipeExcluder(0),
};

// Amazon Warehousing Depot
machines["gt.blockmachines.amazonprime.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 6,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 16,
};

// PCB Factory
machines["gt.blockmachines.multimachine.pcbfactory"] = {
    overclocker: (recipe, choices) => {
        if (choices.cooling == 0)
            return NullOverclocker.instance;
        else if (choices.cooling >= 2)
            return StandardOverclocker.onlyPerfect();
        else
            return StandardOverclocker.onlyNormal();
    },
    speed: (recipe, choices) => 1/Math.pow(100/choices.traceSize, 2),
    power: (recipe, choices) => choices.cooling > 0 && choices.biochamber > 0 ? Math.sqrt(2) : 1,
    parallels: (recipe, choices) => {
        const nanites = choices.nanites;
        return Math.min(256, Math.ceil(Math.pow(nanites, 0.75)));
    },
    choices: {nanites: {description: "Nanites", min: 1}, 
        traceSize: {description: "Trace Size", min:50, max:200}, 
        biochamber: {description: "Biochamber", choices: ["No Biochamber", "Biochamber"]}, 
        cooling: {description: "Cooling", choices: ["No Cooling", "Liquid Cooling", "Thermosink Radiator"]},
    },
    recipe: (recipe, choices, items) => {
        items = createEditableCopy(items);
        let productionMultiplier = 100 / choices.traceSize;
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if (item.type == RecipeIoType.ItemOutput && item.goods instanceof Item) {
                item.amount = Math.floor(item.amount * productionMultiplier);
            }
        }
        return items;
    },
};

class DtpfCatalyst {
    tier: number;
    displayName: string;
    id: string;
    euPerLiter: number;
    residuePerLiter: number;

    constructor(tier: number, displayName: string, id: string, euPerLiter: number, residuePerLiter: number) {
        this.tier = tier;
        this.displayName = displayName;
        this.id = id;
        this.euPerLiter = euPerLiter;
        this.residuePerLiter = residuePerLiter;
    }
}

let DtpfCatalysts = [
    new DtpfCatalyst(0, "Crude", "f:gregtech:exciteddtcc", 14_514_093, 0.125),
    new DtpfCatalyst(1, "Prosaic", "f:gregtech:exciteddtpc", 66_768_460, 0.25),
    new DtpfCatalyst(2, "Resplendent", "f:gregtech:exciteddtrc", 269_326_451, 0.5),
    new DtpfCatalyst(3, "Exotic", "f:gregtech:exciteddtec", 1_073_007_393, 1.0),
    new DtpfCatalyst(4, "Stellar", "f:gregtech:exciteddtsc", 4_276_767_521, 2.0),
]

let DtpfCatalystById = Object.fromEntries(DtpfCatalysts.map(cat => [cat.id, cat]));

function findDtpfCatalyst(items:RecipeInOut[]) : DtpfCatalyst | undefined {
    for (let i=0; i<items.length; i++) {
        let item = items[i];
        if (item.type == RecipeIoType.FluidInput) {
            let id = (item.goods as Fluid).id;
            if (id in DtpfCatalystById) {
                return DtpfCatalystById[id];
            }
        }
    }
}

// Dimensionally Transcendent Plasma Forge
machines["gt.blockmachines.multimachine.plasmaforge"] = {
    overclocker: (recipe, choices) => {
        if (choices.convergence > 0)
            return StandardOverclocker.onlyPerfect();
        else
            return StandardOverclocker.onlyNormal();
    },
    speed: 1,
    power: (recipe, choices) => choices.convergence > 0 ? 0.5 : 1,
    recipe: (recipe, choices, items) => {
        items = createEditableCopy(items);

        let discount = choices.convergence > 0 ? 0.5 : (choices.discount == 0 ? 0.0 : 0.5);

        if (choices.convergence > 0) {
            // Logic based on https://github.com/GTNewHorizons/GT5-Unofficial/blob/bdfefcfc4f851a07303cfdde21c26767210ebf57/src/main/java/gregtech/common/tileentities/machines/multi/MTEPlasmaForge.java#L1035-L1041
            let amperage = recipe.recipe?.gtRecipe.amperage || 1;
            let voltage = recipe.recipe?.gtRecipe.voltage || TIER_LV;
            let machineConsumption = amperage * voltage * Math.pow(4, recipe.overclockTiers);
            let durationTicks = (recipe.recipe?.gtRecipe.durationTicks || 1) / Math.pow(4, recipe.overclockTiers);
            let requiredCatalystEu = (Math.pow(2, recipe.overclockTiers) - 1) * machineConsumption * durationTicks;

            let catalyst = findDtpfCatalyst(items) || DtpfCatalysts[choices.catalyst];

            let requiredCatalystLiters = requiredCatalystEu / catalyst.euPerLiter;
            let residueLiters = Math.floor(requiredCatalystLiters * catalyst.residuePerLiter);

            let transdimensionalAlignmentMatrixItem : RecipeInOut = {
                type : RecipeIoType.ItemInput,
                goodsPtr : 0,
                goods : Repository.current.GetById<Item>("i:gregtech:gt.metaitem.03:32758") as Item,
                slot : 0,
                amount : 0,
                probability : 1.0
            };

            let catalystFluid : RecipeInOut = { 
                type : RecipeIoType.FluidInput,
                goodsPtr : 0,
                goods : Repository.current.GetById<Fluid>(catalyst.id) as Fluid,
                slot : 0,
                amount : requiredCatalystLiters,
                probability : 1.0
            };

            let residueFluid : RecipeInOut = {
                type : RecipeIoType.FluidOutput,
                goodsPtr : 0,
                goods : Repository.current.GetById<Fluid>("f:gregtech:dimensionallytranscendentresidue") as Fluid,
                slot : 0,
                amount : residueLiters,
                probability : 1.0
            };

            items.push(transdimensionalAlignmentMatrixItem);
            items.push(catalystFluid);
            items.push(residueFluid);
        }
        
        if (discount > 0.0) {
            for (let i=0; i<items.length; i++) {
                let item = items[i];
                if (item.type == RecipeIoType.FluidInput) {
                    let id = (item.goods as Fluid).id;
                    if (id in DtpfCatalystById) {
                        item.amount *= (1-discount);
                    }
                }
            }
        }

        return items;
    },
    parallels: 1,
    choices: {
        convergence: {
            description: "Convergence", choices: ["No Convergence", "Convergence"]
        },
        discount: {
            description: "Discount", choices: ["0%", "50%"]
        },
        catalyst: {
            description: "Catalyst", choices: DtpfCatalysts.map(cat => cat.displayName)
        },
    },
    enforceChoiceConstraints: (recipe, choices) => {
        if (choices.convergence > 0) {
            choices.discount = 1;
        }

        let catalyst = findDtpfCatalyst(recipe.recipe?.items || []);
        if (catalyst) {
            choices.catalyst = catalyst.tier;
        }
    }
};

// Bricked Blast Furnace
machines["gt.blockmachines.multimachine.brickedblastfurnace"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Clarifier Purification Unit
machines["gt.blockmachines.multimachine.purificationunitclarifier"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Residual Decontaminant Degasser Purification Unit
machines["gt.blockmachines.multimachine.purificationunitdegasifier"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Flocculation Purification Unit
machines["gt.blockmachines.multimachine.purificationunitflocculator"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Ozonation Purification Unit
machines["gt.blockmachines.multimachine.purificationunitozonation"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// pH Neutralization Purification Unit
machines["gt.blockmachines.multimachine.purificationunitphadjustment"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Extreme Temperature Fluctuation Purification Unit
machines["gt.blockmachines.multimachine.purificationunitplasmaheater"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Absolute Baryonic Perfection Purification Unit
machines["gt.blockmachines.multimachine.purificationunitextractor"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented",
};

// High Energy Laser Purification Unit
machines["gt.blockmachines.multimachine.purificationunituvtreatment"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented",
};

// Pyrolyse Oven
machines["gt.blockmachines.multimachine.pyro"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => (choices.coils + 1) * 0.5,
    power: 1,
    parallels: 1,
    choices: {coils: CoilTierChoice},
};

// Elemental Duplicator
machines["gt.blockmachines.gtpp.multimachine.replicator"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 2,
    power: 1,
    parallels: (recipe) => 8 * (recipe.voltageTier + 1),
};

// Research station
machines["gt.blockmachines.multimachine.em.research"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Boldarnator
machines["gt.blockmachines.industrialrockcrusher.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

// Large Thermal Refinery
machines["gt.blockmachines.industrialthermalcentrifuge.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.5,
    power: 0.8,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

// Transcendent Plasma Mixer
machines["gt.blockmachines.multimachine.transcendentplasmamixer"] = {
    overclocker: NullOverclocker.instance,
    speed: 1,
    power: 10,
    parallels: (recipe, choices) => choices.parallels,
    choices: {parallels: {description: "Parallels", min: 1}}
};

// Forge of the Gods
machines["gt.blockmachines.multimachine.em.forge_of_gods"] = notImplementedMachine;

// Vacuum Freezer
machines["gt.blockmachines.multimachine.vacuumfreezer"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Mega Vacuum Freezer
machines["gt.blockmachines.megavacuumfreezer"] = {
    overclocker: (recipe, choices) => StandardOverclocker.perfectThenNormal(choices.coolant),
    speed: 1,
    power: 1,
    parallels: 256,
    choices: {coolant: {description: "Coolant", choices: ["No Coolant", "Molten SpaceTime", "Spatially Enlarged Fluid", "Molten Eternity"]}},
    info: "Coolant calculation not implemented.",
};

// Industrial Wire Factory
machines["gt.blockmachines.industrialwiremill.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

// Digester
machines["gt.blockmachines.digester"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Dissolution Tank
machines["gt.blockmachines.dissolution_tank"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Source Chamber
machines["gt.blockmachines.source_chamber"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Output energy scales with EU/t up to the point shown in the recipe.",
};

// Target Chamber
machines["gt.blockmachines.target_chamber"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Alloy Blast Smelter
machines["gt.blockmachines.industrialsalloyamelter.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Mega Alloy Blast Smelter
machines["gt.blockmachines.industrialsalloyamelter.controller.tier.mega"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => Math.max(1, 1 - 0.05 * (choices.coilTier - 3)),
    power: (recipe, choices) => Math.pow(0.95, choices.coilTier - recipe.voltageTier),
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
    info: "Assumes matching glass tier.",
};

// Industrial Coke Oven
machines["gt.blockmachines.industrialcokeoven.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: (recipe, choices) => 1 - (recipe.voltageTier + 1) * 0.04,
    parallels: (recipe, choices) => choices.casingType == 1 ? 30 : 18,
    choices: {casingType: {description: "Casing Type", choices: ["Heat Resistant Casings", "Heat Proof Casings"]}},
};

// Cryogenic Freezer
machines["gt.blockmachines.multimachine.adv.industrialfreezer"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.2,
    power: 0.9,
    parallels: 8,
};

// COMET - Compact Cyclotron
machines["gt.blockmachines.cyclotron.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Zhuhai - Fishing Port
machines["gt.blockmachines.industrial.fishpond.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: (recipe) => ((recipe.voltageTier + 1) + 1) * 2,
};

// Reactor Fuel Processing Plant
machines["gt.blockmachines.industrialrefinery.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Flotation Cell Regulator
machines["gt.blockmachines.gtpp.multimachine.flotationcell"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// ExxonMobil Chemical Plant
machines["gt.blockmachines.chemicalplant.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: (recipe, choices) => {
        return choices.coilTier * 0.5 + 0.5;
    },
    power: 1,
    parallels: (recipe, choices) => (choices.pipeFluidCasingTier + 1) * 2,
    choices: {coilTier: CoilTierChoice,
        pipeFluidCasingTier:PipeFluidCasingTierChoice
    },
    recipe: (recipe, choices, items) => {
        if (choices.coilTier >= 10 && choices.pipeFluidCasingTier >= 3)
            return items;
        let catalystNumber = items.findIndex(item => item.type == RecipeIoType.ItemInput && item.goods instanceof Item && item.goods.name.endsWith("Catalyst"));
        if (catalystNumber == -1)
            return items;
        let catalystUsage = (1 - 0.2 * choices.pipeFluidCasingTier) / 50;
        items = createEditableCopy(items);
        items[catalystNumber].amount = catalystUsage;
        return items;
    }
};

// Thorium Reactor [LFTR]
machines["gt.blockmachines.lftr.controller.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Matter Fabrication CPU
machines["gt.blockmachines.industrialmassfab.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 0.8,
    parallels: (recipe, choices) => {
        let scrap = recipe.recipe?.gtRecipe?.voltageTier == TIER_LV;
        return scrap ? 64 : 8 * (recipe.voltageTier + 1);
    },
};

// Molecular Transformer
machines["gt.blockmachines.moleculartransformer.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Industrial Centrifuge
machines["gt.blockmachines.industrialcentrifuge.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.25,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 6,
};

// Utupu-Tanuri
machines["gt.blockmachines.multimachine.adv.vacuumfurnace"] = {
    overclocker: (recipe, choices) => StandardOverclocker.perfectThenNormal(Math.floor(choices.heatIncrements / 2)),
    speed: (recipe, choices) => 2.2 * Math.pow(1.05, choices.heatIncrements),
    power: 0.5,
    parallels: 4,
    choices: {heatIncrements: {description: "Heat Difference Tiers", min: 0}},
    info: "Extracting heat difference from the recipe is not implemented.",
};

// Industrial Electrolyzer
machines["gt.blockmachines.industrialelectrolyzer.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.8,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

// Industrial Mixing Machine
machines["gt.blockmachines.industrialmixer.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 3.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

// Nuclear Salt Processing Plant
machines["gt.blockmachines.nuclearsaltprocessingplant.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 2.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

// IsaMill Grinding Machine
machines["gt.blockmachines.gtpp.multimachine.isamill"] = {
    overclocker: StandardOverclocker.onlyPerfect(),
    speed: 1,
    power: 1,
    parallels: 1,
};

// Quantum Force Transformer
machines["gt.blockmachines.quantumforcetransformer.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: (recipe, choices) => choices.catalysts,
    recipe: (recipe, choices, items) => {
        const numOutputs = recipe.getOutputCount();
        if (numOutputs == 0) {
            return recipe.recipe?.items ?? [];
        }
        
        const focusTier = recipe.recipe?.gtRecipe.MetadataByKey("qft_focus_tier") ?? 1;

        const baseProbability = 1.0 / numOutputs;
        
        items = createEditableCopy(recipe.recipe?.items || []);
        // NOTE: we rely on this matching the NEI order
        let j = 0;
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if (item.type == RecipeIoType.FluidOutput || item.type == RecipeIoType.ItemOutput) {
                let actualProbability = baseProbability;

                // Singular focusing
                if (choices.focusedOutput > 0) {
                    if (choices.focusedOutput == j + 1) {
                        // Increase due to singular focus
                        if (choices.shielding + 1 == focusTier) {
                            actualProbability += (baseProbability - baseProbability / 2.0) * (numOutputs - 1);
                        } else if (choices.shielding + 1 == focusTier + 1) {
                            actualProbability += (baseProbability - baseProbability / 4.0) * (numOutputs - 1);
                        } else if (choices.shielding + 1 >= focusTier + 2) {
                            actualProbability = 1.0;
                        }
                    } else {
                        // Decrease due to singular focus
                        if (choices.shielding + 1 == focusTier) {
                            actualProbability /= 2.0;
                        } else if (choices.shielding + 1 == focusTier + 1) {
                            actualProbability /= 4.0;
                        } else if (choices.shielding + 1 >= focusTier + 2) {
                            actualProbability = 0.0;
                        }
                    }
                }

                if (choices.focusedAll) {
                    if (choices.shielding + 1 == focusTier) {
                        actualProbability += (1.0 - actualProbability) / 4.0;
                    } else if (choices.shielding + 1 == focusTier + 1) {
                        actualProbability += (1.0 - actualProbability) / 3.0;
                    } else if (choices.shielding + 1 >= focusTier + 2) {
                        actualProbability += (1.0 - actualProbability) / 2.0;
                    }
                }

                item.probability = actualProbability;
                ++j;
            }
        }

        if (choices.focusedOutput > 0) {
            let neptuniumPlasmaFluid : RecipeInOut = {
                type : RecipeIoType.FluidInput,
                goodsPtr : 0,
                goods : Repository.current.GetById<Fluid>("f:miscutils:plasma.neptunium") as Fluid,
                slot : 0,
                amount : Math.floor(4 * (choices.shielding + 1) * Math.sqrt(choices.catalysts)),
                probability : 1.0
            };
            items.push(neptuniumPlasmaFluid);
        }

        if (choices.focusedAll) {
            let fermiumPlasmaFluid : RecipeInOut = {
                type : RecipeIoType.FluidInput,
                goodsPtr : 0,
                goods : Repository.current.GetById<Fluid>("f:miscutils:plasma.fermium") as Fluid,
                slot : 0,
                amount : Math.floor(4 * (choices.shielding + 1) * Math.sqrt(choices.catalysts)),
                probability : 1.0
            };
            items.push(fermiumPlasmaFluid);
        }

        return items;
    },
    choices: {
        catalysts: {description: "Catalysts", min: 1},
        shielding: {description: "Shielding", choices: ["Neutron", "Cosmic", "Infinity", "SpaceTime"]},
        manipulator: {description: "Manipulator", choices: ["Neutron", "Cosmic", "Infinity", "SpaceTime"]},
        focusedOutput: {description: "Focused Output", choices: ["None", "1", "2", "3", "4", "5", "6"]},
        focusedAll: {description: "Focus All", choices: ["No", "Yes"]}
    },    
    enforceChoiceConstraints: (recipe, choices) => {
        const focusTier = recipe.recipe?.gtRecipe.MetadataByKey("qft_focus_tier") ?? 1;
        choices.manipulator = Math.max(choices.manipulator, focusTier - 1);

        if (choices.shielding + 1 < focusTier) {
            // Shielding not high enough to be able to focus.
            choices.focusedOutput = 0;
            choices.focusedAll = 0;
        } else {
            const numOutputs = recipe.getOutputCount();
            choices.focusedOutput = Math.min(choices.focusedOutput, numOutputs);
        }
    }
};

// Sparge Tower Controller
machines["gt.blockmachines.sparge.controller.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 1,
    power: 1,
    parallels: 1,
};

let sawMultipliers = [0, 1, 2, 4];
let saplingsMultipliers = [0, 1, 4];
let leavesMultipliers = [0, 1, 2, 4];
let fruitsMultipliers = [0, 1];

// Tree Growth Simulator
machines["gt.blockmachines.treefarm.controller.tier.single"] = {
    overclocker: NullOverclocker.instance,
    speed: 1,
    recipe: (recipe, choices, items) => {
        items = createEditableCopy(items);
        let tier = recipe.voltageTier + 1;
        let multiplier = (2 * tier * tier - 2 * tier + 5);
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if (item.type == RecipeIoType.ItemOutput && item.goods instanceof Item) {
                if (item.slot == 0)
                    item.amount = item.amount * sawMultipliers[choices.saw] * multiplier;
                if (item.slot == 1)
                    item.amount = item.amount * saplingsMultipliers[choices.saplings] * multiplier;
                if (item.slot == 2)
                    item.amount = item.amount * leavesMultipliers[choices.leaves] * multiplier;
                if (item.slot == 3)
                    item.amount = item.amount * fruitsMultipliers[choices.fruits] * multiplier;
            }
        }
        return items;
    },
    choices: {
        saw: {description: "Saw", choices: ["No saw", "Saw (x1)", "Buzzsaw (x2)", "Chainsaw (x4)"]},
        saplings: {description: "Saplings", choices: ["No grafter", "Branch cutter (x1)", "Grafter (x4)"]},
        leaves: {description: "Leaves", choices: ["No shears", "Shears (x1)", "Wire Cutter (x2)", "Automatic Snips (x4)"]},
        fruits: {description: "Fruits", choices: ["No knife", "Knife (x1)"]}
    },
    power: 1,
    parallels: 1,
};

// Draconic Evolution Fusion Crafter
machines["gt.blockmachines.multimachine.defusioncrafter"] = {
    overclocker: (recipe, choices) => {
        const buildingTierCoil = choices.casings + 1;
        const recipeTierCoil = recipe.recipe?.gtRecipe.MetadataByKey("defc_casing_tier") ?? 1;
        const maxPerfectOverclocks = Math.max(0, buildingTierCoil - recipeTierCoil);
        return StandardOverclocker.perfectThenNormal(maxPerfectOverclocks);
    },
    speed: 1,
    power: 1,
    parallels: 1,
    choices: {casings: {description:"Fusion casings", choices:["Bloody Ichorium", "Draconium", "Wyvern", "Awakened Draconium", "Chaotic"]}},
    enforceChoiceConstraints: (recipe, choices) => {
        const recipeTier = recipe.recipe?.gtRecipe.MetadataByKey("defc_casing_tier") ?? 1;
        choices.casings = Math.max(choices.casings, recipeTier - 1);
    }
};

// Large Sifter Control Block
machines["gt.blockmachines.industrialsifter.controller.tier.single"] = {
    overclocker: StandardOverclocker.onlyNormal(),
    speed: 5,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

function getFusionTier(recipe:Recipe): number {
    const cost = recipe.gtRecipe.MetadataByKey("fusion_threshold") ?? 0;
    const plasmaTier = recipe.gtRecipe.MetadataByKey("fog_plasma_tier") ?? 0;
    const costTier = getFusionTierByStartupCost(cost);
    const voltageTier = (recipe.gtRecipe.voltageTier - TIER_LUV + 1) || 0;
    return Math.max(plasmaTier, costTier, voltageTier);
}

function makeFusionOverclocker(fusionTier:number, overclockMultiplier:number) {
    return function (recipeModel:RecipeModel, choices:{[key:string]:number}) {
        const recipeTier = getFusionTier(recipeModel.recipe!);
        const maxOverclocks = fusionTier - recipeTier;
        return StandardOverclocker.onlyPerfect(maxOverclocks, overclockMultiplier);
    };
}

function makeFusionRecipeExcluder(tier:number) {
    return (recipe:Recipe) => {
        return tier < getFusionTier(recipe);
    };
}

// Fusion Control Computer Mark I
machines["gt.blockmachines.fusioncomputer.tier.06"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    fixedVoltageTier: TIER_LUV,
    overclocker: makeFusionOverclocker(1, 2),
    excludesRecipe: makeFusionRecipeExcluder(1),
    info: "NOTE: overrides voltage tier"
};

// Fusion Control Computer Mark II
machines["gt.blockmachines.fusioncomputer.tier.07"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    fixedVoltageTier: TIER_ZPM,
    overclocker: makeFusionOverclocker(2, 2),
    excludesRecipe: makeFusionRecipeExcluder(2),
    info: "NOTE: overrides voltage tier"
};

// Fusion Control Computer Mark III
machines["gt.blockmachines.fusioncomputer.tier.08"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    fixedVoltageTier: TIER_UV,
    overclocker: makeFusionOverclocker(3, 2),
    excludesRecipe: makeFusionRecipeExcluder(3),
    info: "NOTE: overrides voltage tier"
};

// FusionTech MK IV
machines["gt.blockmachines.fusioncomputer.tier.09"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    fixedVoltageTier: TIER_UHV,
    overclocker: makeFusionOverclocker(4, 4),
    excludesRecipe: makeFusionRecipeExcluder(4),
    info: "NOTE: overrides voltage tier"
};

// FusionTech MK V
machines["gt.blockmachines.fusioncomputer.tier.10"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    fixedVoltageTier: TIER_UEV,
    overclocker: makeFusionOverclocker(5, 4),
    excludesRecipe: makeFusionRecipeExcluder(5),
    info: "NOTE: overrides voltage tier"
};

// Compact Fusion Computer MK-I Prototype
machines["gt.blockmachines.largefusioncomputer1"] = {
    speed: 1,
    power: 1,
    parallels: 64,
    fixedVoltageTier: TIER_LUV + 3,
    overclocker: makeFusionOverclocker(1, 2),
    excludesRecipe: makeFusionRecipeExcluder(1),
    info: "NOTE: overrides voltage tier"
};

function getCompactFusionParallel(recipe:RecipeModel, tier:number) {
    const fusionTier = getFusionTier(recipe.recipe!);
    return (1 + tier - fusionTier) * 64;
}

// Compact Fusion Computer MK-II
machines["gt.blockmachines.largefusioncomputer2"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, 2),
    fixedVoltageTier: TIER_ZPM + 4,
    overclocker: makeFusionOverclocker(2, 2),
    excludesRecipe: makeFusionRecipeExcluder(2),
    info: "NOTE: overrides voltage tier"
};

// Compact Fusion Computer MK-III
machines["gt.blockmachines.largefusioncomputer3"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, 3),
    fixedVoltageTier: TIER_UV + 4,
    overclocker: makeFusionOverclocker(3, 2),
    excludesRecipe: makeFusionRecipeExcluder(3),
    info: "NOTE: overrides voltage tier"
};

// Compact Fusion Computer MK-IV Prototype
machines["gt.blockmachines.largefusioncomputer4"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, 4),
    fixedVoltageTier: TIER_UHV + 4,
    overclocker: makeFusionOverclocker(4, 4),
    excludesRecipe: makeFusionRecipeExcluder(4),
    info: "NOTE: overrides voltage tier"
};

// Compact Fusion Computer MK-V
machines["gt.blockmachines.largefusioncomputer5"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, 5),
    fixedVoltageTier: TIER_UEV + 5,
    overclocker: makeFusionOverclocker(5, 4),
    excludesRecipe: makeFusionRecipeExcluder(5),
    info: "NOTE: overrides voltage tier"
};

const EyeOfHarmonyTierNames = [
    "1 - Crude",
    "2 - Primitive",
    "3 - Stable",
    "4 - Advanced",
    "5 - Superb",
    "6 - Exotic",
    "7 - Perfect",
    "8 - Tipler",
    "9 - Gallifreyan"
]

function getEyeOfHarmonyRecipeTier(recipeModel : RecipeModel) : number {
    let planetItem = undefined;
    const items = recipeModel.recipe?.items;
    if (items === undefined)
        return 0;

    for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        if (item.type == RecipeIoType.ItemInput) {
            planetItem = item;
            break;
        }
    }

    if (planetItem === undefined)
        return 0;

    // "Overworld", "T4: Venus", "T10: Deep Dark"
    const parts = (planetItem.goods as Item).name.split(":");
    if (parts.length == 2) {
        // Remove leading "T".
        return parseInt(parts[0].substring(1)) || 0;
    }

    return 0;
}

function getEyeOfHarmonySuccessRateWithPity(originalSuccessRate: number) : number {
    const boost = (1 - originalSuccessRate) * originalSuccessRate;
    if (originalSuccessRate < 1 && boost == 0)
        return originalSuccessRate;

    let chanceToHaveExactlyNAttempts = [0, originalSuccessRate];

    let currentSuccessChance = originalSuccessRate;
    while (currentSuccessChance < 1) {
        let currentFailChance = 1 - currentSuccessChance;
        currentSuccessChance += boost;
        let prob = currentFailChance * currentSuccessChance;
        chanceToHaveExactlyNAttempts.push(prob);
    }

    let expectedNumberOfAttempts = 0;
    for (let i = 1; i < chanceToHaveExactlyNAttempts.length; ++i) {
        expectedNumberOfAttempts += chanceToHaveExactlyNAttempts[i] * i;
    }

    return 1 / expectedNumberOfAttempts;
}

function getEyeOfHarmonySpeed(recipeModel: RecipeModel, choices: {[key:string]:number}) : number {
    const recipeTier = Math.min(getEyeOfHarmonyRecipeTier(recipeModel), 9);
    const compressionTier = choices.compression + 1;
    const tiersAbove = Math.max(0, compressionTier - recipeTier);

    const durationMultiplierFromDilation = Math.pow(0.5, choices.dilation);
    const durationMultiplierFromTier = Math.pow(0.97, tiersAbove);
    
    return 1 / (durationMultiplierFromDilation * durationMultiplierFromTier);
}

function getEyeOfHarmonyParallel(astralArrays: number) : number {
    if (astralArrays == 0)
        return 1;

    const parallelExponent = Math.floor(Math.log(8 * astralArrays) / Math.log(1.7))
    return Math.pow(2, parallelExponent);
}

// Eye of Harmony
machines["gt.blockmachines.multimachine.em.eye_of_harmony"] = {
    speed: getEyeOfHarmonySpeed,
    power: 1,
    parallels: (recipeModel, choices) => {
        return getEyeOfHarmonyParallel(choices.astralArrays);
    },
    overclocker: (recipeModel, choices) => {
        return StandardOverclocker.onlyNormal(choices.overclocks);
    },
    recipe: (recipeModel, choices, items) => {
        items = createEditableCopy(items);

        const recipeTier = Math.min(getEyeOfHarmonyRecipeTier(recipeModel), 9);

        const successPenalty = 0.0925 * choices.dilation;
        const successBoost = 0.05 * choices.stabilisation;
        const yieldPenalty = 0.05 * choices.stabilisation;
        const powerPenalty = 0.4 - 0.05 * choices.stabilisation;

        const baseSuccessChance = 1 - 0.05 * recipeTier;
        const rawSuccessChance = Math.max(0, baseSuccessChance - successPenalty + successBoost);
        const successChance = getEyeOfHarmonySuccessRateWithPity(rawSuccessChance);

        const basicFluidNeeded = 1e9 * (recipeTier + 1);

        for (let i = 0; i < items.length; ++i) {
            let item = items[i];
            if (item.type == RecipeIoType.ItemOutput || item.type == RecipeIoType.FluidOutput) {
                item.probability = successChance;
                item.amount *= 1 - yieldPenalty;
            } else if (item.type == RecipeIoType.FluidInput) {
                const fluid = item.goods as Fluid;
                if (choices.astralArrays) {
                    if (fluid.id == "f:gregtech:rawstarmatter") {
                        item.amount = (12.4 / 1e6) * basicFluidNeeded;
                    }
                } else {
                    if (fluid.id == "f:GalacticraftMars:hydrogen" || fluid.id == "f:GalacticraftMars:helium") {
                        item.amount = basicFluidNeeded;
                    }
                }
            } else if (item.type == RecipeIoType.ItemInput) {
                item.amount = 1;
            }
        }

        let spacetimeFluid : RecipeInOut = {
            type : RecipeIoType.FluidOutput,
            goodsPtr : 0,
            goods : Repository.current.GetById<Fluid>("f:gregtech:molten.spacetime") as Fluid,
            slot : 0,
            amount : rawSuccessChance * 14400 * Math.pow(2, recipeTier),
            probability : 1 - successChance
        };
        items.push(spacetimeFluid);

        const recipeDurationSeconds = (recipeModel.recipe?.gtRecipe.durationSeconds || 1) / getEyeOfHarmonySpeed(recipeModel, choices);

        // TODO: either remove as we agreed not to calculate such things, or provide display via some means
        const parallel = getEyeOfHarmonyParallel(choices.astralArrays);
        console.info("Cycle duration: " + recipeDurationSeconds.toString() + "s. Success chance: " + (rawSuccessChance*100).toString() + "%. Parallel: " + parallel.toString() + ".");
        
        return items;
    },
    choices: {
        compression: {
            description: "Compression", choices: EyeOfHarmonyTierNames
        },
        dilation: {
            description: "Time Dilation", choices: EyeOfHarmonyTierNames
        },
        stabilisation: {
            description: "Stabilisation", choices: EyeOfHarmonyTierNames
        },
        astralArrays: {
            description: "Astral Arrays"
        },
        overclocks: {
            description: "Overclocks"
        }
    },
    fixedVoltageTier: TIER_UXV,
    enforceChoiceConstraints: (recipeModel, choices) => {
        const requiredTier = Math.min(getEyeOfHarmonyRecipeTier(recipeModel), 9);
        choices.compression = Math.max(choices.compression, requiredTier - 1);

        if (Number.isNaN(choices.astralArrays))
            choices.astralArrays = 0;
        else
            choices.astralArrays = Math.min(Math.max(choices.astralArrays, 0), 8637);
        
        if (Number.isNaN(choices.overclocks))
            choices.overclocks = 0;
        else
            choices.overclocks = Math.min(Math.max(choices.overclocks, 0), 24);
    },
    info: "NOTE: Power input/output not calculated"
}

