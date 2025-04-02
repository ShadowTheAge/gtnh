import { GetScrollbarWidth, voltageTier } from "../utils.js";
import { Goods, Fluid, Item, Repository, IMemMappedObjectPrototype, Recipe, RecipeType, RecipeIoType, RecipeInOut, RecipeObject, OreDict } from "../data/repository.js";
import { IconBox } from "./itemIcon.js";
import { SearchQuery } from "../data/searchQuery.js";
import { ShowTooltip, HideTooltip } from "./tooltip.js";

const repository = Repository.current;
const nei = document.getElementById("nei")!;
const neiScrollBox = nei.querySelector("#nei-scroll") as HTMLElement;
const neiContent = nei.querySelector("#nei-content") as HTMLElement;
const searchBox = nei.querySelector("#nei-search") as HTMLInputElement;
const neiTabs = nei.querySelector("#nei-tabs") as HTMLElement;
const elementSize = 36;

let currentGoods: RecipeObject | null = null;

document.addEventListener("keydown", (event) => {
    if (nei.classList.contains("hidden"))
        return;
    // Handle Escape key
    if (event.key === "Escape") {
        if (searchBox.value == "") {
            HideNei();
        } else {
            searchBox.value = "";
            SearchChanged();
        }
        return;
    }

    // Only handle printable characters
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && searchBox.value == "") {
        if (document.activeElement !== searchBox) {
            searchBox.focus();
        }
    }
});

searchBox.addEventListener("input", SearchChanged);
neiScrollBox.addEventListener("scroll", UpdateVisibleItems);

let unitWidth = 0, unitHeight = 0;
let scrollWidth = GetScrollbarWidth();
window.addEventListener("resize", Resize);

type NeiFiller = (grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap) => void;

class ItemAllocator implements NeiRowAllocator<Goods>
{
    CalculateWidth(): number { return 1; }
    CalculateHeight(obj: Goods): number { return 1; }
    BuildRowDom(elements:Goods[], elementWidth:number, elementHeight:number, rowY:number):string
    {
        var dom:string[] = [];
        const isSelectingGoods = showNeiCallback?.onSelectGoods != null;
        const selectGoodsAction = isSelectingGoods ? ' data-action="select"' : "";
        dom.push(`<div class="nei-items-row icon-grid" style="--grid-width:${elements.length}; top:${elementSize*rowY}px">`);
        for (var i=0; i<elements.length; i++) {
            var elem = elements[i];
            dom.push(`<item-icon class="item-icon-grid" style="--grid-position:${i}" data-id="${elem.id}"${selectGoodsAction}></item-icon>`);
        }
        dom.push(`<\div>`);
        return dom.join("");
    }
}

class NeiRecipeTypeInfo extends Array implements NeiRowAllocator<Recipe>
{
    type:RecipeType;
    dimensions:Int32Array;

    constructor(type:RecipeType)
    {
        super();
        this.type = type;
        this.dimensions = type.dimensions;
    }

    CalculateWidth():number
    {
        var dims = this.dimensions;
        return Math.max(dims[0], dims[2]) + Math.max(dims[4], dims[6]) + 3;
    }

    CalculateHeight(recipe:Recipe):number
    {
        var dims = this.dimensions;
        var h = Math.max(dims[1] + dims[3], dims[5] + dims[7], 2) + 1;
        var gtRecipe = recipe.gtRecipe;
        if (gtRecipe != null)
        {
            h++;
            if (gtRecipe.additionalInfo !== null)
                h++;
        }
        return h;
    }

