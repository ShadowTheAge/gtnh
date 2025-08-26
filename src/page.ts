import { Goods, Item, Recipe, RecipeInOut, RecipeObject } from "./repository.js";
import { SolvePage } from "./solver.js";
import { showConfirmDialog } from './dialogues.js';
import { Machine, singleBlockMachine } from "./machines.js";
import { Choice } from "./machines.js";
import { SearchQuery } from "./searchQuery.js";

let nextIid = 0;

export abstract class ModelObjectVisitor
{
    abstract VisitData(parent:ModelObject, key:string, data:any):void;
    abstract VisitObject(parent:ModelObject, key:string, obj:ModelObject):void;
    VisitArray(parent:ModelObject, key:string, array:ModelObject[]):void
    {
        for (const obj of array) {
            this.VisitObject(parent, key, obj);
        }
    }
}

class ModelObjectSerializer extends ModelObjectVisitor
{
    stack: object[] = [];
    current: {[key:string]: any} = {};

    VisitData(parent:ModelObject, key: string, data: any): void {
        this.current[key] = data;
    }

    VisitObject(parent:ModelObject, key: string, obj: ModelObject): void {
        this.stack.push(this.current);
        this.current = {};
        obj.Visit(this);
        let result = this.current;
        this.current = this.stack.pop()!;
        this.current[key] = result;
    }

    VisitArray(parent:ModelObject, key: string, array: ModelObject[]): void {
        var arr = [];
        this.stack.push(this.current);
        for (const obj of array) {
            this.current = {};
            obj.Visit(this);
            arr.push(this.current);
        }
        this.current = this.stack.pop()!;
        this.current[key] = arr;
    }

    Serialize(obj:ModelObject):any
    {
        this.current = {};
        obj.Visit(this);
        return this.current;
    }
}

type iidScanResult = {current:ModelObject, parent:ModelObject} | null;

class ModelObjectIidScanner extends ModelObjectVisitor
{
    iid:number = 0;
    result:ModelObject | null = null;
    resultParent:ModelObject | null = null;

    VisitData(parent:ModelObject, key: string, data: any): void {}
    VisitObject(parent:ModelObject, key: string, obj: ModelObject): void {
        if (this.result !== null)
            return;
        if (obj.iid === this.iid) {
            this.result = obj;
            this.resultParent = parent;
            return;
        }
        obj.Visit(this);
    }

    Scan(obj:ModelObject, parent:ModelObject, iid:number):iidScanResult
    {
        if (obj.iid === iid) {
            return {current:obj, parent:parent};
        }
        this.result = null;
        this.iid = iid;
        obj.Visit(this);
        return this.result === null || this.resultParent === null ? null : {current:this.result, parent:this.resultParent};
    }
}

let serializer = new ModelObjectSerializer();
export { serializer };
let iidScanner = new ModelObjectIidScanner();

export function GetByIid(iid:number):iidScanResult
{
    return iidScanner.Scan(page, page, iid);
}

export abstract class ModelObject
{
    iid:number;
    abstract Visit(visitor:ModelObjectVisitor):void;

    constructor()
    {
        this.iid = nextIid++;
    }
}

export class FlowInformation {
    input: {[key:string]:number} = {};
    output: {[key:string]:number} = {};
    energy: {[key:number]:number} = {};

    Add(goods:RecipeObject, amount:number, isOutput:boolean) {
        if (isOutput) {
            this.output[goods.id] = (this.output[goods.id] || 0) + amount;
        } else {
            this.input[goods.id] = (this.input[goods.id] || 0) + amount;
        }
    }

    Merge(other:FlowInformation) {
        for (const key in other.input) {
            if (other.input[key] === 0) continue;
            this.input[key] = (this.input[key] || 0) + other.input[key];
        }
        for (const key in other.output) {
            if (other.output[key] === 0) continue;
            this.output[key] = (this.output[key] || 0) + other.output[key];
        }
        for (const key in other.energy) {
            if (other.energy[key] === 0) continue;
            this.energy[key] = (this.energy[key] || 0) + other.energy[key];
        }
    }   
}

export enum LinkAlgorithm {
    Match,
    Ignore,
    //AtLeast,
    //AtMost,
}

let emptyFlow:FlowInformation = new FlowInformation();

export abstract class RecipeGroupEntry extends ModelObject{
    flow: FlowInformation = emptyFlow;
}

