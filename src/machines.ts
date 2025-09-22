import { RecipeModel, OverclockResult } from "./page.js";
import { Fluid, Goods, Item, Recipe, RecipeInOut, RecipeIoType, RecipeType, Repository } from "./repository.js";
import { calculateDefaultOverclocks } from "./solver.js";
import { TIER_LV, TIER_LUV, TIER_ZPM, TIER_UV, TIER_UHV, TIER_UEV } from "./utils.js";
import { voltageTier } from "./utils.js";

export type MachineCoefficient = number | ((recipe:RecipeModel, choices:{[key:string]:number}) => number);

const MAX_OVERCLOCK = Number.POSITIVE_INFINITY;

export type Machine = {
    choices?: {[key:string]:Choice};
    enforceChoiceConstraints?: (recipe:RecipeModel, choices:{[key:string]:number}) => void;
    perfectOverclock?: MachineCoefficient;
    speed: MachineCoefficient;
    power: MachineCoefficient;
    parallels: MachineCoefficient;
    customOverclock?: (recipeModel:RecipeModel, overclockTiers:number) => OverclockResult;
    recipe?: (recipe:RecipeModel, choices:{[key:string]:number}, items:RecipeInOut[]) => RecipeInOut[];
    info?: string;
    ignoreParallelLimit?: boolean;
}

function noOverclock(recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
    return {overclockSpeed:1, overclockPower:1, perfectOverclocks:0};
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
    choices: ["T1: Cupronickel", "T2: Kanthal", "T3: Nichrome", "T4: TPV", "T5: HSS-G", "T6: HSS-S", "T7: Naquadah", "T8: Naquadah Alloy", "T9: Trinium", "T10: Electrum Flux", "T11: Awakened Draconium", "T12: Infinity", "T13: Hypogen", "T14: Eternal"],
}

type MachineList = {
    [key: string]: Machine;
}

export const machines: MachineList = {};

export const singleBlockMachine:Machine = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

const singleBlockMachineWith22Overclock:Machine = {
    perfectOverclock: 0,
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
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented (Calculated as a singleblock)",
}

machines["Steam Compressor"] = machines["Steam Alloy Smelter"] = machines["Steam Extractor"] = machines["Steam Furnace"] = machines["Steam Forge Hammer"] = machines["Steam Macerator"] = {
    perfectOverclock: 0,
    speed: 0.5,
    power: 0,
    parallels: 1,
    info: "Steam machine: Steam consumption not calculated, set the voltage to LV",
}

machines["High Pressure Steam Compressor"] = machines["High Pressure Alloy Smelter"] = machines["High Pressure Steam Extractor"] = machines["High Pressure Steam Furnace"] = machines["High Pressure Steam Forge Hammer"] = machines["High Pressure Steam Macerator"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 0,
    parallels: 1,
    info: "High pressure steam machine: Steam consumption not calculated, set the voltage to LV",
}

machines["Steam Squasher"] = machines["Steam Separator"] = machines["Steam Presser"] = machines["Steam Grinder"] = machines["Steam Purifier"] = machines["Steam Blender"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => choices.pressure == 1 ? 1.25 : 0.625,
    power: 0,
    parallels: 8,
    info: "Steam multiblock machine: Steam consumption not calculated, set the voltage to LV",
    choices: {
        pressure: {
            description: "Pressure",
            choices: ["Normal", "High"],
        },
    },
}

