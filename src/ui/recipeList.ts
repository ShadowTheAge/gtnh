import { ShowNei, ShowNeiMode, ShowNeiCallback } from "./nei.js";
import { Goods, Repository, Item, Fluid, Recipe } from "../data/repository.js";
import { UpdateProject, addProjectChangeListener, removeProjectChangeListener, GetByIid, RecipeModel, RecipeGroupModel, ProductModel, ModelObject, PageModel, DragAndDrop, page, FlowInformation, LinkAlgorithm } from "../project.js";
import { voltageTier, GtVoltageTier } from "../utils.js";
import { ShowTooltip } from "./tooltip.js";
import { IconBox } from "./itemIcon.js";

const linkAlgorithmNames: { [key in LinkAlgorithm]: string } = {
    [LinkAlgorithm.Match]: "",
    [LinkAlgorithm.Ignore]: "Ignore",
};

const tooltips: { [key: string]: {header: string, text: string} } = {
    "link": {header: "Links", text: "When some item has both production and consumption (or it is a required product), a link is created.\n\n\
    By default, the link will attempt to match production and consumption exactly.\n\n\
    If this is not desired, you can choose to ignore the link by clicking on it."}
};

interface Product {
    goods: Goods;
    amount: number;
}

type ActionHandler = (obj: ModelObject, event: Event, parent: ModelObject) => void;

export class RecipeList {
    private productItemsContainer: HTMLElement;
    private recipeItemsContainer: HTMLElement;
    private actionHandlers: Map<string, ActionHandler> = new Map();

    constructor() {
        this.productItemsContainer = document.querySelector(".product-items")!;
        this.recipeItemsContainer = document.querySelector(".recipe-list")!;
        this.setupActionHandlers();
        this.setupGlobalEventListeners();
        this.setupDragAndDrop();
        this.updateProductList();
        this.updateRecipeList();
        
        // Listen for project changes
        addProjectChangeListener(() => {
            this.updateProductList();
            this.updateRecipeList();
        });
    }