    BuildRecipeItemGrid(dom:string[], items:RecipeInOut[], index:number, type:RecipeIoType, dimensionOffset:number):number
    {
        var dimX = this.dimensions[dimensionOffset];
        if (dimX == 0)
            return index;
        var dimY = this.dimensions[dimensionOffset + 1];
        var count = dimX * dimY;
        dom.push(`<div class="icon-grid" style="--grid-width: ${dimX}; --grid-height: ${dimY}">`);
        for (;index<items.length;index++) {
            var item = items[index];
            if (item.type > type)
                break;
            if (item.slot >= count)
                continue;
            var goods = item.goods;
            var iconAttrs = `class="item-icon-grid" style="--grid-position:${item.slot}" data-id="${goods.id}"`;
            var amountText = item.amount == 0 ? "NC" : 
                           item.amount <= 100000 ? item.amount :
                           item.amount <= 10000000 ? Math.round(item.amount/1000) + "K" :
                           Math.round(item.amount/1000000) + "M";
            
            var isFluid = goods instanceof Fluid;
            var isGoods = goods instanceof Goods;
            if (isFluid || item.amount != 1)
                iconAttrs += ` data-amount="${amountText}"`;
            dom.push(`<item-icon ${iconAttrs}>`);
            if (item.probability < 1 && (type == RecipeIoType.ItemOutput || type == RecipeIoType.FluidOutput))
                dom.push(`<span class="probability">${Math.round(item.probability*100)}%</span>`);
            dom.push(`</item-icon>`);
        }
        dom.push(`</div>`);
        return index;
    }

    BuildRecipeIoDom(dom:string[], items:RecipeInOut[], index:number, item:RecipeIoType, fluid:RecipeIoType, dimensionOffset:number):number
    {
        dom.push(`<div class = "nei-recipe-items">`);
        index = this.BuildRecipeItemGrid(dom, items, index, item, dimensionOffset);
        index = this.BuildRecipeItemGrid(dom, items, index, fluid, dimensionOffset+2);
        dom.push(`</div>`);
        return index;
    }

    BuildRowDom(elements:Recipe[], elementWidth:number, elementHeight:number, rowY:number):string
    {
        let dom:string[] = [];
        const canSelectRecipe = showNeiCallback?.onSelectRecipe != null;
        
        for (let i=0; i<elements.length; i++) {
            let recipe = elements[i];
            let recipeItems = recipe.items;
            dom.push(`<div class="nei-recipe-box" style="left:${Math.round(i * elementWidth * elementSize)}px; top:${rowY*elementSize}px; width:${Math.round(elementWidth*elementSize)}px; height:${elementHeight*elementSize}px">`);
            dom.push(`<div class="nei-recipe-io">`);
            let index = this.BuildRecipeIoDom(dom, recipeItems, 0, RecipeIoType.OreDictInput, RecipeIoType.FluidInput, 0);
            dom.push(`<div class="arrow-container">`);
            dom.push(`<div class="arrow"></div>`);
            if (canSelectRecipe) {
                dom.push(`<button class="select-recipe-btn" data-recipe="${recipe.objectOffset}">+</button>`);
            }
            dom.push(`</div>`);
            this.BuildRecipeIoDom(dom, recipeItems, index, RecipeIoType.ItemOutput, RecipeIoType.FluidOutput, 4);
            dom.push(`</div>`);
            if (recipe.gtRecipe != null) {
                dom.push(`<span>${voltageTier[recipe.gtRecipe.voltageTier].name} • ${recipe.gtRecipe.durationSeconds}s`);
                if (recipe.gtRecipe.cleanRoom)
                    dom.push(` • Cleanroom`);
                if (recipe.gtRecipe.lowGravity)
                    dom.push(` • Low gravity`);
                if (recipe.gtRecipe.amperage != 1)
                    dom.push(` • ${recipe.gtRecipe.amperage}A`);
                dom.push(`</span><span class="text-small">${recipe.gtRecipe.voltage}v • ${recipe.gtRecipe.voltage * recipe.gtRecipe.amperage * recipe.gtRecipe.durationTicks}eu</span>`);
                if (recipe.gtRecipe.additionalInfo != null) {
                    dom.push(`<span class="text-small">`);
                    dom.push(recipe.gtRecipe.additionalInfo);
                    dom.push(`</span>`);
                }
            }
            dom.push(`</div>`);
        }
        return dom.join("");
    }
}

let itemAllocator = new ItemAllocator();
var FillNeiAllItems:NeiFiller = function(grid:NeiGrid, search : SearchQuery | null)
{
    var allocator = grid.BeginAllocation(itemAllocator);
    FillNeiItemsWith(allocator, search, Repository.current.fluids, Fluid);
    FillNeiItemsWith(allocator, search, Repository.current.items, Item);
}