export class RecipeGroupModel extends RecipeGroupEntry
{
    links: {[key:string]:LinkAlgorithm} = {};
    actualLinks: {[key:string]:LinkAlgorithm} = {};
    elements: RecipeGroupEntry[] = [];
    collapsed: boolean = false;
    name: string = "Group";

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "type", "recipe_group");
        visitor.VisitData(this, "links", this.links);
        visitor.VisitArray(this, "elements", this.elements);
        visitor.VisitData(this, "collapsed", this.collapsed);
        visitor.VisitData(this, "name", this.name);
    }

    constructor(source:any = undefined)
    {
        super();
        if (source instanceof Object) {
            if (source.links instanceof Object)
                this.links = source.links;
            if (source.elements instanceof Array)
                this.elements = source.elements.map((element: any) => {
                    if (element.type === "recipe")
                        return new RecipeModel(element);
                    else
                        return new RecipeGroupModel(element);
                });
            if (source.collapsed === true)
                this.collapsed = true;
            if (typeof source.name === "string")
                this.name = source.name;
        }
    }
}

export class RecipeModel extends RecipeGroupEntry
{
    type: string = "recipe";
    recipeId: string = "";
    recipe?:Recipe;
    voltageTier: number = 0;
    crafter: string | undefined;
    choices: {[key:string]:number} = {};
    fixedCrafterCount?:number;

    recipesPerMinute:number = 0;
    crafterCount:number = 0;
    overclockFactor:number = 1;
    powerFactor:number = 1;
    parallels:number = 0;
    overclockTiers:number = 0;
    perfectOverclocks:number = 0;
    selectedOreDicts:{[key:string]:Item} = {};
    machineInfo:Machine = singleBlockMachine;
    multiblockCrafter:Item | null = null;
    recipeItems:RecipeInOut[] = [];

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "type", this.type);
        visitor.VisitData(this, "recipeId", this.recipeId);
        visitor.VisitData(this, "voltageTier", this.voltageTier);
        visitor.VisitData(this, "crafter", this.crafter);
        visitor.VisitData(this, "choices", this.choices);
        visitor.VisitData(this, "fixedCrafterCount", this.fixedCrafterCount);
    }

    constructor(source:any = undefined)
    {
        super();
        if (source instanceof Object) {
            if (typeof source.recipeId === "string")
                this.recipeId = source.recipeId;
            if (typeof source.voltageTier === "number")
                this.voltageTier = source.voltageTier;
            if (typeof source.crafter === "string")
                this.crafter = source.crafter;
            if (source.choices instanceof Object)
                this.choices = source.choices;
            if (typeof source.fixedCrafterCount === "number")
                this.fixedCrafterCount = source.fixedCrafterCount;
        }
    }

    ValidateChoices(machineInfo: Machine): void {
        if (!machineInfo.choices) {
            this.choices = {};
            return;
        }

        const validatedChoices: {[key:string]:number} = {};

        for (const [key, choice] of Object.entries(machineInfo.choices)) {
            const currentValue = this.choices[key];
            const typedChoice = choice as Choice;

            const min = typedChoice.min ?? 0;
            let max = typedChoice.max ?? Number.POSITIVE_INFINITY;
            if (typedChoice.choices)
                max = typedChoice.choices.length - 1;
            validatedChoices[key] = Math.min(Math.max(currentValue ?? min, min), max);
        }

        this.choices = validatedChoices;
    }

    public getFusionStartupCost(): number {
        if (this.recipe?.gtRecipe?.additionalInfo) {
            const regex = /To start:\s*([\d,]+(?:\.\d+)?)/i;
            const match = this.recipe.gtRecipe.additionalInfo.match(regex);
    
            if (match && match[1]) {
                const numberString = match[1].replace(/,/g, '');
                return parseInt(numberString);
            }
        }

        return 0;
    }
}

export type OverclockResult = {
    overclockSpeed : number;
    overclockPower : number;
    perfectOverclocks?: number;
}

export class ProductModel extends ModelObject
{
    goodsId: string;
    amount: number = 1;

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "goodsId", this.goodsId);
        visitor.VisitData(this, "amount", this.amount);
    }

    constructor(source:any = undefined)
    {
        super();
        this.goodsId = "";
        if (source instanceof Object) {
            if (typeof source.goodsId === "string")
                this.goodsId = source.goodsId;
            if (typeof source.amount === "number")
                this.amount = source.amount;
        }
    }
}

type Settings = {
    minVoltage: number;
    timeUnit: "hour" | "min" | "sec" | "tick";
}

