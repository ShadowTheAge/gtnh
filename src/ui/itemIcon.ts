import { Repository, Goods, Item, Fluid, OreDict, RecipeObject } from "../data/repository.js";
import { ShowNei, ShowNeiContext, ShowNeiMode } from "./nei.js";
import { ShowTooltip, HideTooltip, IsHovered } from "./tooltip.js";

// Global cycling state
let globalIndex = 0;
let oredictElements: IconBox[] = [];

// Global actions map
export const actions: { [key: string]: string } = {
    "item_icon_click": "Left/Right click to add recipe",
    "select": "Click to select",
    "toggle_link_ignore": "Click to toggle link ignore"
};

// Start global cycle once
window.setInterval(() => {
    globalIndex++;
    for (const element of oredictElements) {
        element.UpdateIconId();
    }
}, 500);

export class IconBox extends HTMLElement
{
    public obj:RecipeObject | null = null;

    constructor()
    {
        super();
        this.addEventListener("mouseenter", () => {
            const obj = this.GetDisplayObject();
            if (obj) {
                const actionType = this.getAttribute('data-action');
                const actionText = actionType ? actions[actionType] : undefined;
                ShowTooltip(this, {
                    goods: obj,
                    action: actionText ?? "Left/Right click to view Production/Consumption for this item"
                });
            }
        });
        this.addEventListener('contextmenu', this.RightClick);
        this.addEventListener('click', this.LeftClick);
        this.UpdateIconId();
    }

    private StartOredictCycle(oredict: OreDict) {
        if (!oredict || oredict.items.length === 0) return;
        
        this.UpdateIconId();
        
        // Add to global cycle if not already there
        if (!oredictElements.includes(this)) {
            oredictElements.push(this);
        }
    }

    private StopOredictCycle() {
        const index = oredictElements.indexOf(this);
        if (index > -1) {
            oredictElements.splice(index, 1);
        }
    }

    UpdateIconId() {
        const obj = this.GetDisplayObject();
        if (obj) {
            this.style.setProperty('--icon-id', obj.iconId.toString());
            
            // Update tooltip if this element is currently being hovered
            if (IsHovered(this)) {
                ShowTooltip(this, { goods: obj });
            }
        }
    }

    static get observedAttributes() {
        return ['data-id'];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'data-id') {
            this.StopOredictCycle();
            this.obj = Repository.current.GetById<RecipeObject>(newValue);
            if (this.obj instanceof OreDict) {
                this.StartOredictCycle(this.obj);
            } else {
                this.UpdateIconId();
            }
        }
    }

    GetDisplayObject():Goods | null
    {
        if (this.obj instanceof Goods) {
            return this.obj;
        }

        if (this.obj instanceof OreDict) {
            return Repository.current.GetObject(this.obj.items[globalIndex % this.obj.items.length], Item);
        }

        return null;
    }

    disconnectedCallback()
    {
        this.StopOredictCycle();
        HideTooltip(this);
    }

    private HasCustomAction():boolean
    {
        return this.getAttribute('data-action') !== null;
    }

    RightClick(event:any)
    {
        if (this.HasCustomAction())
            return;
        if (event.ctrlKey || event.metaKey)
            return;
        event.preventDefault();
        ShowNei(this.obj, ShowNeiMode.Consumption, null);
    }

    LeftClick()
    {
        if (this.HasCustomAction())
            return;
        ShowNei(this.obj, ShowNeiMode.Production, null);
    }
}

customElements.define("item-icon", IconBox);
console.log("Registered custom element: item-icon");