function FillNeiItemsWith<T extends Goods>(grid:NeiGridAllocator<Goods>, search: SearchQuery | null, arr:Int32Array, proto:IMemMappedObjectPrototype<T>):void
{
    var len = arr.length;
    for (var i=0; i<len; i++) {
        var element = repository.GetObjectIfMatchingSearch(search, arr[i], proto);
        if (element !== null)
            grid.Add(element);
    }
}

var FillNeiAllRecipes:NeiFiller = function(grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap)
{
    for (const recipeType of allRecipeTypes) {
        var list = recipes[recipeType.name];
        if (list.length >= 0) {
            let allocator = grid.BeginAllocation(list)
            for (let i=0; i<list.length; i++) {
                if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                    allocator.Add(list[i]);
            }
        }
    }
}

function FillNeiSpecificRecipes(recipeType:RecipeType) : NeiFiller
{
    return function(grid:NeiGrid, search : SearchQuery | null, recipes:NeiRecipeMap)
    {
        var list = recipes[recipeType.name];
        let allocator = grid.BeginAllocation(list)
        for (let i=0; i<list.length; i++)
            if (search == null || repository.IsObjectMatchingSearch(list[i], search))
                allocator.Add(list[i]);
    }
}

function SearchChanged()
{
    search = searchBox.value === "" ? null : new SearchQuery(searchBox.value);
    if (search !== null && search.words.length === 0)
        search = null;
    RefreshNeiContents();
}

type NeiRecipeMap = {[type:string]: NeiRecipeTypeInfo};
const mapRecipeTypeToRecipeList:NeiRecipeMap = {};
let allRecipeTypes:RecipeType[];
let filler:NeiFiller = FillNeiAllItems;
let search:SearchQuery | null = null;

{
    let allRecipeTypePointers = repository.recipeTypes;
    allRecipeTypes = new Array(allRecipeTypePointers.length);
    for (var i=0; i<allRecipeTypePointers.length; i++)
    {
        var recipeType = repository.GetObject(allRecipeTypePointers[i], RecipeType);
        mapRecipeTypeToRecipeList[recipeType.name] = new NeiRecipeTypeInfo(recipeType);
        allRecipeTypes[i] = recipeType;
    }
}

export enum ShowNeiMode
{
    Production, Consumption
}

export enum ShowNeiContext
{
    None, Click, SelectRecipe, SelectGoods
}

export type ShowNeiCallback = {
    onSelectGoods?(goods:Goods, mode:ShowNeiMode):void;
    onSelectRecipe?(recipe:Recipe):void;
}

let showNeiCallback:ShowNeiCallback | null = null;

export function HideNei()
{
    nei.classList.add("hidden");
    showNeiCallback = null;
    currentGoods = null;
}

export function ShowNei(goods:RecipeObject | null, mode:ShowNeiMode, callback:ShowNeiCallback | null = null)
{
    console.log("ShowNei", goods, mode, callback);
    if (showNeiCallback != null && goods instanceof Goods && showNeiCallback.onSelectGoods) {
        console.log("ShowNei result (Goods): ", goods.id, goods);
        showNeiCallback.onSelectGoods(goods, mode);
        HideNei();
        return;
    }
    if (callback != null) {
        showNeiCallback = callback;
    }
    nei.classList.remove("hidden");
    currentGoods = goods;
    var pointerList:number[] = [];
    if (goods instanceof OreDict) {
        var allPointers:Set<number> = new Set();
        for (var i=0; i<goods.items.length; i++) {
            var pointer = goods.items[i];
            var item = repository.GetObject(pointer, Item);
            var subList = mode == ShowNeiMode.Production ? item.production : item.consumption;
            for (var j=0; j<subList.length; j++) {
                allPointers.add(subList[j]);
            }
        }
        pointerList = Array.from(allPointers);
    } else if (goods instanceof Goods) {
        pointerList = Array.from(mode == ShowNeiMode.Production ? goods.production : goods.consumption);
    } else pointerList = [];
    
    // Clear all recipe lists first
    for (const recipeType of allRecipeTypes) {
        mapRecipeTypeToRecipeList[recipeType.name].length = 0;
    }
    
    // Fill recipe lists
    for (var i=0; i<pointerList.length; i++) {
        var recipe = repository.GetObject(pointerList[i], Recipe);
        var recipeType = recipe.recipeType;
        var list = mapRecipeTypeToRecipeList[recipeType.name];
        list.push(recipe);
    }
    
    search = null;
    searchBox.value = "";

    // Update tab visibility
    updateTabVisibility();

    // Update filler and switch to appropriate tab
    filler = goods === null ? FillNeiAllItems : FillNeiAllRecipes;
    const newTabIndex = goods === null ? 0 : 1;
    switchTab(newTabIndex);
    
    Resize();
}