    private setupActionHandlers() {
        this.actionHandlers.set("delete_product", (obj, event, parent) => {
            if (obj instanceof ProductModel && parent instanceof PageModel && event.type === "click") {
                const index = parent.products.findIndex((p: ProductModel) => p.iid === obj.iid);
                if (index !== -1) {
                    parent.products.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("item_icon_click", (obj, event, parent) => {
            if (event instanceof MouseEvent && (event.type === "click" || event.type === "contextmenu") && event.target instanceof IconBox && obj instanceof RecipeGroupModel) {
                const goods = event.target.obj;

                const mode = event.type === "click" ? ShowNeiMode.Production : ShowNeiMode.Consumption;
                if (event.type === "contextmenu")
                    event.preventDefault();
                const callback: ShowNeiCallback = {
                    onSelectRecipe: (recipe: Recipe) => {
                        this.addRecipe(recipe, obj);
                    }
                };

                ShowNei(goods, mode, callback);
            }
        });

        this.actionHandlers.set("toggle_link_ignore", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && event.type === "click" && event.target instanceof IconBox) {
                const goods = event.target.obj;
                if (goods instanceof Goods) {
                    const linkIgnore = obj.links[goods.id];
                    if (linkIgnore === LinkAlgorithm.Ignore) {
                        delete obj.links[goods.id];
                    } else {
                        obj.links[goods.id] = LinkAlgorithm.Ignore;
                    }
                }
                
                UpdateProject();
            }
        });

        this.actionHandlers.set("update_amount", (obj, event) => {
            if (obj instanceof ProductModel && event.type === "change") {
                obj.amount = parseFloat((event.target as HTMLInputElement).value);
                UpdateProject();
            }
        });

        this.actionHandlers.set("add_recipe", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && event.type === "click") {
                this.showNeiForRecipeSelection(obj);
            }
        });

        this.actionHandlers.set("add_group", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && event.type === "click") {
                this.addGroup(obj);
            }
        });

        this.actionHandlers.set("toggle_collapse", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && event.type === "click") {
                obj.collapsed = !obj.collapsed;
                UpdateProject(true);
            }
        });

        this.actionHandlers.set("add_product", (obj, event, parent) => {
            if (obj instanceof PageModel && event.type === "click") {
                this.showNeiForProductSelection();
            }
        });

        this.actionHandlers.set("delete_recipe", (obj, event, parent) => {
            if (obj instanceof RecipeModel && parent instanceof RecipeGroupModel && event.type === "click") {
                const index = parent.elements.findIndex(el => el.iid === obj.iid);
                if (index !== -1) {
                    parent.elements.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("delete_group", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && parent instanceof RecipeGroupModel && event.type === "click") {
                const index = parent.elements.findIndex(el => el.iid === obj.iid);
                if (index !== -1) {
                    parent.elements.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("update_group_name", (obj, event, parent) => {
            if (obj instanceof RecipeGroupModel && event.type === "change") {
                obj.name = (event.target as HTMLInputElement).value;
            }
        });

        this.actionHandlers.set("update_voltage_tier", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "change") {
                obj.voltageTier = parseInt((event.target as HTMLSelectElement).value);
                UpdateProject();
            }
        });
    }

    private setupGlobalEventListeners() {
        let commonHandler = (e: Event) => {
            if (e.type === "contextmenu" && e instanceof MouseEvent && (e.ctrlKey || e.metaKey))
                return;
            const element = (e.target as HTMLElement).closest("[data-iid][data-action]") as HTMLElement;
            if (element) {
                const iid = parseInt(element.getAttribute("data-iid")!) || page.iid;
                const action = element.getAttribute("data-action")!;
                const result = GetByIid(iid);
                if (result) {
                    const handler = this.actionHandlers.get(action);
                    if (handler) {
                        handler(result.current, e, result.parent);
                    }
                }
            }
        }

        // Global event listener for all elements with iid and action
        document.addEventListener("click", commonHandler);
        document.addEventListener("change", commonHandler);
        document.addEventListener("contextmenu", commonHandler);

        // Tooltip handling
        document.addEventListener("mouseenter", (e) => {
            const element = (e.target as HTMLElement).closest("[data-tooltip]");
            if (element) {
                const tooltip = element.getAttribute("data-tooltip");
                if (tooltip) {
                    let formattedTooltip = tooltips[tooltip];
                    if (formattedTooltip) {
                        ShowTooltip(element as HTMLElement, {
                            header: formattedTooltip.header,
                            text: formattedTooltip.text
                        });
                    } else {
                        ShowTooltip(element as HTMLElement, { header: tooltip });
                    }
                }
            }
        }, true);
    }

    private setupDragAndDrop() {
        document.addEventListener("dragstart", (e) => {
            const draggable = (e.target as HTMLElement).closest("[draggable]");
            if (draggable) {
                draggable.classList.add("dragging");
                e.dataTransfer?.setData("text/plain", draggable.getAttribute("data-iid") || "");
            }
        });

        document.addEventListener("dragend", (e) => {
            const draggable = (e.target as HTMLElement).closest("[draggable]");
            if (draggable) {
                draggable.classList.remove("dragging");
            }
        });

        document.addEventListener("dragover", (e) => {
            e.preventDefault();
            const dropZone = (e.target as HTMLElement).closest(".recipe-item, .recipe-group, .group-content");
            if (dropZone) {
                dropZone.classList.add("drag-over");
            }
        });

        document.addEventListener("dragleave", (e) => {
            const dropZone = (e.target as HTMLElement).closest(".recipe-item, .recipe-group, .group-content");
            if (dropZone) {
                dropZone.classList.remove("drag-over");
            }
        });

        document.addEventListener("drop", (e) => {
            e.preventDefault();
            const dropZone = (e.target as HTMLElement).closest(".recipe-item, .recipe-group, .group-content");
            if (!dropZone) return;

            dropZone.classList.remove("drag-over");
            const draggedIid = parseInt(e.dataTransfer?.getData("text/plain") || "0");
            
            // Get the target iid
            let targetIid: number;
            targetIid = parseInt(dropZone.getAttribute("data-iid") || "0");
            // Call DragAndDrop with the two iids
            DragAndDrop(draggedIid, targetIid);
        });
    }

    private showNeiForProductSelection() {
        const callback: ShowNeiCallback = {
            onSelectGoods: (goods: Goods, mode: ShowNeiMode) => {
                this.addProduct(goods, 1);
            },
        };

        ShowNei(null, ShowNeiMode.Production, callback);
    }

    private showNeiForRecipeSelection(targetGroup: RecipeGroupModel) {
        const callback: ShowNeiCallback = {
            onSelectRecipe: (recipe: Recipe) => {
                this.addRecipe(recipe, targetGroup);
            }
        };

        ShowNei(null, ShowNeiMode.Production, callback);
    }

    private addProduct(goods: Goods, amount: number) {
        page.products.push(new ProductModel({
            goodsId: goods.id,
            amount: goods instanceof Fluid ? 1000 : 1
        }));
        UpdateProject();
    }

    private addRecipe(recipe: Recipe, targetGroup: RecipeGroupModel) {
        targetGroup.elements.push(new RecipeModel({ recipeId: recipe.id, voltageTier: recipe.gtRecipe?.voltageTier ?? 0 }));
        UpdateProject();
    }

    private addGroup(targetGroup: RecipeGroupModel) {
        targetGroup.elements.push(new RecipeGroupModel());
        UpdateProject();
    }

    private renderIoInfo(flow: FlowInformation, group: RecipeGroupModel): string {
        const formatAmount = (amount: number) => {
            return amount <= 100000 ? amount :
                amount <= 10000000 ? Math.round(amount/1000) + "K" : Math.round(amount/1000000) + "M";
        };

        const renderFlowItems = (items: {[key:string]:number}, group: RecipeGroupModel) => {
            const sortedFlow = Object.entries(items).sort(([,a], [,b]) => Math.abs(b) - Math.abs(a));
            return sortedFlow.map(([goodsId, amount]) => {
                const amountText = formatAmount(amount);
                return `
                    <item-icon data-id="${goodsId}" class="flow-item" data-amount="${amountText}" data-action="item_icon_click" data-iid="${group.iid}"></item-icon>
                `;
            }).join('');
        };

        const renderEnergyItems = (energy: {[key:number]:number}) => {
            let out = "";
            for (const [tier, amount] of Object.entries(energy)) {
                const tierInfo = voltageTier[parseInt(tier)];
                out += `${tierInfo.name}: ${Math.ceil(100 * amount/tierInfo.voltage)/100}A<br>`;
            }
            return out;
        }

        return `
            <div class="text-small white-text">
                ${renderEnergyItems(flow.energy)}
            </div>
            <div class="io-items">
                ${renderFlowItems(flow.input, group)}
            </div>
            <div class="io-items">
                ${renderFlowItems(flow.output, group)}
            </div>
        `;
    }

    private renderRecipeShortInfo(recipe: Recipe | null, recipeModel: RecipeModel, group: RecipeGroupModel): string {
        if (recipe === null) {
            return `<div class="short-info">Unknown recipe</div>`;
        }
        let crafter = Repository.current.GetObject(recipe.recipeType.craftItems[0], Item);
        let result = `<item-icon data-id="${crafter.id}" data-action="item_icon_click" data-iid="${group.iid}"></item-icon>`;
        
        let shortInfoContent = recipe.recipeType.name;
        let gtRecipe = recipe.gtRecipe;
        if (gtRecipe && gtRecipe.durationTicks > 0) {
            const minTier = gtRecipe.voltageTier;
            const maxTier = voltageTier.length - 1;
            const options = voltageTier
                .slice(minTier, maxTier + 1)
                .map((tier: GtVoltageTier, index: number) => `<option value="${minTier + index}" ${minTier + index === recipeModel.voltageTier ? 'selected' : ''}>${tier.name}</option>`)
                .join('');
            let machineCounts = recipeModel.recipesPerMinute * gtRecipe.durationMinutes / recipeModel.overclockFactor;
            //console.log(recipeModel.recipesPerMinute, gtRecipe.durationMinutes, recipeModel.overclockFactor, machineCounts);
            let machineCountsText = Math.ceil(machineCounts * 100) / 100;

            shortInfoContent = `
                ${machineCountsText}x
                <select class="voltage-tier-select" data-iid="${recipeModel.iid}" data-action="update_voltage_tier">
                    ${options}
                </select>
                ${shortInfoContent}
            `;
        }

        result += `<div class="short-info">${shortInfoContent}</div>`;
        return result;
    }

    private renderRecipe(recipeModel: RecipeModel, group: RecipeGroupModel, level: number = 0): string {
        let recipe = Repository.current.GetById<Recipe>(recipeModel.recipeId);
        return `
            <div class="recipe-item" data-iid="${recipeModel.iid}" draggable="true">
                <div class="grid-row" style="--nest-level: ${level}">
                    ${this.renderRecipeShortInfo(recipe, recipeModel, group)}
                    ${this.renderIoInfo(recipeModel.flow, group)}
                    <button class="delete-btn" data-iid="${recipeModel.iid}" data-action="delete_recipe"></button>
                </div>
            </div>
        `;
    }

    private renderCollapsedGroup(group: RecipeGroupModel, parentGroup: RecipeGroupModel, level: number = 0): string {
        return `
            <div class="recipe-group collapsed" data-iid="${group.iid}" draggable="true">
                <div class="grid-row" style="--nest-level: ${level}">
                    <button class="expand-btn icon-button" data-iid="${group.iid}" data-action="toggle_collapse"></button>
                    <div class="short-info">
                        <div class="group-name">${group.name}</div>
                    </div>
                    ${this.renderIoInfo(group.flow, parentGroup)}
                    <button class="delete-btn" data-iid="${group.iid}" data-action="delete_group"></button>
                </div>
            </div>
        `;
    }

    private renderExpandedGroup(group: RecipeGroupModel, level: number = 0): string {
        return `
            <div class="recipe-group" data-iid="${group.iid}">
                <div class="grid-row" style="--nest-level: ${level}">
                    <button class="collapse-btn icon-button" data-iid="${group.iid}" data-action="toggle_collapse"></button>
                    <div class="short-info">
                        <input type="text" class="group-name-input" value="${group.name}" data-iid="${group.iid}" data-action="update_group_name">
                    </div>
                    <div class="group-buttons">
                        <button class="add-recipe-btn" data-iid="${group.iid}" data-action="add_recipe">Add Recipe</button>
                        <button class="add-group-btn" data-iid="${group.iid}" data-action="add_group">Add Group</button>
                    </div>
                    <button class="delete-btn" data-iid="${group.iid}" data-action="delete_group"></button>
                </div>
                ${this.renderLinks(group.actualLinks, group)}
                    ${group.elements.map(entry => {
                        if (entry instanceof RecipeModel) {
                            return this.renderRecipe(entry, group, level + 1);
                        } else if (entry instanceof RecipeGroupModel) {
                            return entry.collapsed ? 
                                this.renderCollapsedGroup(entry, group, level + 1) : 
                                this.renderExpandedGroup(entry, level + 1);
                        }
                        return '';
                    }).join("")}
            </div>
        `;
    }

    private renderRootGroup(group: RecipeGroupModel): string {
        return `
            <div class="recipe-group root-group" data-iid="${group.iid}">
                <div class="grid-row" style="--nest-level: 0">
                    <div></div>
                    <div class="short-info">
                        <input type="text" class="group-name-input" value="${group.name}" data-iid="${group.iid}" data-action="update_group_name">
                    </div>
                    <div class="io-label">ENRG</div>
                    <div class="io-label">INPUTS/min</div>
                    <div class="io-label">OUTPUTS/min</div>
                </div>
                <div class="grid-row" style="--nest-level: 0">
                    <div></div>
                    <div class="group-buttons">
                        <button class="add-recipe-btn" data-iid="${group.iid}" data-action="add_recipe">Add Recipe</button>
                        <button class="add-group-btn" data-iid="${group.iid}" data-action="add_group">Add Group</button>
                    </div>
                    ${this.renderIoInfo(group.flow, group)}
                </div>
                ${this.renderLinks(group.actualLinks, group)}
                    ${group.elements.map(entry => {
                        if (entry instanceof RecipeModel) {
                            return this.renderRecipe(entry, group, 1);
                        } else if (entry instanceof RecipeGroupModel) {
                            return entry.collapsed ? 
                                this.renderCollapsedGroup(entry, group, 1) : 
                                this.renderExpandedGroup(entry, 1);
                        }
                        return '';
                    }).join("")}
            </div>
        `;
    }

    private renderLinks(links: {[key:string]:LinkAlgorithm}, group: RecipeGroupModel): string {
        let goodsIds = Object.keys(links).sort();
        if (goodsIds.length === 0) return '';
        
        return `
            <div class="group-links">
                <div class="hgroup">
                    <span class="links-label" data-tooltip="link">Links: (?)</span>
                </div>
                <div class="links-grid">
                    ${goodsIds.map(goodsId => {
                        const goods = Repository.current.GetById<Goods>(goodsId);
                        const algorithm = links[goodsId];
                        let overText = algorithm === LinkAlgorithm.Match ? "" : ` data-amount="${linkAlgorithmNames[algorithm]}"`;
                        return goods ? `<item-icon data-id="${goodsId}"${overText} data-action="toggle_link_ignore" data-iid="${group.iid}"></item-icon>` : '';
                    }).join('')}
                </div>
            </div>
        `;
    }

    private updateProductList() {
        // Filter out zero amounts and sort by amount descending
        const products = page.products
            .filter(product => product instanceof ProductModel && product.amount !== 0)
            .sort((a, b) => (b as ProductModel).amount - (a as ProductModel).amount);

        this.productItemsContainer.innerHTML = `
            ${products.map(product => {
                if (!(product instanceof ProductModel)) return '';
                const obj = Repository.current.GetById(product.goodsId);
                if (!obj || !(obj instanceof Goods)) return '';
                const goods = obj as Goods;
                return `
                    <div class="product-item" data-iid="${product.iid}">
                        <item-icon data-id="${goods.id}" data-action="item_icon_click" data-iid="${product.iid}"></item-icon>
                        <div class="amount-container">
                            <input type="number" class="amount" value="${product.amount}" min="-999999" step="0.1" data-iid="${product.iid}" data-action="update_amount">
                            <span class="amount-unit">/min</span>
                        </div>
                        <div class="name">${goods.name}</div>
                        <button class="delete-btn" data-iid="${product.iid}" data-action="delete_product"></button>
                    </div>
                `;
            }).join("")}
        `;
    }

    private updateRecipeList() {
        this.recipeItemsContainer.innerHTML = this.renderRootGroup(page.rootGroup);
    }

    // Clean up when the component is destroyed
    destroy() {
        removeProjectChangeListener(() => {
            this.updateProductList();
            this.updateRecipeList();
        });
    }
}

// Initialize the recipe list
new RecipeList(); 