import { ShowNei, ShowNeiMode, ShowNeiCallback } from "./nei.js";
import { Goods, Repository, Item, Fluid, Recipe } from "./repository.js";
import { UpdateProject, addProjectChangeListener, GetByIid, RecipeModel, RecipeGroupModel, ProductModel, ModelObject, PageModel, DragAndDrop, page, FlowInformation, LinkAlgorithm, CopyCurrentPageUrl, DownloadCurrentPage, Search } from "./page.js";
import { voltageTier, GtVoltageTier, formatAmount } from "./utils.js";
import { ShowTooltip } from "./tooltip.js";
import { IconBox } from "./itemIcon.js";
import { ShowDropdown, HideDropdown } from "./dropdown.js";
import { machines, notImplementedMachine, singleBlockMachine } from "./machines.js";

const linkAlgorithmNames: { [key in LinkAlgorithm]: string } = {
    [LinkAlgorithm.Match]: "",
    [LinkAlgorithm.Ignore]: "Ignore",
};

type ActionHandler = (obj: ModelObject, event: Event, parent: ModelObject) => void;

export class RecipeList {
    private productItemsContainer: HTMLElement;
    private recipeItemsContainer: HTMLElement;
    private statusMessageElement: HTMLElement;
    private searchContainer: HTMLElement;
    private searchInput: HTMLInputElement;
    private searchClose: HTMLElement;
    private searchHighlightStyle:HTMLStyleElement;
    private actionHandlers: Map<string, ActionHandler> = new Map();

    constructor() {
        this.productItemsContainer = document.querySelector(".product-items")!;
        this.recipeItemsContainer = document.querySelector(".recipe-list")!;
        this.statusMessageElement = document.querySelector('.status-message') as HTMLElement;
        this.searchContainer = document.querySelector('.search-container')!;
        this.searchInput = document.getElementById('recipe-search') as HTMLInputElement;
        this.searchClose = document.getElementById('recipe-search-close')!;
        this.searchHighlightStyle = document.getElementById('item-icon-search-style') as HTMLStyleElement;
        this.setupActionHandlers();
        this.setupGlobalEventListeners();
        this.setupDragAndDrop();
        this.setupSearch();
        
        // Listen for project changes
        addProjectChangeListener(() => {
            this.renderStatus();
            this.renderProductList();
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

        this.actionHandlers.set("crafter_click", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "click") {
                let options = [];
                let recipe = Repository.current.GetById<Recipe>(obj.recipeId);
                if (!recipe) return;
                let recipeType = recipe.recipeType;
                if (recipeType.singleblocks.length > 0)
                    options.push(recipeType.singleblocks[obj.voltageTier] ?? recipeType.defaultCrafter);
                options.push(...recipeType.multiblocks);

                const populateDropdown = (container: HTMLElement) => {
                    container.innerHTML = `
                        <div class="dropdown-list">
                            Select crafter:
                            ${options.map(goods => {
                                const isSingleblock = recipeType.singleblocks.includes(goods as Item);
                                const displayName = isSingleblock ? "Singleblock "+recipe.recipeType.name : goods.name;
                                return `
                                    <div class="dropdown-item" 
                                        data-iid="${obj.iid}"
                                        data-action="select_crafter"
                                        data-id="${goods.id}">
                                        <item-icon data-id="${goods.id}"></item-icon>
                                        <span class="item-name">${displayName}</span>
                                    </div>
                                `;
                            }).join('')}
                            <div>
                                <label>
                                    <input type="checkbox" 
                                        data-iid="${obj.iid}"
                                        data-action="toggle_fixed_crafter_count"
                                        ${obj.fixedCrafterCount !== undefined ? 'checked' : ''}>
                                    Set fixed crafter count
                                </label>
                            </div>
                            ${obj.fixedCrafterCount !== undefined ? `
                                <div>
                                    <label>
                                        Crafter count:
                                        <input type="number" class="crafter-count"
                                            data-iid="${obj.iid}"
                                            data-action="update_fixed_crafter_count"
                                            value="${obj.fixedCrafterCount}"
                                            min="0">
                                    </label>
                                </div>
                                <span class="text-small">When using a fixed crafter count, you should remove the product from the desired product list and let it be calculated automatically. Otherwise, the model will likely become infeasible.</span>
                            ` : ''}
                        </div>
                    `;
                };

                ShowDropdown(event.target as HTMLElement, populateDropdown);
            }
        });

        this.actionHandlers.set("update_amount", (obj, event) => {
            if (obj instanceof ProductModel && event.type === "change") {
                obj.amount = parseFloat((event.target as HTMLInputElement).value) * page.timeScale;
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

        this.actionHandlers.set("update_min_voltage", (obj, event, parent) => {
            if (obj instanceof PageModel && event.type === "change") {
                obj.settings.minVoltage = parseInt((event.target as HTMLSelectElement).value);
                // No need to update project as this only affects new recipes
            }
        });

        this.actionHandlers.set("update_time_unit", (obj, event, parent) => {
            if (obj instanceof PageModel && event.type === "change") {
                obj.settings.timeUnit = (event.target as HTMLSelectElement).value as "hour" | "min" | "sec" | "tick";
                UpdateProject();
            }
        });

        this.actionHandlers.set("update_machine_choice", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "change") {
                const target = event.target as HTMLInputElement | HTMLSelectElement;
                const choice = target.getAttribute("data-choice")!;
                obj.choices[choice] = parseFloat(target.value);
                UpdateProject();
            }
        });

        this.actionHandlers.set("copy_link", (obj, event) => {
            if (event.type === "click") {
                CopyCurrentPageUrl();
            }
        });

        this.actionHandlers.set("download", (obj, event) => {
            if (event.type === "click") {
                DownloadCurrentPage();
            }
        });

        this.actionHandlers.set("select_crafter", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "click") {
                const target = event.target as HTMLElement;
                const item = target.closest('.dropdown-item');
                if (item) {
                    const goodsId = item.getAttribute('data-id')!;
                    const crafter = Repository.current.GetById<Item>(goodsId);
                    if (crafter && obj.recipe?.recipeType.multiblocks.includes(crafter))
                        obj.crafter = crafter.id;
                    else
                        obj.crafter = undefined;
                    UpdateProject();
                    HideDropdown();
                }
            }
        });

