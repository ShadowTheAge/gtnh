import { SearchQuery } from "./searchQuery.js";

const charCodeItem = "i".charCodeAt(0);
const charCodeFluid = "f".charCodeAt(0);
const charCodeRecipe = "r".charCodeAt(0);

const DATA_VERSION = 4;
export class Repository
{
    static current:Repository;

    elements: Int32Array;
    bytes: Uint8Array;
    textReader: TextDecoder;
    objects: {[index:number]: (MemMappedObject | Int32Array | string)} = {}
    items:Int32Array;
    fluids:Int32Array;
    recipeTypes:Int32Array;
    recipes:Int32Array;
    oreDicts:Int32Array;
    service:Int32Array;

    objectPositionMap: {[id:string]:number} = {};

    constructor(data: ArrayBuffer)
    {
        this.bytes = new Uint8Array(data);
        this.elements = new Int32Array(data);
        this.textReader = new TextDecoder();
        let dataVersion = this.elements[0];
        if (dataVersion != DATA_VERSION)
            throw new Error(`Unsupported data version: ${dataVersion} (Required: ${DATA_VERSION}). This may be caused by the browser cache. Please try reloading using F5 or Ctrl+F5.`);

        this.items = this.GetSlice(this.elements[1]);
        this.fluids = this.GetSlice(this.elements[2]);
        this.oreDicts = this.GetSlice(this.elements[3]);
        this.recipeTypes = this.GetSlice(this.elements[4]);
        this.recipes = this.GetSlice(this.elements[5]);
        this.service = this.GetSlice(this.elements[6]);
        this.FillObjectPositionMap(this.items);
        this.FillObjectPositionMap(this.fluids);
        this.FillObjectPositionMap(this.oreDicts);
        this.FillObjectPositionMap(this.recipes);

        let remap = this.ReadSlice(this.elements[7]);
        this.FillRecipesRemap(remap);
    }

    static load(data: ArrayBuffer): Repository {
        const repository = new Repository(data);
        Repository.current = repository;
        return repository;
    }

    private FillRecipesRemap(remap:Int32Array) {
        for (let i = 0; i < remap.length; i++) {
            let remapPos = remap[i];
            let id = this.GetString(this.elements[remapPos]);
            this.objectPositionMap[id] = this.elements[remapPos+1];
        }
    }

    private FillObjectPositionMap(elements:Int32Array) {
        for (var i=0; i<elements.length; i++) {
            var id = this.GetString(this.elements[elements[i]+4]);
            this.objectPositionMap[id] = elements[i];
        }
    }

    public GetById<T extends SearchableObject>(id:string):T | null
    {
        if (!id)
            return null;
        var idCode = id.charCodeAt(0);
        var type:IMemMappedObjectPrototype<SearchableObject> = idCode == charCodeItem ? Item : idCode == charCodeFluid ? Fluid : idCode == charCodeRecipe ? Recipe : OreDict;
        if (!this.objectPositionMap[id])
            return null;
        return this.GetObject(this.objectPositionMap[id], type) as T;
    }

    public ObjectMatchQueryBits(query:SearchQuery, pointer:number):boolean
    {
        var arr = query.indexBits;
        for (var i=0; i<4; i++) {
            if ((this.elements[pointer+i] & arr[i]) !== arr[i])
                return false;
        }
        return true;
    }

    GetString(pointer:number):string
    {
        if (pointer == -1)
            return null as unknown as string;
        return (this.objects[pointer] as string) ?? (this.objects[pointer] = this.ReadString(pointer))
    }

    private ReadString(pointer:number):string
    {
        var length = this.elements[pointer];
        var begin = pointer * 4 + 4;
        return this.textReader.decode(this.bytes.subarray(begin, begin+length));
    }

    GetSlice(pointer:number):Int32Array
    {
        return (this.objects[pointer] as Int32Array) ?? (this.objects[pointer] = this.ReadSlice(pointer))   
    }

    private ReadSlice(pointer:number):Int32Array
    {
        var length = this.elements[pointer];
        return this.elements.subarray(pointer+1, pointer+1+length);
    }

    GetObject<T extends MemMappedObject>(pointer:number, prototype: IMemMappedObjectPrototype<T>):T
    {
        if (pointer === -1)
            return null as unknown as T;
        return (this.objects[pointer] as T) ?? (this.objects[pointer] = this.ReadObject<T>(pointer, prototype))
    }

