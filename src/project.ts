import { Goods, Item } from "./data/repository";
import { SolvePage } from "./solver.js";

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

export type FlowInformation = {
    input: {[key:string]:number};
    output: {[key:string]:number};
    energy: {[key:number]:number};
}

export enum LinkAlgorithm {
    Match,
    Ignore,
    //AtLeast,
    //AtMost,
}

let emptyFlow:FlowInformation = {input: {}, output: {}, energy: {}};

export abstract class RecipeGroupEntry extends ModelObject{
    flow: FlowInformation = emptyFlow;
}

export class RecipeGroupModel extends RecipeGroupEntry
{
    links: {[key:string]:LinkAlgorithm} = {};
    actualLinks: {[key:string]:LinkAlgorithm} = {};
    elements: RecipeGroupEntry[] = [];
    collapsed: boolean = false;
    name: string = "New Group";

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
    voltageTier: number = 0;

    recipesPerMinute:number = 0;
    overclockFactor:number = 1;
    selectedOreDicts:{[key:string]:Item} = {};

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "type", this.type);
        visitor.VisitData(this, "recipeId", this.recipeId);
        visitor.VisitData(this, "voltageTier", this.voltageTier);
    }

    constructor(source:any = undefined)
    {
        super();
        if (source instanceof Object) {
            if (typeof source.recipeId === "string")
                this.recipeId = source.recipeId;
            if (typeof source.voltageTier === "number")
                this.voltageTier = source.voltageTier;
        }
    }
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

export class PageModel extends ModelObject
{
    name: string = "New Page";
    products: ProductModel[] = [];
    rootGroup: RecipeGroupModel = new RecipeGroupModel();
    private history: string[] = [];
    private readonly MAX_HISTORY = 50;

    Visit(visitor: ModelObjectVisitor): void {
        visitor.VisitData(this, "name", this.name);
        visitor.VisitArray(this, "products", this.products);
        visitor.VisitObject(this, "rootGroup", this.rootGroup);
    }

    constructor(source:any = undefined)
    {
        super();
        if (source instanceof Object) {
            if (typeof source.name === "string")
                this.name = source.name;
            if (source.products instanceof Array)
                this.products = source.products.map((product: any) => new ProductModel(product));
            if (source.rootGroup instanceof Object)
                this.rootGroup = new RecipeGroupModel(source.rootGroup);
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
                const previousPage = new PageModel(JSON.parse(previousState));
                this.name = previousPage.name;
                this.products = previousPage.products;
                this.rootGroup = previousPage.rootGroup;
                SolvePage(this);
                return true;
            } catch (e) {
                console.error("Failed to undo:", e);
            }
        }
        return false;
    }
}

export function DragAndDrop(sourceIid:number, targetIid:number)
{
    if (sourceIid === targetIid)
        return;

    var draggingObject = GetByIid(sourceIid);
    if (draggingObject === null || !(draggingObject.parent instanceof RecipeGroupModel) || !(draggingObject.current instanceof RecipeGroupEntry))
        return;
    var targetObject = GetByIid(targetIid);
    if (targetObject === null || !(targetObject.parent instanceof RecipeGroupModel) || !(targetObject.current instanceof RecipeGroupEntry))
        return;
    if (draggingObject.current instanceof RecipeGroupModel && !draggingObject.current.collapsed)
        return;
    console.log("DragAndDrop", draggingObject, targetObject);
    let success = false;

    if (targetObject.current instanceof RecipeGroupModel && !targetObject.current.collapsed) {
        targetObject.current.elements.push(draggingObject.current);
        success = true;
    } else if (targetObject.parent instanceof RecipeGroupModel) {
        var index = targetObject.parent.elements.indexOf(targetObject.current);
        if (index === -1)
            return;
        targetObject.parent.elements.splice(index, 0, draggingObject.current);
        success = true;
    }
    if (success) {
        draggingObject.parent.elements.splice(draggingObject.parent.elements.indexOf(draggingObject.current), 1);
        UpdateProject();
    }
}

const MAX_HISTORY = 50;

export var pageNames = Object.keys(localStorage).filter((key) => key.startsWith("page_")).sort();
let currentPageName = pageNames.length > 0 ? pageNames[0] : "page_0";
export var page: PageModel = loadPage(currentPageName)

// Undo history
let history: string[] = [];

// Event system
type ProjectChangeListener = () => void;
const changeListeners: ProjectChangeListener[] = [];

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

function loadPage(key:string):PageModel
{
    currentPageName = key;
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            let page = JSON.parse(stored);
            let pageModel = new PageModel(page);
            SolvePage(pageModel);
            console.log("Loaded page", stored);
            return pageModel;
        } catch (e) {
            console.error("Failed to load project:", e);
        }
    }
    return new PageModel();
}

function savePage() {
    try {
        const json = JSON.stringify(serializer.Serialize(page));
        localStorage.setItem(currentPageName, json);
        console.log("Saved page", json);
        page.addToHistory(json);
    } catch (e) {
        console.error("Failed to save project:", e);
    }
}

export function UpdateProject(visualOnly:boolean = false) {
    if (!visualOnly) {
        savePage();
        SolvePage(page);
    }
    notifyListeners();
}

export function Undo() {
    if (page.undo()) {
        notifyListeners();
    }
}

// Add keyboard shortcut for undo
document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        Undo();
    }
});

async function updateUrlFragment(json:string) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(json);
        const compressedStream = new CompressionStream('deflate');
        const writer = compressedStream.writable.getWriter();
        writer.write(data);
        writer.close();
        const compressedBytes = await new Response(compressedStream.readable).arrayBuffer();
        const compressed = String.fromCharCode(...new Uint8Array(compressedBytes));
        const base64 = btoa(compressed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        window.location.hash = base64;
    } catch (e) {
        console.error("Failed to update URL fragment:", e);
    }
}

async function loadFromUrlFragment(): Promise<PageModel | null> {
    try {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        if (!hash) return null;

        // Convert from URL-safe base64 back to normal base64
        const base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
        // Decode base64
        const compressed = atob(base64);
        // Decompress
        const data = new Uint8Array(compressed.split('').map(c => c.charCodeAt(0)));
        const decompressedStream = new DecompressionStream('deflate');
        const writer = decompressedStream.writable.getWriter();
        writer.write(data);
        writer.close();
        const decompressed = await new Response(decompressedStream.readable).arrayBuffer();
        const json = new TextDecoder().decode(decompressed);
        console.log("Loaded page", json);
        return new PageModel(JSON.parse(json));
    } catch (e) {
        console.error("Failed to load from URL fragment:", e);
        return null;
    }
}

// Update the URL fragment handling to be async
window.addEventListener('hashchange', async () => {
    const newPage = await loadFromUrlFragment();
    if (newPage) {
        page = newPage;
        notifyListeners();
    }
});

// Initialize page from URL fragment if available
(async () => {
    const pageFromUrl = await loadFromUrlFragment();
    if (pageFromUrl) {
        page = pageFromUrl;
        page.addToHistory(JSON.stringify(serializer.Serialize(page))); // Initialize history with the loaded state
    }
})();