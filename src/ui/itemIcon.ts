import { Repository, Goods, Item, Fluid } from "../data/repository.js";
import { ShowNei, ShowNeiMode } from "./nei.js";
import { ShowTooltip, HideTooltip } from "./tooltip.js";

export class IconBox extends HTMLElement
{
    constructor()
    {
        super();
        this.addEventListener("mouseenter", () => ShowTooltip(this, this.GetDisplayObject()));
        this.addEventListener("mouseleave", () => HideTooltip(this));
        this.addEventListener('contextmenu', this.RightClick);
        this.addEventListener('click', this.LeftClick);
    }

    GetDisplayObject():Goods | null
    {
        var dataObj = this.getAttribute("data-obj");
        if (dataObj === null)
            return null;
        var ptr = Number.parseFloat(dataObj);
        if (ptr === 0)
            return null;
        else if (ptr > 0)
            return Repository.current.GetObject(ptr, Item);
        else return Repository.current.GetObject(-ptr, Fluid);
    }

    disconnectedCallback()
    {
        HideTooltip(this);
    }

    RightClick(event:any)
    {
        if (event.ctrlKey || event.metaKey)
            return;
        event.preventDefault();
        ShowNei(this.GetDisplayObject(), ShowNeiMode.Consumption);
    }

    LeftClick()
    {
        ShowNei(this.GetDisplayObject(), ShowNeiMode.Production);
    }
}

customElements.define("item-icon", IconBox);
console.log("Registered custom element: item-icon");