    private ReadObject<T extends MemMappedObject>(pointer:number, prototype:IMemMappedObjectPrototype<T>):T
    {
        return new prototype(this, pointer);
    }

    GetObjectIfMatchingSearch<T extends SearchableObject>(query:SearchQuery | null, pointer:number, prototype:IMemMappedObjectPrototype<T>):T | null
    {
        if (query === null)
            return this.GetObject(pointer, prototype);
        if (!this.ObjectMatchQueryBits(query, pointer))
            return null;
        var inst = this.GetObject(pointer, prototype);
        if (query.original.length === 1)
            return inst;
        return inst.MatchSearchText(query) ? inst : null;
    }

    IsObjectMatchingSearch(obj:SearchableObject, query:SearchQuery | null):boolean
    {
        if (query === null)
            return true;
        if (!this.ObjectMatchQueryBits(query, obj.objectOffset))
            return false;
        if (query.original.length === 1)
            return true;
        return obj.MatchSearchText(query);
    }
}

export interface IMemMappedObjectPrototype<T extends MemMappedObject>
{
    new(repository:Repository, offset:number):T
}

class MemMappedObject
{
    repository:Repository;
    objectOffset:number

    constructor(repository:Repository, offset:number)
    {
        this.repository = repository;
        this.objectOffset = offset;
    }

    protected GetInt(offset:number)
    {
        return this.repository.elements[offset + this.objectOffset];
    }

    protected GetString(offset:number)
    {
        return this.repository.GetString(this.repository.elements[offset + this.objectOffset]);
    }

    protected GetSlice(offset:number)
    {
        return this.repository.GetSlice(this.repository.elements[offset + this.objectOffset]);
    }

    protected GetObject<T extends MemMappedObject>(offset:number, prototype:IMemMappedObjectPrototype<T>)
    {
        return this.repository.GetObject<T>(this.repository.elements[offset + this.objectOffset], prototype);
    }
}

abstract class SearchableObject extends MemMappedObject
{
    id:string = this.GetString(4);
    // Elements 0-3 are reserved for 128-bit index
    abstract MatchSearchText(query:SearchQuery):boolean;
}

export abstract class RecipeObject extends SearchableObject{}

export abstract class Goods extends RecipeObject
{
    get name(): string {return this.GetString(5);}
    get mod(): string {return this.GetString(6);}
    get internalName(): string {return this.GetString(7);}
    get iconId(): number {return this.GetInt(9);}
    get tooltip(): string | null {return this.GetString(10);}
    get unlocalizedName(): string {return this.GetString(11);}
    get nbt(): string | null {return this.GetString(12);}
    get production(): Int32Array {return this.GetSlice(13);}
    get consumption(): Int32Array {return this.GetSlice(14);}

    abstract get tooltipDebugInfo():string;

    MatchSearchText(query: SearchQuery): boolean {
        if (query.mod !== null && !this.mod.toLowerCase().includes(query.mod)) {
            return false;
        }
        return query.Match(this.name) || query.Match(this.tooltip);
    }
}

export class Item extends Goods
{
    get stackSize():number {return this.GetInt(15);}
    get damage():number {return this.GetInt(16);}
    get container():FluidContainer | null {return this.GetObject(17, FluidContainer);}
    
    get tooltipDebugInfo(): string {
        var baseInfo = `${this.mod}:${this.internalName}:${this.damage}`;
        var nbt = this.nbt;
        if (nbt != null)
            baseInfo += "\n" + nbt;
        return baseInfo;
    }
}

export class FluidContainer extends MemMappedObject
{
    get fluid():Fluid {return this.GetObject(0, Fluid);}
    get amount():number {return this.GetInt(1);}
    get empty():Item {return this.GetObject(2, Item);}
}

export class Fluid extends Goods
{
    get isGas():boolean {return this.GetInt(15) === 1;}
    get containers():Int32Array {return this.GetSlice(16);}
    get tooltipDebugInfo(): string {
        return `${this.mod}:${this.internalName}`;
    }
}

export class OreDict extends RecipeObject
{
    items:Item[];