export class PageModel extends ModelObject
{
    name: string = "New Page";
    products: ProductModel[] = [];
    rootGroup: RecipeGroupModel = new RecipeGroupModel();
    private history: string[] = [];
    private readonly MAX_HISTORY = 50;
    status: "not solved" | "solved" | "infeasible" | "unbounded" = "not solved";
    settings: Settings = {minVoltage: 0, timeUnit: "min"};
    timeScale: number = 1;

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "name", this.name);
        visitor.VisitArray(this, "products", this.products);
        visitor.VisitObject(this, "rootGroup", this.rootGroup);
        visitor.VisitData(this, "settings", this.settings);
    }

    constructor(source:any = undefined)
    {
        super();
        this.loadFromObject(source);
    }

    private loadFromObject(source:any) {
        if (source instanceof Object) {
            if (typeof source.name === "string")
                this.name = source.name;
            if (source.products instanceof Array)
                this.products = source.products.map((product: any) => new ProductModel(product));
            if (source.rootGroup instanceof Object)
                this.rootGroup = new RecipeGroupModel(source.rootGroup);
            if (source.settings instanceof Object) {
                if (typeof source.settings.minVoltage === "number")
                    this.settings.minVoltage = source.settings.minVoltage;
                if (typeof source.settings.timeUnit === "string")
                    this.settings.timeUnit = source.settings.timeUnit as "hour" | "min" | "sec" | "tick";
            }
        }
    }

    // Undo history methods
    addToHistory(json:string) {
        this.history.push(json);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }
    }

    undo(): boolean {
        if (this.history.length > 1) {
            this.history.pop(); // Remove current state
            const previousState = this.history[this.history.length - 1];
            try {
                this.loadFromObject(JSON.parse(previousState));
                SolvePage(this);
                return true;
            } catch (e) {
                console.error("Failed to undo:", e);
            }
        }
        return false;
    }
}

function SearchGroup(query:SearchQuery, group:RecipeGroupModel, idMap:{[key:string]:boolean})
{
    for (let element of group.elements) {
        if (element instanceof RecipeGroupModel) {
            SearchGroup(query, element, idMap);
        } else if (element instanceof RecipeModel) {
            if (!element.recipe)
                continue;
            for (let item of element.recipe.items) {
                if (item.goods.id in idMap)
                    continue;
                idMap[item.goods.id] = item.goods.MatchSearchText(query);
            }
        }
    }
}

export function Search(text:string):{[key:string]:boolean}
{
    let result:{[key:string]:boolean} = {}
    let query = new SearchQuery(text);
    SearchGroup(query, page.rootGroup, result);
    return result;
}

export function DragAndDrop(sourceIid:number, targetIid:number)
{
    if (sourceIid === targetIid)
        return;

    var draggingObject = GetByIid(sourceIid);
    if (draggingObject === null || !(draggingObject.parent instanceof RecipeGroupModel) || !(draggingObject.current instanceof RecipeGroupEntry))
        return;
    var targetObject = GetByIid(targetIid);
    if (targetObject === null || !(targetObject.current instanceof RecipeGroupEntry))
        return;
    if (draggingObject.current instanceof RecipeGroupModel && !draggingObject.current.collapsed)
        return;
    console.log("DragAndDrop", draggingObject, targetObject);
    let success = false;

    if (targetObject.current instanceof RecipeGroupModel && !targetObject.current.collapsed) {
        draggingObject.parent.elements.splice(draggingObject.parent.elements.indexOf(draggingObject.current), 1);
        targetObject.current.elements.push(draggingObject.current);
        success = true;
    } else if (targetObject.parent instanceof RecipeGroupModel) {
        draggingObject.parent.elements.splice(draggingObject.parent.elements.indexOf(draggingObject.current), 1);
        var index = targetObject.parent.elements.indexOf(targetObject.current);
        if (index === -1)
            return;
        targetObject.parent.elements.splice(index, 0, draggingObject.current);
        success = true;
    }
    if (success) {
        UpdateProject();
    }
}


const changeListeners: ProjectChangeListener[] = [];
export let page: PageModel;

// Event system
type ProjectChangeListener = () => void;

export function addProjectChangeListener(listener: ProjectChangeListener) {
    changeListeners.push(listener);
}

export function removeProjectChangeListener(listener: ProjectChangeListener) {
    const index = changeListeners.indexOf(listener);
    if (index > -1) {
        changeListeners.splice(index, 1);
    }
}

function notifyListeners() {
    changeListeners.forEach(listener => listener());
}

export function SetCurrentPage(newPage: PageModel) {
    console.log("SetCurrentPage", newPage);
    page = newPage;
    UpdateProject();
}

export function UpdateProject(visualOnly:boolean = false) {
    if (!visualOnly)
        SolvePage(page);
    notifyListeners();
}

async function GetUrlHashFromJson(json:string):Promise<string>
{
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const compressedStream = new CompressionStream('deflate');
    const writer = compressedStream.writable.getWriter();
    writer.write(data);
    writer.close();
    const compressedBytes = await new Response(compressedStream.readable).arrayBuffer();
    const compressed = String.fromCharCode(...new Uint8Array(compressedBytes));
    const base64 = btoa(compressed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return base64;
}

export async function CopyCurrentPageUrl() {
    const serialized = serializer.Serialize(page);
    const jsonString = JSON.stringify(serialized);
    const hash = await GetUrlHashFromJson(jsonString);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    await navigator.clipboard.writeText(url);
}

export function DownloadCurrentPage() {
    const serialized = serializer.Serialize(page);
    const prettyJson = JSON.stringify(serialized, null, 2);
    const blob = new Blob([prettyJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.name}.gtnh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}