type NeiGridContents = Recipe | Goods;

interface NeiRowAllocator<T extends NeiGridContents>
{
    CalculateWidth():number;
    CalculateHeight(obj:T):number;
    BuildRowDom(elements:T[], elementWidth:number, elementHeight:number, rowY:number):string;
}

class NeiGridRow
{
    y:number = 0;
    height:number = 1;
    elementWidth:number = 1;
    elements:NeiGridContents[] = [];
    allocator:NeiRowAllocator<any> | null = null;

    Clear(y:number, allocator:NeiRowAllocator<any> | null, elementWidth:number)
    {
        this.allocator = allocator;
        this.y = y;
        this.height = 1;
        this.elementWidth = elementWidth;
        this.elements.length = 0;
    }

    Add(element:NeiGridContents, height:number)
    {
        this.elements.push(element);
        if (height > this.height)
            this.height = height;
    }
}

interface NeiGridAllocator<T extends NeiGridContents>
{
    Add(element:T):void;
}

class NeiGrid implements NeiGridAllocator<any>
{
    rows:NeiGridRow[] = [];
    rowCount:number = 0;
    width:number = 1;
    height:number = 0;
    allocator:NeiRowAllocator<NeiGridContents> | null = null;
    currentRow:NeiGridRow | null = null;
    elementWidth:number = 1;
    elementsPerRow:number = 1;

    Clear(width:number)
    {
        this.rowCount = 0;
        this.width = width;
        this.height = 0;
        this.currentRow = null;
        this.allocator = null;
        this.elementWidth = 1;
        this.elementsPerRow = 1;
    }

    BeginAllocation<T extends NeiGridContents>(allocator: NeiRowAllocator<T>):NeiGridAllocator<T>
    {
        this.FinishRow();
        this.allocator = allocator;
        this.elementWidth = allocator.CalculateWidth();
        this.elementsPerRow = Math.max(1, Math.trunc(this.width/this.elementWidth));
        //this.elementWidth = this.width / this.elementsPerRow;
        return this;
    }

    FinishRow()
    {
        if (this.currentRow === null)
            return;
        this.height = this.currentRow.y + this.currentRow.height;
        this.currentRow = null;
    }

    private NextRow():NeiGridRow
    {
        this.FinishRow();
        var row = this.rows[this.rowCount];
        if (row === undefined)
            this.rows[this.rowCount] = row = new NeiGridRow();
        row.Clear(this.height, this.allocator, this.elementWidth);
        this.currentRow = row;
        this.rowCount++;
        return row;
    }

    Add<T extends NeiGridContents>(element:T)
    {
        var row = this.currentRow;
        if (row === null || row.elements.length >= this.elementsPerRow)
            row = this.NextRow();
        var height = this.allocator?.CalculateHeight(element) ?? 1;
        if (row.height < height)
            row.height = height;
        row.elements.push(element);
    }
}

function Resize()
{
    var newUnitWidth = Math.round((window.innerWidth - 120 - scrollWidth) / elementSize);
    var newUnitHeight = Math.round((window.innerHeight - 160) / elementSize);
    var widthRemainder = window.innerWidth - newUnitWidth;
    if (newUnitWidth !== unitWidth || newUnitHeight !== unitHeight)
    {
        unitWidth = newUnitWidth;
        unitHeight = newUnitHeight;
        var windowWidth = unitWidth * elementSize + scrollWidth;
        var windowHeight = unitHeight * elementSize;
        if ((window.innerWidth - windowWidth) % 2 == 1)
            windowWidth++;
        if ((window.innerWidth - windowHeight) % 2 == 1)
            windowHeight++;
        neiScrollBox.style.width = `${windowWidth}px`;
        neiScrollBox.style.height = `${windowHeight}px`;
    }
    RefreshNeiContents();
}

