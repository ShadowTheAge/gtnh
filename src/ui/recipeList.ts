import { ShowNei, ShowNeiMode, ShowNeiCallback } from "./nei.js";
import { Goods, Repository, Item, Fluid, Recipe } from "../data/repository.js";
import { UpdateProject, addProjectChangeListener, removeProjectChangeListener, GetByIid, RecipeModel, RecipeGroupModel, ProductModel, ModelObject, PageModel, DragAndDrop, page, FlowInformation } from "../project.js";
import { voltageTier, GtVoltageTier } from "../utils.js";

interface Product {
    goods: Goods;
    amount: number;
}

type ActionHandler = (obj: ModelObject, parent: ModelObject, event: Event) => void;

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
        this.actionHandlers.set("delete_product", (obj, parent) => {
            if (obj instanceof ProductModel && parent instanceof PageModel) {
                const index = parent.products.findIndex((p: ProductModel) => p.iid === obj.iid);
                if (index !== -1) {
                    parent.products.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("update_amount", (obj, parent, event) => {
            if (obj instanceof ProductModel && event.type === "change") {
                obj.amount = parseFloat((event.target as HTMLInputElement).value);
                UpdateProject();
            }
        });

        this.actionHandlers.set("add_recipe", (obj) => {
            if (obj instanceof RecipeGroupModel) {
                this.showNeiForRecipeSelection(obj);
            }
        });

        this.actionHandlers.set("add_group", (obj) => {
            if (obj instanceof RecipeGroupModel) {
                this.addGroup(obj);
            }
        });

        this.actionHandlers.set("toggle_collapse", (obj) => {
            if (obj instanceof RecipeGroupModel) {
                obj.collapsed = !obj.collapsed;
                UpdateProject(true);
            }
        });

        this.actionHandlers.set("add_product", (obj) => {
            if (obj instanceof PageModel) {
                this.showNeiForProductSelection();
            }
        });

        this.actionHandlers.set("delete_recipe", (obj, parent) => {
            if (obj instanceof RecipeModel && parent instanceof RecipeGroupModel) {
                const index = parent.elements.findIndex(el => el.iid === obj.iid);
                if (index !== -1) {
                    parent.elements.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("delete_group", (obj, parent) => {
            if (obj instanceof RecipeGroupModel && parent instanceof RecipeGroupModel) {
                const index = parent.elements.findIndex(el => el.iid === obj.iid);
                if (index !== -1) {
                    parent.elements.splice(index, 1);
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("update_group_name", (obj, parent, event) => {
            if (obj instanceof RecipeGroupModel && event.type === "change") {
                obj.name = (event.target as HTMLInputElement).value;
            }
        });

        this.actionHandlers.set("update_voltage_tier", (obj, parent, event) => {
            if (obj instanceof RecipeModel && event.type === "change") {
                obj.voltageTier = parseInt((event.target as HTMLSelectElement).value);
                UpdateProject();
            }
        });
    }

    private setupGlobalEventListeners() {
        let commonHandler = (e: Event) => {
        const element = (e.target as HTMLElement).closest("[data-iid][data-action]") as HTMLElement;
            if (element) {
                const iid = parseInt(element.getAttribute("data-iid")!) || page.iid;
                const action = element.getAttribute("data-action")!;
                const result = GetByIid(iid);
                if (result) {
                    const handler = this.actionHandlers.get(action);
                    if (handler) {
                        handler(result.current, result.parent, e);
                    }
                }
            }
        }

        // Global event listener for all elements with iid and action
        document.addEventListener("click", commonHandler);
        document.addEventListener("change", commonHandler);
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
            if (dropZone.classList.contains("group-content")) {
                // Dropping into a group
                targetIid = parseInt(dropZone.getAttribute("data-group-iid") || "0");
            } else {
                // Dropping on a recipe or group
                targetIid = parseInt(dropZone.getAttribute("data-iid") || "0");
            }

            // Call DragAndDrop with the two iids
            DragAndDrop(draggedIid, targetIid);
        });
    }

    private showNeiForProductSelection() {
        const callback: ShowNeiCallback = {
            canSelectGoods: () => true,
            canSelectRecipe: () => false,
            onSelectGoods: (goods: Goods, mode: ShowNeiMode) => {
                this.addProduct(goods, 1);
            },
            onSelectRecipe: () => {} // Not used
        };

        ShowNei(null, ShowNeiMode.Production, callback);
    }

    private showNeiForRecipeSelection(targetGroup: RecipeGroupModel) {
        const callback: ShowNeiCallback = {
            canSelectGoods: () => false,
            canSelectRecipe: () => true,
            onSelectGoods: () => {}, // Not used
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

    private renderIoInfo(flow: FlowInformation): string {
        const formatAmount = (amount: number) => {
            return amount <= 100000 ? amount :
                amount <= 10000000 ? Math.round(amount/1000) + "K" : Math.round(amount/1000000) + "M";
        };

        const renderFlowItems = (items: {[key:string]:number}) => {
            const sortedFlow = Object.entries(items).sort(([,a], [,b]) => Math.abs(b) - Math.abs(a));
            return sortedFlow.map(([goodsId, amount]) => {
                const amountText = formatAmount(amount);
                return `
                    <item-icon data-id="${goodsId}" class="flow-item" data-amount="${amountText}"></item-icon>
                `;
            }).join('');
        };

        return `
            <div class="io-column inputs">
                <div class="io-items">
                    ${renderFlowItems(flow.input)}
                </div>
            </div>
            <div class="io-column outputs">
                <div class="io-items">
                    ${renderFlowItems(flow.output)}
                </div>
            </div>
        `;
    }

    private renderRecipeShortInfo(recipe: Recipe | null, recipeModel: RecipeModel): string {
        if (recipe === null) {
            return `<div class="short-info">Unknown recipe</div>`;
        }
        let crafter = Repository.current.GetObject(recipe.recipeType.craftItems[0], Item);
        let result = `<item-icon data-id="${crafter.id}"></item-icon>`;
        
        let shortInfoContent = recipe.recipeType.name;
        if (recipe.gtRecipe) {
            const minTier = recipe.gtRecipe.voltageTier;
            const maxTier = voltageTier.length - 1;
            const options = voltageTier
                .slice(minTier, maxTier + 1)
                .map((tier: GtVoltageTier, index: number) => `<option value="${minTier + index}" ${minTier + index === recipeModel.voltageTier ? 'selected' : ''}>${tier.name}</option>`)
                .join('');
            
            shortInfoContent = `
                <select class="voltage-tier-select" data-iid="${recipeModel.iid}" data-action="update_voltage_tier">
                    ${options}
                </select>
                ${shortInfoContent}
            `;
        }
        
        result += `<div class="short-info">${shortInfoContent}</div>`;
        return result;
    }

    private renderRecipe(recipeModel: RecipeModel, level: number = 0): string {
        let recipe = Repository.current.GetById<Recipe>(recipeModel.recipeId);
        return `
            <div class="recipe-item" data-iid="${recipeModel.iid}" draggable="true">
                <div class="grid-row" style="--nest-level: ${level}">
                    ${this.renderRecipeShortInfo(recipe, recipeModel)}
                    ${this.renderIoInfo(recipeModel.flow)}
                    <button class="button delete-btn" data-iid="${recipeModel.iid}" data-action="delete_recipe">×</button>
                </div>
            </div>
        `;
    }

    private renderCollapsedGroup(group: RecipeGroupModel, level: number = 0): string {
        return `
            <div class="recipe-group collapsed" data-iid="${group.iid}" draggable="true">
                <div class="grid-row" style="--nest-level: ${level}">
                    <button class="collapse-btn" data-iid="${group.iid}" data-action="toggle_collapse">
                        <img src="assets/images/Arrow_Small_Right.png" alt="Expand">
                    </button>
                    <div class="short-info">
                        <div class="group-name">${group.name}</div>
                    </div>
                    ${this.renderIoInfo(group.flow)}
                    <button class="button delete-btn" data-iid="${group.iid}" data-action="delete_group">×</button>
                </div>
            </div>
        `;
    }

    private renderExpandedGroup(group: RecipeGroupModel, level: number = 0): string {
        return `
            <div class="recipe-group" data-iid="${group.iid}">
                <div class="grid-row" style="--nest-level: ${level}">
                    <button class="collapse-btn" data-iid="${group.iid}" data-action="toggle_collapse">
                        <img src="assets/images/Arrow_Small_Down.png" alt="Collapse">
                    </button>
                    <div class="short-info">
                        <input type="text" class="group-name-input" value="${group.name}" data-iid="${group.iid}" data-action="update_group_name">
                    </div>
                    <div class="group-buttons">
                        <button class="button add-recipe-btn" data-iid="${group.iid}" data-action="add_recipe">Add Recipe</button>
                        <button class="button add-group-btn" data-iid="${group.iid}" data-action="add_group">Add Group</button>
                    </div>
                    <button class="button delete-btn" data-iid="${group.iid}" data-action="delete_group">×</button>
                </div>
                ${this.renderLinks(group.links)}
                    ${group.elements.map(entry => {
                        if (entry instanceof RecipeModel) {
                            return this.renderRecipe(entry, level + 1);
                        } else if (entry instanceof RecipeGroupModel) {
                            return entry.collapsed ? 
                                this.renderCollapsedGroup(entry, level + 1) : 
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
                    <div class="io-label">INPUTS</div>
                    <div class="io-label">OUTPUTS</div>
                </div>
                <div class="grid-row" style="--nest-level: 0">
                    <div></div>
                    <div class="group-buttons">
                        <button class="button add-recipe-btn" data-iid="${group.iid}" data-action="add_recipe">Add Recipe</button>
                        <button class="button add-group-btn" data-iid="${group.iid}" data-action="add_group">Add Group</button>
                    </div>
                    ${this.renderIoInfo(group.flow)}
                </div>
                ${this.renderLinks(group.links)}
                    ${group.elements.map(entry => {
                        if (entry instanceof RecipeModel) {
                            return this.renderRecipe(entry, 1);
                        } else if (entry instanceof RecipeGroupModel) {
                            return entry.collapsed ? 
                                this.renderCollapsedGroup(entry, 1) : 
                                this.renderExpandedGroup(entry, 1);
                        }
                        return '';
                    }).join("")}
            </div>
        `;
    }

    private renderLinks(links: string[]): string {
        if (links.length === 0) return '';
        
        return `
            <div class="group-links">
                <span class="links-label">Links:</span>
                <div class="links-grid">
                    ${links.map(linkId => {
                        const goods = Repository.current.GetById<Goods>(linkId);
                        return goods ? `<item-icon data-id="${linkId}"></item-icon>` : '';
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
                        <item-icon data-id="${goods.id}"></item-icon>
                        <div class="amount-container">
                            <input type="number" class="amount" value="${product.amount}" min="-999999" step="0.1" data-iid="${product.iid}" data-action="update_amount">
                            <span class="amount-unit">/min</span>
                        </div>
                        <div class="name">${goods.name}</div>
                        <button class="button delete-btn" data-iid="${product.iid}" data-action="delete_product">×</button>
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