        this.actionHandlers.set("toggle_fixed_crafter_count", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "change") {
                const target = event.target as HTMLInputElement;
                if (target.checked) {
                    obj.fixedCrafterCount = obj.crafterCount;
                } else {
                    obj.fixedCrafterCount = undefined;
                }
                UpdateProject();
            }
        });

        this.actionHandlers.set("update_fixed_crafter_count", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "change") {
                const target = event.target as HTMLInputElement;
                obj.fixedCrafterCount = parseFloat(target.value);
                UpdateProject();
            }
        });

        this.actionHandlers.set("accept_recipe_change", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "click") {
                const recipe = Repository.current.GetById<Recipe>(obj.recipeId);
                if (recipe) {
                    obj.recipeId = recipe.id;
                    UpdateProject();
                }
            }
        });

        this.actionHandlers.set("change_recipe", (obj, event, parent) => {
            if (obj instanceof RecipeModel && event.type === "click") {
                const callback: ShowNeiCallback = {
                    onSelectRecipe: (recipe: Recipe) => {
                        let mustResetCrafter = obj.multiblockCrafter && recipe.recipeType.multiblocks.includes(obj.multiblockCrafter);
                        obj.recipeId = recipe.id;
                        obj.voltageTier = Math.max(recipe.gtRecipe?.voltageTier ?? 0, obj.voltageTier);
                        if (mustResetCrafter) {
                            obj.crafter = undefined;
                            obj.choices = {};
                        }
                        UpdateProject();
                    }
                };
                ShowNei(null, ShowNeiMode.Production, callback);
            }
        });
    }

    private setupGlobalEventListeners() {
        let commonHandler = (e: Event) => {
            if (e.type === "contextmenu" && e instanceof MouseEvent && (e.ctrlKey || e.metaKey))
                return;
            const element = (e.target as HTMLElement).closest("[data-action]") as HTMLElement;
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
                switch (tooltip) {
                    case "recipe":
                        let obj = GetByIid(parseInt(element.getAttribute("data-iid")!))?.current as RecipeModel;
                        if (obj) {
                            let recipe = Repository.current.GetById<Recipe>(obj.recipeId);
                            let text = `${formatAmount(obj.recipesPerMinute/page.timeScale)} recipes/${page.settings.timeUnit}`;
                            if (recipe?.gtRecipe) {
                                let initialTier = recipe.gtRecipe.voltageTier;
                                let finalTier = initialTier + obj.overclockTiers;
                                let initialTierName = voltageTier[initialTier].name;
                                let finalTierName = voltageTier[finalTier].name;
                                let overclocksText = obj.overclockName;
                                text = `${obj.parallels} parallels\n` +
                                       `${overclocksText} ${initialTier == finalTier ? `(${initialTierName})` : `(${initialTierName} → ${finalTierName})`}\n` +
                                       text + `\n${formatAmount(obj.overclockFactor)}x machine speed\n` +
                                       `${formatAmount(obj.powerFactor/(obj.recipe?.gtRecipe?.amperage ?? 1))}x eu per recipe`;
                            }
                            ShowTooltip(element as HTMLElement, {
                                header: recipe?.recipeType.name + " recipe",
                                text: text,
                                recipe: recipe,
                                overrideIo: obj.recipeItems
                            });
                        }
                        break;
                    case "change_recipe":
                        ShowTooltip(element as HTMLElement, {
                            header: "Change Recipe",
                            text: "Click to select a different recipe"
                        });
                        break;
                    case "link":
                        ShowTooltip(element as HTMLElement, {
                            header: "Links",
                            text: "When some item has both production and consumption (or it is a required product), a link is created.\n\n\
    By default, the link will attempt to match production and consumption exactly.\n\n\
    If this is not desired, you can choose to ignore the link by clicking on it."
                        });
                        break;
                }
            }
        }, true);
    }

    private setupDragAndDrop() {
        // Handle drag start
        document.addEventListener("dragstart", (e) => {
            const draggable = (e.target as HTMLElement)?.closest("[draggable]");
            if (draggable) {
                draggable.classList.add("dragging");
                e.dataTransfer?.setData("text/plain", draggable.getAttribute("data-iid") || "");
            }
        });

        // Handle drag end
        document.addEventListener("dragend", (e) => {
            const draggable = (e.target as HTMLElement)?.closest("[draggable]");
            if (draggable) {
                draggable.classList.remove("dragging");
            }
        });

        // Handle drag over
        document.addEventListener("dragover", (e) => {
            e.preventDefault();
            const dropZone = (e.target as HTMLElement)?.closest(".recipe-item, .recipe-group, .group-buttons");
            if (dropZone) {
                dropZone.classList.add("drag-over");
            }
        });

        // Handle drag leave
        document.addEventListener("dragleave", (e) => {
            const dropZone = (e.target as HTMLElement)?.closest(".recipe-item, .recipe-group, .group-buttons");
            if (dropZone) {
                dropZone.classList.remove("drag-over");
            }
        });

        // Handle drop
        document.addEventListener("drop", (e) => {
            e.preventDefault();
            const dropZone = (e.target as HTMLElement)?.closest(".recipe-item, .recipe-group, .group-buttons");
            if (!dropZone) return;
            
            dropZone.classList.remove("drag-over");
            const draggedIid = parseInt(e.dataTransfer?.getData("text/plain") || "0");
            const targetIid = parseInt(dropZone.getAttribute("data-iid") || "0");
            
            if (draggedIid && targetIid) {
                DragAndDrop(draggedIid, targetIid);
            }
        });
    }

    private setupSearch() {
        // Hide search by default
        this.searchContainer.classList.add('hidden');

        // Show search on Ctrl+F
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault(); // Prevent browser's default find behavior
                this.searchContainer.classList.remove('hidden');
                this.searchInput.focus(); // Focus the input when shown
            }
        });

        // Hide search when clicking X
        this.searchClose.addEventListener('click', () => {
            this.searchContainer.classList.add('hidden');
            this.searchInput.value = ''; // Clear the input when hiding
            this.searchHighlightStyle.textContent = ''; // Clear the highlight style
        });

        // Hide search when pressing Escape
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !this.searchContainer.classList.contains('hidden')) {
                this.searchContainer.classList.add('hidden');
                this.searchInput.value = ''; // Clear the input when hiding
                this.searchHighlightStyle.textContent = ''; // Clear the highlight style
            }
        });

        // Handle search text changes
        this.searchInput.addEventListener('input', (e: Event) => {
            const searchText = (e.target as HTMLInputElement).value;
            if (searchText == "") {
                this.searchHighlightStyle.textContent = '';
                return;
            }
            const results = Search(searchText);
            
            // Build the CSS for matched items
            const matchedIds = Object.entries(results)
                .filter(([_, matched]) => matched)
                .map(([id, _]) => id);
            
            // Create the CSS rule for all matched items
            const cssRule = matchedIds.length > 0 
                ? matchedIds.map(id => `item-icon[data-id="${id}"]`).join(',\n') + 
                  ` {\n    box-shadow: 0 0 0 2px #ee6b6e;\n    background-color: #ee6b6e20;\n}`
                : '';
            
            // Update the style element
            this.searchHighlightStyle.textContent = cssRule;
        });
    }

    private showNeiForProductSelection() {
        const callback: ShowNeiCallback = {
            onSelectGoods: (goods: Goods) => {
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
        const minVoltage = page.settings.minVoltage ?? 0;
        const recipeVoltage = recipe.gtRecipe?.voltageTier ?? 0;
        const voltageTier = Math.max(recipeVoltage, minVoltage);
        targetGroup.elements.push(new RecipeModel({ recipeId: recipe.id, voltageTier }));
        UpdateProject();
    }

    private addGroup(targetGroup: RecipeGroupModel) {
        targetGroup.elements.push(new RecipeGroupModel());
        UpdateProject();
    }

    private renderIoInfo(flow: FlowInformation, group: RecipeGroupModel): string {
        const renderFlowItems = (items: {[key:string]:number}, group: RecipeGroupModel) => {
            const sortedFlow = Object.entries(items).sort(([,a], [,b]) => Math.abs(b) - Math.abs(a));
            return sortedFlow.map(([goodsId, amount]) => {
                const amountText = formatAmount(amount/page.timeScale);
                return `
                    <item-icon data-id="${goodsId}" class="flow-item" data-amount="${amountText}" data-action="item_icon_click" data-iid="${group.iid}"></item-icon>
                `;
            }).join('');
        };

        const renderEnergyItems = (energy: {[key:number]:number}) => {
            let totalEnergy = 0;

            const tierDetails = Object.entries(energy).map(([tier, amount]) => {
                const tierInfo = voltageTier[parseInt(tier)];
                const current = Math.ceil(100 * amount / tierInfo.voltage) / 100;
                totalEnergy += Math.ceil(amount);

                return `${tierInfo.name}: ${current}A`;
            }).join('<br>');

            const formattedTotalEnergy = formatAmount(totalEnergy);

            return `${tierDetails}<br><br>EU/t: ${formattedTotalEnergy}`;
        }

        return `
            <td class="text-small white-text">
                ${renderEnergyItems(flow.energy)}
            </td>
            <td>
                <div class="io-items">
                    ${renderFlowItems(flow.input, group)}
                </div>
            </td>
            <td>
                <div class="io-items">
                    ${renderFlowItems(flow.output, group)}
                </div>
            </td>
        `;
    }

    private renderRecipeShortInfo(recipe: Recipe | null, recipeModel: RecipeModel, group: RecipeGroupModel): string {
        if (recipe === null) {
            return `
                <td colspan="2">
                    <span style="color: red;">Missing recipe</span>
                    <div class="text-small">This recipe was deleted or changed. Replace or remove it.</div>
                </td>
            `;
        }
        let crafter = recipeModel.multiblockCrafter ?? recipe.recipeType.singleblocks[recipeModel.voltageTier] ?? recipe.recipeType.defaultCrafter;
        let machineInfo = recipeModel.machineInfo;
        
        let gtRecipe = recipe.gtRecipe;
        let shortInfoContent = `<span data-tooltip="recipe" data-iid="${recipeModel.iid}">${crafter?.name ?? recipe.recipeType.name}</span>`;
        let machineCountsText = "";
        if (gtRecipe && gtRecipe.durationTicks > 0) {
            const minTier = gtRecipe.voltageTier;
            const maxTier = voltageTier.length - 1;
            const options = voltageTier
                .slice(minTier, maxTier + 1)
                .map((tier: GtVoltageTier, index: number) => `<option value="${minTier + index}" ${minTier + index === recipeModel.voltageTier ? 'selected' : ''}>${tier.name}</option>`)
                .join('');
            let machineCounts = recipeModel.crafterCount;
            machineCountsText = formatAmount(machineCounts);

            if (recipeModel.parallels > 1 || recipeModel.overclockName) {
                let info = [];
                if (recipeModel.parallels > 1)
                    info.push(`${recipeModel.parallels} parallels`);
                if (recipeModel.overclockName)
                    info.push(`${recipeModel.overclockName}`);
                shortInfoContent += `<span class="text-small white-text">(${info.join(", ")})</span>`;
            }

            shortInfoContent = `
                <select class="voltage-tier-select" data-iid="${recipeModel.iid}" data-action="update_voltage_tier">
                    ${options}
                </select>
                ${shortInfoContent} 
            `;
        }

        if (recipe.id !== recipeModel.recipeId) {
            shortInfoContent = `<div><span style="color: orange;">This recipe was changed!</span> <a href="#" data-iid="${recipeModel.iid}" data-action="accept_recipe_change">Accept</a></div>${shortInfoContent}`;
        }

        // Render machine choices if they exist
        if (machineInfo.choices) {
            const choicesHtml = Object.entries(machineInfo.choices).map(([key, choice]) => {
                const currentValue = recipeModel.choices[key] ?? choice.min ?? 0;
                let inputHtml = '';
                
                if (choice.choices) {
                    // Render as dropdown
                    const options = choice.choices.map((option, index) => 
                        `<option value="${index}" ${index === currentValue ? 'selected' : ''}>${option}</option>`
                    ).join('');
                    inputHtml = `
                        <select class="machine-choice" data-iid="${recipeModel.iid}" data-action="update_machine_choice" data-choice="${key}">
                            ${options}
                        </select>
                    `;
                } else {
                    inputHtml = `
                        <input type="number" class="machine-choice" 
                            data-iid="${recipeModel.iid}" 
                            data-action="update_machine_choice"
                            data-choice="${key}"
                            value="${currentValue}"
                            min="${choice.min ?? 0}"
                            max="${choice.max ?? ''}"
                        >
                    `;
                }

                return `
                    <div class="machine-choice-container">
                        <label>${choice.description}:</label>
                        ${inputHtml}
                    </div>
                `;
            }).join('');

            if (choicesHtml) {
                shortInfoContent += `
                    <div class="machine-choices">
                        ${choicesHtml}
                    </div>
                `;
            }
        }

        if (machineInfo.info) {
            if (!machineInfo.choices)
                shortInfoContent += `<br>`;
            shortInfoContent += `<span class="text-small white-text">${machineInfo.info}</span>`;
        }

        let iconCell = `<td><div class="icon-container"><item-icon data-id="${crafter.id}" data-action="crafter_click" data-iid="${recipeModel.iid}" data-amount="${machineCountsText}">`+
            `${recipeModel.fixedCrafterCount !== undefined ? `<span class="probability">FIXED</span>` : ''}`+
            `</item-icon></div></td>`;

        let shortInfoCell = `<td><div class="short-info" data-iid="${recipeModel.iid}">${shortInfoContent}</div></td>`;
        return iconCell + shortInfoCell;
    }

    private renderRecipe(recipeModel: RecipeModel, group: RecipeGroupModel, level: number = 0): string {
        let recipe = Repository.current.GetById<Recipe>(recipeModel.recipeId);
        return `
            <tr class="recipe-item" data-iid="${recipeModel.iid}" draggable="true">
                ${this.renderRecipeShortInfo(recipe, recipeModel, group)}
                ${this.renderIoInfo(recipeModel.flow, group)}
                <td>
                    <div class="icon-container">
                        <button class="delete-btn" data-iid="${recipeModel.iid}" data-action="change_recipe" data-tooltip="change_recipe">↔</button>
                        <button class="delete-btn" data-iid="${recipeModel.iid}" data-action="delete_recipe">x</button>
                    </div>
                </td>
            </tr>
        `;
    }

    private renderCollapsedGroup(group: RecipeGroupModel, parentGroup: RecipeGroupModel, level: number = 0): string {
        return `
            <tr class="recipe-group collapsed" data-iid="${group.iid}" draggable="true">
                <td>
                    <div class="icon-container">
                        <button class="expand-btn icon-button" data-iid="${group.iid}" data-action="toggle_collapse"></button>
                    </div>
                </td>
                <td>
                    <div class="short-info">
                        <div class="group-name">${group.name}</div>
                    </div>
                </td>
                ${this.renderIoInfo(group.flow, parentGroup)}
                <td>
                    <div class="icon-container">
                        <button class="delete-btn" data-iid="${group.iid}" data-action="delete_group">x</button>
                    </div>
                </td>
            </tr>
        `;
    }

    private renderExpandedGroup(group: RecipeGroupModel, level: number = 0): string {
        return `
            <tr class="recipe-group expanded" data-iid="${group.iid}">
                <td colspan="6" class="expanded-group-cell nested-level-${level%2}">
                    <table class="recipe-table">
                        <tr>
                            <th class="icon-cell">
                                <div class="icon-container">
                                    <button class="collapse-btn icon-button" data-iid="${group.iid}" data-action="toggle_collapse"></button>
                                </div>
                            </th>
                            <th class="short-info-cell">
                                <div class="short-info">
                                    <input type="text" class="group-name-input" value="${group.name}" data-iid="${group.iid}" data-action="update_group_name" placeholder="Group name">
                                </div>
                            </th>
                            <th class="energy-cell">POWER</th>
                            <th class="inputs-cell">INPUTS/${page.settings.timeUnit}</th>
                            <th class="outputs-cell">OUTPUTS/${page.settings.timeUnit}</th>
                            <th class="action-cell">
                                <div class="icon-container">
                                    <button class="delete-btn" data-iid="${group.iid}" data-action="delete_group">x</button>
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <td></td>
                            <td>Group total:</td>
                            ${this.renderIoInfo(group.flow, group)}
                            <td></td>
                        </tr>
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
                        ${this.renderButtons(group)}
                    </table>
                </td>
            </tr>
        `;
    }

    private renderSettings(): string {
        const minVoltageOptions = voltageTier.map((tier, index) => 
            `<option value="${index}" ${index === page.settings.minVoltage ? 'selected' : ''}>${tier.name}</option>`
        ).join('');

        return `
            <h2>Settings:</h2>
            <div class="settings-panel">
                <div class="setting-item">
                    <label>Voltage tier for new recipes:</label>
                    <select data-iid="${page.iid}" data-action="update_min_voltage">
                        ${minVoltageOptions}
                    </select>
                </div>
                <div class="setting-item">
                    <label>Time unit:</label>
                    <select data-iid="${page.iid}" data-action="update_time_unit">
                        <option value="hour" ${page.settings.timeUnit === "hour" ? 'selected' : ''}>Hours</option>
                        <option value="min" ${page.settings.timeUnit === "min" ? 'selected' : ''}>Minutes</option>
                        <option value="sec" ${page.settings.timeUnit === "sec" ? 'selected' : ''}>Seconds</option>
                        <option value="tick" ${page.settings.timeUnit === "tick" ? 'selected' : ''}>Ticks</option>
                    </select>
                </div>
                <div class="share-links">
                    Share:
                    <a href="#" data-action="copy_link">Copy shareable link to clipboard</a> •
                    <a href="#" data-action="download">Download</a>
                </div>
            </div>
        `;
    }

    private renderRootGroup(group: RecipeGroupModel): string {
        return `
            <table class="recipe-table root-group" data-iid="${group.iid}">
                <thead>
                    <tr>
                        <th class="icon-cell"></th>
                        <th class="short-info-cell"></th>
                        <th class="energy-cell">POWER</th>
                        <th class="inputs-cell">INPUTS/${page.settings.timeUnit}</th>
                        <th class="outputs-cell">OUTPUTS/${page.settings.timeUnit}</th>
                        <th class="action-cell"></th>
                    </tr>
                    <tr>
                        <td></td>
                        <td>Grand total:</td>
                        ${this.renderIoInfo(group.flow, group)}
                        <td></td>
                    </tr>
                </thead>
                <tbody>
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
                    ${this.renderButtons(group)}
                </tbody>
            </table>
            ${this.renderSettings()}
        `;
    }

    private renderLinks(links: {[key:string]:LinkAlgorithm}, group: RecipeGroupModel): string {
        let goodsIds = Object.keys(links).sort();
        if (goodsIds.length === 0) return '';
        
        return `
            <tr class="group-links">
                <td colspan="6">
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
                </td>
            </tr>
        `;
    }

    private renderButtons(group: RecipeGroupModel): string {
        return `
            <tr class="group-buttons" data-iid="${group.iid}">
                <td colspan="6">
                    <div>
                        <a href="#" class="add-recipe-btn" data-iid="${group.iid}" data-action="add_recipe">Add Recipe</a> •
                        <a href="#" class="add-group-btn" data-iid="${group.iid}" data-action="add_group">Add Group</a> •
                        You can also add recipes by clicking on an item.
                    </div>
                </td>
            </tr>
        `;
    }

    private renderStatus() {
        let statusMessage = "";
        let statusClass = "";
        if (page.status === "infeasible") {
            statusMessage = "Infeasible - There is no solution - You probably need to ignore some links";
        } else if (page.status === "unbounded") {
            statusMessage = "Unbounded - Some items can be produced infinitely";
        } else if (page.status === "solved") {
            statusMessage = `"${page.name}" is solved`;
            statusClass = "solved";
        }

        if (this.statusMessageElement) {
            if (statusMessage) {
                this.statusMessageElement.textContent = statusMessage;
                this.statusMessageElement.className = `status-message ${statusClass}`;
            } else {
                this.statusMessageElement.style.display = 'none';
            }
        }
    }

    private renderProductList() {
        const products = page.products
            .filter(product => product instanceof ProductModel && product.amount !== 0)
            .sort((a, b) => (b as ProductModel).amount - (a as ProductModel).amount);

        this.productItemsContainer.innerHTML = `
            ${products.map(product => {
                if (!(product instanceof ProductModel)) return '';
                const goods = Repository.current.GetById<Goods>(product.goodsId);
                return `
                    <div class="product-item">
                        <item-icon data-id="${goods?.id}" data-action="item_icon_click" data-iid="${page.rootGroup.iid}"></item-icon>
                        <input type="number" class="amount" value="${product.amount/page.timeScale}" step="0" data-iid="${product.iid}" data-action="update_amount">
                        <span class="amount-unit">/${page.settings.timeUnit}</span>
                        ${goods?.name ?? "Unknown product: " + product.goodsId}
                        <button class="delete-btn" data-iid="${product.iid}" data-action="delete_product">x</button>
                    </div>
                `;
            }).join("")}
            <button class="add-product-btn" data-action="add_product" data-iid="0">Add Product</button>
        `;
    }

    private updateRecipeList() {
        this.recipeItemsContainer.innerHTML = this.renderRootGroup(page.rootGroup);
    }
}

// Initialize the recipe list
new RecipeList();