let grid = new NeiGrid();
let maxVisibleRow = 0;
function RefreshNeiContents()
{
    grid.Clear(unitWidth);
    filler(grid, search, mapRecipeTypeToRecipeList);
    grid.FinishRow();
    neiContent.style.minHeight = `${grid.height*elementSize}px`
    maxVisibleRow = 0;
    neiContent.innerHTML = "";
    
    UpdateVisibleItems();
}

function UpdateVisibleItems()
{
    var top = Math.floor(neiScrollBox.scrollTop/elementSize);
    var bottom = top + unitHeight + 1;
    for (var i=maxVisibleRow; i<grid.rowCount; i++) {
        var row = grid.rows[i];
        if (row.y >= bottom)
            return;
        FillDomWithGridRow(row);
        maxVisibleRow = i+1;
    }
}

function FillDomWithGridRow(row: NeiGridRow)
{
    var allocator = row.allocator;
    if (allocator == null)
        return;
    var dom = allocator.BuildRowDom(row.elements, row.elementWidth, row.height, row.y);
    neiContent.insertAdjacentHTML("beforeend", dom);
}

// Tab management
interface NeiTab {
    name: string;
    filler: NeiFiller;
    iconId: number;
    isVisible(): boolean;
}

const tabs: NeiTab[] = [
    { 
        name: "All Items", 
        filler: FillNeiAllItems, 
        iconId: repository.GetObject(repository.service[0], Item).iconId,
        isVisible: () => true // Always visible
    },
    { 
        name: "All Recipes", 
        filler: FillNeiAllRecipes, 
        iconId: repository.GetObject(repository.service[1], Item).iconId,
        isVisible: () => currentGoods !== null // Visible only when viewing recipes
    }
];

// Add tabs for each recipe type
allRecipeTypes.forEach(recipeType => {
    tabs.push({
        name: recipeType.name,
        filler: FillNeiSpecificRecipes(recipeType),
        iconId: repository.GetObject(recipeType.craftItems[0], Item).iconId,
        isVisible: () => mapRecipeTypeToRecipeList[recipeType.name].length > 0
    });
});

let activeTabIndex = 0;

function createTabs() {
    neiTabs.innerHTML = '';
    tabs.forEach((tab, index) => {
        const tabElement = document.createElement('div');
        tabElement.className = 'panel-tab';
        tabElement.innerHTML = `<icon class="icon" style="--icon-id:${tab.iconId}"></icon>`;
        tabElement.addEventListener('click', () => switchTab(index));
        tabElement.addEventListener('mouseenter', () => ShowTooltip(tabElement, { header: tab.name }));
        neiTabs.appendChild(tabElement);
    });
    // Set initial active tab
    neiTabs.children[0]?.classList.add('active');
}

function updateTabVisibility() {
    tabs.forEach((tab, index) => {
        const tabElement = neiTabs.children[index] as HTMLElement;
        if (tabElement) {
            tabElement.style.display = tab.isVisible() ? '' : 'none';
        }
    });
}

function switchTab(index: number) {
    if (index === activeTabIndex) return;
    
    // Update active state
    neiTabs.children[activeTabIndex]?.classList.remove('active');
    neiTabs.children[index]?.classList.add('active');
    activeTabIndex = index;
    
    // Update filler and refresh content
    filler = tabs[index].filler;
    RefreshNeiContents();
}

// Initialize tabs
createTabs();

// Add global click handler for recipe selection
neiContent.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const selectButton = target.closest(".select-recipe-btn");
    if (selectButton && showNeiCallback?.onSelectRecipe) {
        const recipeOffset = parseInt(selectButton.getAttribute("data-recipe") || "0");
        const recipe = repository.GetObject(recipeOffset, Recipe);
        console.log("ShowNei result (Recipe): ", recipe.id, recipe);
        showNeiCallback.onSelectRecipe(recipe);
        HideNei();
    }
});