machines["Large Electric Compressor"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

machines["Hot Isostatic Pressurization Unit"] = {
    perfectOverclock: 0,
    // TODO: 250% faster/slower than singleblock machines of the same voltage
    speed: 2.5,
    // TODO: 75%/110%
    power: 0.75,
    // TODO: 4/1 per voltage tier
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
    info: "Assumes it is not overheated"
};

machines["Pseudostable Black Hole Containment Field"] = {
    perfectOverclock: 0,
    speed: 5,
    power: 0.7,
    parallels: (recipe, choices) => {
        // TODO: 2x/4x when stability is BELOW 50/20
        return (recipe.voltageTier + 1) * 8;
    },
    info: "Parallels depend on stability, which is not represented.",
};

machines["Bacterial Vat"] = {
    perfectOverclock: 0,
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

machines["Circuit Assembly Line"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Component Assembly Line"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1
};

machines["Extreme Heat Exchanger"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Naquadah Fuel Refinery"] = {
    perfectOverclock: (recipe, choices) => recipe.voltageTier - TIER_UEV + choices.coils,
    speed: 1,
    power: 1,
    parallels: 1,
    choices: {coils: {
        description: "Coils",
        choices: ["T1 Field Restriction Coil", "T2 Advanced Field Restriction Coil", "T3 Ultimate Field Restriction Coil", "T4 Temporal Field Restriction Coil"],
    }},
};

machines["Neutron Activator"] = {
    speed: (recipe, choices) => Math.pow((1/0.9), (choices.speedingPipeCasing - 4)),
    power: 0,
    parallels: 1,
    customOverclock: noOverclock,
    choices: {speedingPipeCasing: {
        description: "Speeding Pipe Casing",
        min: 4,
    }},
    info: "Power calculation is not implemented.",
};

machines["Precise Auto-Assembler MT-3662"] = {
    perfectOverclock: 0,
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

machines["Fluid Shaper"] = {
    perfectOverclock: 0,
    speed: 3, // TODO: Speed decays
    power: 0.8,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * 2 + (recipe.voltageTier + 1) * 3 * choices.widthExpansion,
    choices: {widthExpansion: {description: "Width Expansion"}},
    info: "Speed decays over time.",
};

machines["Zyngen"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => 1 + choices.coilTier * 0.05,
    power: 1,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * choices.coilTier,
    choices: {coilTier: CoilTierChoice},
};

machines["High Current Industrial Arc Furnace"] = {
    perfectOverclock: 0,
    speed: 3.5,
    power: 1,
    parallels: (recipe, choices) => {
        return IsRecipeType(recipe, "Plasma Arc Furnace") ? (recipe.voltageTier + 1) * 8 * choices.w : (recipe.voltageTier + 1) * choices.w;
    },
    choices: {w: {description: "W", min: 1}},
};

machines["Large Scale Auto-Assembler v1.01"] = {
    perfectOverclock: 0,
    speed: 3,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

let PipeCasingTierChoice:Choice = {
    description: "Pipe Casing Tier",
    choices: ["T1: Tin", "T2: Brass", "T3: Electrum", "T4: Platinum", "T5: Osmium", "T6: Quantium", "T7: Fluxed Electrum", "T8: Black Plutonium"],
}

machines["Industrial Autoclave"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => 1.25 + choices.coilTier * 0.25,
    power: (recipe, choices) => (11 - choices.pipeCasingTier) / 12,
    parallels: (recipe, choices) => choices.pipeCasingTier * 12 + 12,
    choices: {coilTier: CoilTierChoice, pipeCasingTier: PipeCasingTierChoice},
};

function GetEbfRecipeBaseCoilTier(recipe?: Recipe): number {
    let temp = recipe?.gtRecipe.specialValue ?? 0;
    let coilTier = Math.max(0, Math.min(13, Math.floor((temp - 1801) / 900)));
    return coilTier;
}

let ebfPerfectOverclock:MachineCoefficient = (recipe, choices) => {
    let tier = GetEbfRecipeBaseCoilTier(recipe.recipe);
    return Math.floor((choices.coilTier - tier)/2);
}

let ebfPower:MachineCoefficient = (recipe, choices) => {
    let tier = GetEbfRecipeBaseCoilTier(recipe.recipe);
    return Math.pow(0.95, choices.coilTier - tier);
}

machines["Electric Blast Furnace"] = {
    perfectOverclock: ebfPerfectOverclock,
    speed: 1,
    power: ebfPower,
    parallels: 1,
    recipe: (recipe, choices, items) => {   
        for (let i=0; i<items.length; i++) {
            let item = items[i];
            if (item.type == RecipeIoType.FluidOutput && item.goods instanceof Fluid && 
                (item.goods.name == "CO2 Gas" || item.goods.name == "Sulfur Dioxide" || item.goods.name == "Carbon Monoxide")) {
                items = createEditableCopy(items);
                items[i].amount = choices.muffler * item.amount * 0.125;
                break;
            }
        }
        return items;
    },
    choices: {coilTier: CoilTierChoice, muffler: {description: "Muffler hatch", choices: ["LV (0%)", "MV (12.5%)", "HV (25%)", "EV (37.5%)", "IV (50%)", "LuV (62.5%)", "ZPM (75%)", "UV (87.5%)", "UHV (100%)"]}},
};

machines["Volcanus"] = {
    perfectOverclock: ebfPerfectOverclock,
    speed: 2.2,
    power: (recipe, choices) => ebfPower(recipe, choices) * 0.9,
    parallels: 8,
    choices: {coilTier: CoilTierChoice},
    info: "Blazing pyrotheum required (Not calculated)",
};

machines["Mega Blast Furnace"] = {
    perfectOverclock: ebfPerfectOverclock,
    speed: 1,
    power: ebfPower,
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
};

machines["Big Barrel Brewery"] = {
    perfectOverclock: 0,
    speed: 1.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["TurboCan Pro"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

machines["Ore Washing Plant"] = {
    perfectOverclock: 0,
    speed: 5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["Oil Cracking Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: (recipe, choices) => 1 - Math.min(0.5, (choices.coilTier + 1) * 0.1),
    parallels: 1,
    choices: {coilTier: CoilTierChoice},
};

machines["Mega Oil Cracker"] = {
    perfectOverclock: 0,
    speed: 1,
    power: (recipe, choices) => 1 - Math.min(0.5, (choices.coilTier + 1) * 0.1),
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
};

machines["Industrial Cutting Factory"] = {
    perfectOverclock: 0,
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["Distillation Tower"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Dangote Distillus"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => IsRecipeType(recipe, "Distillation Tower") ? 3.5 : 2,
    power: (recipe, choices) => IsRecipeType(recipe, "Distillation Tower") ? 1 : 0.15,
    parallels: (recipe, choices) => {
        if (IsRecipeType(recipe, "Distillation Tower")) {
            return choices.tier == 0 ? 4 : 12;
        } else {
            return (recipe.voltageTier + 1) * 4 * (choices.tier + 1);
        }
    },
    choices: {tier: {description: "Tier", choices: ["T1", "T2"]}},
};

machines["Mega Distillation Tower"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 256,
};

machines["Electric Implosion Compressor"] = {
    perfectOverclock: 0,
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

machines["Magnetic Flux Exhibitor"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => electroMagnets[choices.electromagnet].speed,
    power: (recipe, choices) => electroMagnets[choices.electromagnet].power,
    parallels: (recipe, choices) => electroMagnets[choices.electromagnet].parallels,
    choices: {electromagnet: {description: "Electromagnet", choices: electroMagnets.map(m => m.name)}},
};

machines["Dissection Apparatus"] = {
    perfectOverclock: 0,
    speed: 3,
    power: 0.85,
    parallels: (recipe, choices) => (choices.pipeCasingTier + 1) * 8,
    choices: {pipeCasingTier: PipeCasingTierChoice},
};

machines["Industrial Extrusion Machine"] = {
    perfectOverclock: 0,
    speed: 3.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["Assembly Line"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

function laserOverclockCalculator(recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
    const amperage = recipeModel.choices.inputAmperage;
    const availableEut = voltageTier[recipeModel.voltageTier].voltage * amperage;
    let currentEut = (recipeModel.recipe?.gtRecipe?.voltage || 32) * recipeModel.getItemInputCount();
    
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

        if (potentialEU >= availableEut) break;

        currentEut = potentialEU;
        overclockSpeed *= 2;
        overclockPower *= multiplier / 2;
        laserOverclocks += 1;

        if (laserOverclocks + regularOverclocks > overclockTiers + (Math.log(amperage) / Math.log(4))) break;
    }

    let overclockNameParts = new Array();
    if (regularOverclocks > 0) {
        overclockNameParts.push("OC x" + regularOverclocks);
    }

    if (laserOverclocks > 0 ) {
        overclockNameParts.push("Laser OC x" + laserOverclocks);
    }

    return {
        overclockSpeed : overclockSpeed, 
        overclockPower : overclockPower, 
        perfectOverclocks : 0,
        overclockName : overclockNameParts.join(", ")
    };
};

machines["Advanced Assembly Line"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    customOverclock: laserOverclockCalculator,
    parallels: (recipe) => recipe.getItemInputCount(),
    ignoreParallelLimit: true, // prevent parallel limitation as solver does not understand separate ampearage
    choices: {inputAmperage: {description: "Input Amperage", min: 16}},
    info: "NOTE: Voltage determines the energy hatch voltage, not maximum voltage. WARNING: Calculates beyond 1 slice per tick.",
};

machines["Large Fluid Extractor"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => 1.5 * Math.pow(1.10, (choices.coilTier + 1)),
    power: (recipe, choices) => 0.80 * Math.pow(0.90, (choices.coilTier + 1)),
    parallels: (recipe, choices) => (choices.solenoidTier + 2) * 8,
    choices: {coilTier: CoilTierChoice, solenoidTier: {description: "Solenoid Tier", choices: ["MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV"]}},
};

machines["Thermic Heating Device"] = {
    perfectOverclock: 0,
    speed: 2.2,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

machines["Furnace"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Multi Smelter"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: (recipe, choices) => {
        return 8 * Math.pow(2, choices.coilTier);
    },
    choices: {coilTier: CoilTierChoice},
    info: "Parallel amount needs testing!",
};

machines["Industrial Sledgehammer"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 1,
    parallels: (recipe, choices) => (recipe.voltageTier + 1) * (choices.anvilTier + 1) * 8,
    choices: {anvilTier: {description: "Anvil Tier", choices: ["T1 - Vanilla", "T2 - Steel", "T3 - Dark Steel / Thaumium", "T4 - Void Metal"]}},
};

machines["Nuclear Reactor"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Implosion Compressor"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Density^2"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 1,
    parallels: (recipe) => Math.floor((recipe.voltageTier + 1) / 2) + 1,
};

machines["Large Chemical Reactor"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Mega Chemical Reactor"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 256,
};

machines["Hyper-Intensity Laser Engraver"] = {
    perfectOverclock: 0,
    speed: 3.5,
    power: 0.8,
    parallels: (recipe, choices) => Math.floor(Math.cbrt(choices.laserAmperage)),
    choices: {laserAmperage: {description: "Laser Amperage", min: 1}},
};

let precisionLatheParallels:number[] = [1, 1, 2, 4, 8, 12, 16, 32];
let precisionLatheSpeed:number[] = [0.75, 0.8, 0.9, 1, 1.5, 2, 3, 4];

machines["Industrial Precision Lathe"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => ((precisionLatheSpeed[choices.itemPipeCasings] + recipe.voltageTier + 1) / 4),
    power: 0.8,
    parallels: (recipe, choices) => precisionLatheParallels[choices.itemPipeCasings] + (recipe.voltageTier + 1) * 2,
    choices: {itemPipeCasings:PipeCasingTierChoice}
};

machines["Industrial Maceration Stack"] = {
    perfectOverclock: 0,
    speed: 1.6,
    power: 1,
    parallels: (recipe, choices) => {
        const hasUpgrade = choices.upgradeChip == 1;
        const n = hasUpgrade ? 8 : 2;
        return n * (recipe.voltageTier + 1);
    },
    choices: {upgradeChip: {description: "Upgrade Chip", choices: ["No Upgrade", "Maceration Upgrade Chip"]}},
};

machines["Industrial Material Press"] = {
    perfectOverclock: 0,
    speed: 6,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["Nano Forge"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
    choices: {tier: {description: "Tier", choices: ["T1 (Carbon Nanite)", "T2 (Neutronium Nanite)", "T3 (Transcendent Metal Nanite)"]}},
    info: "Nano forge perfect overclock not implemented.",
};

machines["Neutronium Compressor"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 8,
};

machines["Amazon Warehousing Depot"] = {
    perfectOverclock: 0,
    speed: 6,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 16,
};

machines["PCB Factory"] = {
    perfectOverclock: (recipe, choices) => choices.cooling >= 2 ? MAX_OVERCLOCK : 0,
    speed: (recipe, choices) => 1/Math.pow(100/choices.traceSize, 2),
    power: (recipe, choices) => choices.cooling > 0 && choices.biochamber > 0 ? Math.sqrt(2) : 1,
    customOverclock: function(recipe, overclockTiers) {
        if (recipe.choices.cooling == 0)
            return noOverclock(recipe, overclockTiers);
        return calculateDefaultOverclocks(recipe, overclockTiers);
    },
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

machines["Dimensionally Transcendent Plasma Forge"] = {
    perfectOverclock: (recipe, choices) => choices.convergence > 0 ? MAX_OVERCLOCK : 0,
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

machines["Bricked Blast Furnace"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Clarifier Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Residual Decontaminant Degasser Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Flocculation Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Ozonation Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["pH Neutralization Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Extreme Temperature Fluctuation Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Absolute Baryonic Perfection Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented",
};

machines["High Energy Laser Purification Unit"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Machine not implemented",
};

machines["Pyrolyse Oven"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => (choices.coils + 1) * 0.5,
    power: 1,
    parallels: 1,
    choices: {coils: CoilTierChoice},
};

machines["Elemental Duplicator"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 1,
    parallels: (recipe) => 8 * (recipe.voltageTier + 1),
};

machines["Research station"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Boldarnator"] = {
    perfectOverclock: 0,
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

machines["Large Thermal Refinery"] = {
    perfectOverclock: 0,
    speed: 2.5,
    power: 0.8,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

machines["Transcendent Plasma Mixer"] = {
    speed: 1,
    customOverclock: noOverclock,
    power: 10,
    parallels: (recipe, choices) => choices.parallels,
    choices: {parallels: {description: "Parallels", min: 1}}
};

machines["Forge of the Gods"] = notImplementedMachine;

machines["Vacuum Freezer"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Mega Vacuum Freezer"] = {
    perfectOverclock: (recipe, choices) => choices.coolant,
    speed: 1,
    power: 1,
    parallels: 256,
    choices: {coolant: {description: "Coolant", choices: ["No Coolant", "Molten SpaceTime", "Spatially Enlarged Fluid", "Molten Eternity"]}},
    info: "Coolant calculation not implemented.",
};

machines["Industrial Wire Factory"] = {
    perfectOverclock: 0,
    speed: 3,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

machines["Digester"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Dissolution Tank"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Source Chamber"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
    info: "Output energy scales with EU/t up to the point shown in the recipe.",
};

machines["Target Chamber"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Alloy Blast Smelter"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Mega Alloy Blast Smelter"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => Math.max(1, 1 - 0.05 * (choices.coilTier - 3)),
    power: (recipe, choices) => Math.pow(0.95, choices.coilTier - recipe.voltageTier),
    parallels: 256,
    choices: {coilTier: CoilTierChoice},
    info: "Assumes matching glass tier.",
};

machines["Industrial Coke Oven"] = {
    perfectOverclock: 0,
    speed: 1,
    power: (recipe, choices) => 1 - (recipe.voltageTier + 1) * 0.04,
    parallels: (recipe, choices) => choices.casingType == 1 ? 24 : 12,
    choices: {casingType: {description: "Casing Type", choices: ["Heat Resistant Casings", "Heat Proof Casings"]}},
};

machines["Cryogenic Freezer"] = {
    perfectOverclock: 0,
    speed: 2,
    power: 1,
    parallels: 4,
};

machines["COMET - Compact Cyclotron"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Zhuhai - Fishing Port"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: (recipe) => ((recipe.voltageTier + 1) + 1) * 2,
};

machines["Reactor Fuel Processing Plant"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Flotation Cell Regulator"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["ExxonMobil Chemical Plant"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => {
        return choices.coilTier * 0.5 + 1;
    },
    power: 1,
    parallels: (recipe, choices) => (choices.pipeCasingTier + 1) * 2,
    choices: {coilTier: CoilTierChoice, pipeCasingTier: {description: "Pipe Casing Tier", choices: ["T1: Bronze", "T2: Steel", "T3: Titanium", "T4: Tungstensteel"]}},
    recipe: (recipe, choices, items) => {
        if (choices.coilTier >= 10 && choices.pipeCasingTier >= 3)
            return items;
        let catalystNumber = items.findIndex(item => item.type == RecipeIoType.ItemInput && item.goods instanceof Item && item.goods.name.endsWith("Catalyst"));
        if (catalystNumber == -1)
            return items;
        let catalystUsage = (1 - 0.2 * choices.pipeCasingTier) / 50;
        items = createEditableCopy(items);
        items[catalystNumber].amount = catalystUsage;
        return items;
    }
};

machines["Thorium Reactor [LFTR]"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Matter Fabrication CPU"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 0.8,
    parallels: (recipe, choices) => {
        let scrap = recipe.recipe?.gtRecipe?.voltageTier == TIER_LV;
        return scrap ? 64 : 8 * (recipe.voltageTier + 1);
    },
};

machines["Molecular Transformer"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Industrial Centrifuge"] = {
    perfectOverclock: 0,
    speed: 2.25,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 6,
};

machines["Utupu-Tanuri"] = {
    perfectOverclock: (recipe, choices) => Math.floor(choices.heatIncrements / 2),
    speed: (recipe, choices) => 2.2 * Math.pow(1.05, choices.heatIncrements),
    power: 0.5,
    parallels: 4,
    choices: {heatIncrements: {description: "Heat Difference Tiers", min: 0}},
    info: "Extracting heat difference from the recipe is not implemented.",
};

machines["Industrial Electrolyzer"] = {
    perfectOverclock: 0,
    speed: 2.8,
    power: 0.9,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

machines["Industrial Mixing Machine"] = {
    perfectOverclock: 0,
    speed: 3.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 8,
};

machines["Nuclear Salt Processing Plant"] = {
    perfectOverclock: 0,
    speed: 2.5,
    power: 1,
    parallels: (recipe) => (recipe.voltageTier + 1) * 2,
};

machines["IsaMill Grinding Machine"] = {
    perfectOverclock: MAX_OVERCLOCK,
    speed: 1,
    power: 1,
    parallels: 1,
};

machines["Quantum Force Transformer"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: (recipe, choices) => 1 + choices.catalysts,
    choices: {catalysts: {description: "Catalysts", min: 0}},
};

machines["Sparge Tower Controller"] = {
    perfectOverclock: 0,
    speed: 1,
    power: 1,
    parallels: 1,
};

let sawMultipliers = [0, 1, 2, 4];
let saplingsMultipliers = [0, 1, 4];
let leavesMultipliers = [0, 1, 2, 4];
let fruitsMultipliers = [0, 1];

machines["Tree Growth Simulator"] = {
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
    customOverclock: noOverclock,
    choices: {
        saw: {description: "Saw", choices: ["No saw", "Saw (x1)", "Buzzsaw (x2)", "Chainsaw (x4)"]},
        saplings: {description: "Saplings", choices: ["No grafter", "Branch cutter (x1)", "Grafter (x4)"]},
        leaves: {description: "Leaves", choices: ["No shears", "Shears (x1)", "Wire Cutter (x2)", "Automatic Snips (x4)"]},
        fruits: {description: "Fruits", choices: ["No knife", "Knife (x1)"]}
    },
    power: 1,
    parallels: 1,
};

machines["Draconic Evolution Fusion Crafter"] = {
    perfectOverclock: 0,
    speed: (recipe, choices) => 1 / Math.max(1, (choices.casingTier - (recipe.recipe?.gtRecipe?.voltageTier || 0))),
    power: 1,
    parallels: 1,
    choices: {casingTier: PipeCasingTierChoice}
};

machines["Large Sifter Control Block"] = {
    perfectOverclock: 0,
    speed: 5,
    power: 0.75,
    parallels: (recipe) => (recipe.voltageTier + 1) * 4,
};

function makeFusionOverclockCalculator(fusionTier:number, overclockMultiplier:number):(recipeModel:RecipeModel, overclockTiers:number) => OverclockResult {
    return function (recipeModel:RecipeModel, overclockTiers:number): OverclockResult {
        const recipeTier = Math.max(TIER_LUV, recipeModel.recipe?.gtRecipe?.voltageTier || 0);
        const perfectOverclocks = Math.max(0, fusionTier - recipeTier);
        return {
            overclockSpeed:Math.pow(overclockMultiplier, perfectOverclocks),
            overclockPower:1,
            perfectOverclocks:perfectOverclocks,
            overclockName:overclockMultiplier+"/"+overclockMultiplier+" OC x"+perfectOverclocks
        };
    };
}

machines["Fusion Control Computer Mark I"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    customOverclock: makeFusionOverclockCalculator(TIER_LUV, 2),
    info: "Min. energy hatch tier: LUV",
};

machines["Fusion Control Computer Mark II"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    customOverclock: makeFusionOverclockCalculator(TIER_ZPM, 2),
    info: "Min. energy hatch tier: ZPM",
};

machines["Fusion Control Computer Mark III"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    customOverclock: makeFusionOverclockCalculator(TIER_UV, 2),
    info: "Min. energy hatch tier: UV",
};

machines["FusionTech MK IV"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    customOverclock: makeFusionOverclockCalculator(TIER_UHV, 4),
    info: "Min. energy hatch tier: UHV",
};

machines["FusionTech MK V"] = {
    speed: 1,
    power: 1,
    parallels: 1,
    customOverclock: makeFusionOverclockCalculator(TIER_UEV, 4),
    info: "Min. energy hatch tier: UEV",
};

machines["Compact Fusion Computer MK-I Prototype"] = {
    speed: 1,
    power: 1,
    parallels: 64,
    customOverclock: makeFusionOverclockCalculator(TIER_LUV, 2),
    info: "Min. energy hatch tier: LUV",
};

function getCompactFusionParallel(recipe:RecipeModel, buckets:number[][]) {
    const startupCost = recipe.recipe?.gtRecipe?.specialValue ?? 0;
    for (const [threshold, parallel] of buckets) {
        if (startupCost < threshold) {
            return parallel;
        }
    }
    return 1;
}

machines["Compact Fusion Computer MK-II"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, [[160_000_000, 128], [Number.POSITIVE_INFINITY, 64]]),
    customOverclock: makeFusionOverclockCalculator(TIER_ZPM, 2),
    info: "Min. energy hatch tier: ZPM",
};

machines["Compact Fusion Computer MK-III"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, [[160_000_000, 192], [320_000_000, 128], [Number.POSITIVE_INFINITY, 64]]),
    customOverclock: makeFusionOverclockCalculator(TIER_UV, 2),
    info: "Min. energy hatch tier: UV",
};

machines["Compact Fusion Computer MK-IV Prototype"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, [[160_000_000, 256], [320_000_000, 192], [640_000_000, 128], [Number.POSITIVE_INFINITY, 64]]),
    customOverclock: makeFusionOverclockCalculator(TIER_UHV, 4),
    info: "Min. energy hatch tier: UHV",
};

machines["Compact Fusion Computer MK-V"] = {
    speed: 1,
    power: 1,
    parallels: (recipe) => getCompactFusionParallel(recipe, [[160_000_000, 320], [320_000_000, 256], [640_000_000, 192], [1_200_000_000, 128], [Number.POSITIVE_INFINITY, 64]]),
    customOverclock: makeFusionOverclockCalculator(TIER_UEV, 4),
    info: "Min. energy hatch tier: UEV",
};