    constructor(repository:Repository, offset:number) {
        super(repository, offset);
        var slice = this.GetSlice(5);
        this.items = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            this.items[i] = repository.GetObject(slice[i], Item);
        }
    }

    MatchSearchText(query: SearchQuery): boolean
    {
        var items = this.items;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (this.repository.ObjectMatchQueryBits(query, item.objectOffset) && item.MatchSearchText(query))
                return true;
        }
        return false;
    }
}

export class RecipeType extends MemMappedObject
{
    singleblocks:Item[] = [];
    multiblocks:Item[] = [];
    defaultCrafter:Item;

    constructor(repository:Repository, offset:number) {
        super(repository, offset);
        var singleblocks = this.GetSlice(5);
        var multiblocks = this.GetSlice(3);
        this.singleblocks = new Array(singleblocks.length);
        this.multiblocks = new Array(multiblocks.length);
        this.defaultCrafter = this.GetObject(6, Item);
        for (var i = 0; i < singleblocks.length; i++) {
            this.singleblocks[i] = repository.GetObject(singleblocks[i], Item);
        }
        for (var i = 0; i < multiblocks.length; i++) {
            this.multiblocks[i] = repository.GetObject(multiblocks[i], Item);
        }
    }

    get name():string {return this.GetString(0);}
    get category():string {return this.GetString(1);}
    get dimensions():Int32Array {return this.GetSlice(2);}
    get shapeless():boolean {return this.GetInt(4) === 1;}
}

class GtRecipe extends MemMappedObject
{
    get voltage():number {return this.GetInt(0);}
    get durationTicks():number {return this.GetInt(1);}
    get durationSeconds():number {return this.GetInt(1) / 20;}
    get durationMinutes():number {return this.GetInt(1) / (20 * 60);}
    get amperage():number {return this.GetInt(2);}
    get voltageTier():number {return this.GetInt(3);}
    get cleanRoom():boolean {return (this.GetInt(4) & 1) === 1;}
    get lowGravity():boolean {return (this.GetInt(4) & 2) === 2;}
    get additionalInfo():string {return this.GetString(5);}
    get circuitConflicts():number {return this.GetInt(6);}
    get specialValue():number {return this.GetInt(7);}
}

export enum RecipeIoType
{
    ItemInput = 0,
    OreDictInput,
    FluidInput,
    ItemOutput,
    FluidOutput
}

export type RecipeInOut =
{
    type: RecipeIoType;
    goodsPtr: number;
    goods: RecipeObject;
    slot: number;
    amount: number;
    probability: number;
}

const RecipeIoTypePrototypes:IMemMappedObjectPrototype<RecipeObject>[] = [Item, OreDict, Fluid, Item, Fluid];

export class Recipe extends SearchableObject
{
    readonly recipeType:RecipeType = this.GetObject(6, RecipeType);
    get gtRecipe():GtRecipe {return this.GetObject(7, GtRecipe)}
    private computedIo:RecipeInOut[] | undefined;

    get items():RecipeInOut[] { return this.computedIo ?? (this.computedIo = this.ComputeItems());}

    private ComputeItems():RecipeInOut[]
    {
        var slice = this.GetSlice(5);
        var elements = slice.length / 5;
        var result:RecipeInOut[] = new Array(elements);
        var index = 0;
        for(var i=0; i<elements; i++) {
            var type:RecipeIoType = slice[index++];
            var ptr = slice[index++];
            result[i] = {
                type:type, 
                goodsPtr: ptr,
                goods:this.repository.GetObject<RecipeObject>(ptr, RecipeIoTypePrototypes[type]),
                slot: slice[index++],
                amount: slice[index++],
                probability: slice[index++] / 100,
            }
        }
        return result;
    }

    MatchSearchText(query: SearchQuery): boolean 
    {
        var slice = this.GetSlice(5);
        var count = slice.length / 5;
        for (var i=0; i<count; i++) 
        {
            var pointer = slice[i*5+1];
            if (!this.repository.ObjectMatchQueryBits(query, pointer))
                continue;
            var objType = RecipeIoTypePrototypes[slice[i*5]];
            var obj = this.repository.GetObject<RecipeObject>(pointer, objType);
            if (obj.MatchSearchText(query))
                return true;
        }
        return false;
    }
}