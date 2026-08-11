import { Repository, Goods, OreDict, RecipeObject } from "./repository.js";
import { NeiSelect, ShowNei, ShowNeiMode } from "./nei.js";
import { ShowTooltip, HideTooltip, IsHovered, currentTooltipElement } from "./tooltip.js";

let globalIndex = 0;
let oredictElements: IconBox[] = [];

export const actions: { [key: string]: string } = {
    "item_icon_click": "Tap: recipe | Double tap: usage | Hold: name",
    "select": "Tap to select",
    "toggle_link_ignore": "Tap to toggle link ignore",
    "crafter_click": "Tap to select another crafter"
};

window.setInterval(() => {
    globalIndex++;
    for (const element of oredictElements) {
        element.UpdateIconId();
    }
}, 500);

let highlightStyle: HTMLStyleElement = document.getElementById('item-icon-highlight-style') as HTMLStyleElement;

function CloseCurrentTooltip() {
    if (currentTooltipElement) {
        HideTooltip(currentTooltipElement);
    }

    if (highlightStyle) {
        highlightStyle.textContent = "";
    }
}

function CloseTooltipIfOutside(event: Event) {
    const target = event.target as HTMLElement | null;

    if (!target) return;
    if (target.closest("item-icon")) return;
    if (target.closest("#tooltip")) return;

    CloseCurrentTooltip();
}

document.addEventListener("touchstart", CloseTooltipIfOutside, { passive: true, capture: true });
document.addEventListener("mousedown", CloseTooltipIfOutside, { passive: true, capture: true });
document.addEventListener("click", CloseTooltipIfOutside, { passive: true, capture: true });

document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        CloseCurrentTooltip();
    }
});

export class IconBox extends HTMLElement {
    public obj: RecipeObject | null = null;

    private touchTimer: number | null = null;
    private tapTimer: number | null = null;
    private lastTapTime = 0;
    private lastTouchTime = 0;
    private longPressShown = false;
    private touchMoved = false;
    private touchStartX = 0;
    private touchStartY = 0;

    constructor() {
        super();

        this.addEventListener("mouseenter", () => {
            this.ShowNameTooltip("Left click: recipe | Right click: usage");
        });

        this.addEventListener("mouseleave", () => {
            highlightStyle.textContent = '';
        });

        this.addEventListener("touchstart", (event: TouchEvent) => {
            event.preventDefault();
            event.stopPropagation();

            this.lastTouchTime = Date.now();
            this.longPressShown = false;
            this.touchMoved = false;

            const t = event.touches[0];
            this.touchStartX = t.clientX;
            this.touchStartY = t.clientY;

            this.ClearTouchTimer();

            this.touchTimer = window.setTimeout(() => {
                this.longPressShown = true;
                this.ShowNameTooltip("Hold: name | Tap: recipe | Double tap: usage");
            }, 450);
        }, { passive: false, capture: true });

        this.addEventListener("touchmove", (event: TouchEvent) => {
            const t = event.touches[0];
            const dx = Math.abs(t.clientX - this.touchStartX);
            const dy = Math.abs(t.clientY - this.touchStartY);

            if (dx > 10 || dy > 10) {
                this.touchMoved = true;
                this.ClearTouchTimer();
            }
        }, { passive: true, capture: true });

        this.addEventListener("touchend", (event: TouchEvent) => {
            event.preventDefault();
            event.stopPropagation();

            this.lastTouchTime = Date.now();
            this.ClearTouchTimer();

            if (this.touchMoved) return;
            if (this.longPressShown) return;

            const now = Date.now();

            if (now - this.lastTapTime < 320) {
                if (this.tapTimer !== null) {
                    window.clearTimeout(this.tapTimer);
                    this.tapTimer = null;
                }

                this.lastTapTime = 0;
                this.MobileUsage();
                return;
            }

            this.lastTapTime = now;

            if (this.tapTimer !== null) {
                window.clearTimeout(this.tapTimer);
            }

            this.tapTimer = window.setTimeout(() => {
                this.tapTimer = null;
                this.MobileProduction();
            }, 260);
        }, { passive: false, capture: true });

        this.addEventListener("contextmenu", (event: MouseEvent) => {
            if (Date.now() - this.lastTouchTime < 1500) {
                event.preventDefault();
                event.stopPropagation();
                this.ShowNameTooltip("Hold: name | Tap: recipe | Double tap: usage");
                return;
            }

            this.RightClick(event);
        }, true);

        this.addEventListener("click", (event: MouseEvent) => {
            if (Date.now() - this.lastTouchTime < 1000) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            this.LeftClick();
        }, true);

        this.UpdateIconId();
    }

    private ClearTouchTimer() {
        if (this.touchTimer !== null) {
            window.clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    private MobileProduction() {
        let action = this.CustomAction();

        if (action === "select") {
            NeiSelect(this.GetDisplayObject() as Goods);
            return;
        }

        if (action && action !== "item_icon_click") return;

        ShowNei(this.obj, ShowNeiMode.Production, null);
    }

    private MobileUsage() {
        let action = this.CustomAction();

        if (action === "select") {
            NeiSelect(this.GetDisplayObject() as Goods);
            return;
        }

        if (action && action !== "item_icon_click") return;

        ShowNei(this.obj, ShowNeiMode.Consumption, null);
    }

    private ShowNameTooltip(actionOverride?: string) {
        const obj = this.GetDisplayObject();

        if (obj) {
            const actionType = this.getAttribute('data-action');
            const actionText = actionType ? actions[actionType] : undefined;

            ShowTooltip(this, {
                goods: obj,
                action: actionText ?? actionOverride ?? "Item tooltip"
            });

            this.UpdateHighlightStyle();
        }
    }

    private StartOredictCycle(oredict: OreDict) {
        if (!oredict || oredict.items.length === 0) return;

        this.UpdateIconId();

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

    private UpdateHighlightStyle() {
        const currentIconId = this.obj?.id;

        if (currentIconId && !this.classList.contains('item-icon-grid')) {
            highlightStyle.textContent = `
                item-icon[data-id="${currentIconId}"] {
                    box-shadow: 0 0 0 2px #4CAF50;
                    background-color: #4CAF5020;
                }
            `;
        }
    }

    UpdateIconId() {
        const obj = this.GetDisplayObject();

        if (obj) {
            const iconId = obj.iconId;
            const ix = iconId % 256;
            const iy = Math.floor(iconId / 256);

            this.style.setProperty('--pos-x', `${ix * -32}px`);
            this.style.setProperty('--pos-y', `${iy * -32}px`);

            if (IsHovered(this)) {
                this.ShowNameTooltip();
            }
        }
    }

    static get observedAttributes() {
        return ['data-id'];
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'data-id') {
            this.StopOredictCycle();
            this.obj = Repository.current.GetById(newValue);

            if (this.obj instanceof OreDict) {
                this.StartOredictCycle(this.obj);
            } else {
                this.UpdateIconId();
            }
        }
    }

    GetDisplayObject(): Goods | null {
        if (this.obj instanceof Goods) {
            return this.obj;
        }

        if (this.obj instanceof OreDict) {
            return this.obj.items[globalIndex % this.obj.items.length];
        }

        return null;
    }

    disconnectedCallback() {
        this.StopOredictCycle();
        HideTooltip(this);

        if (IsHovered(this)) {
            highlightStyle.textContent = '';
        }
    }

    private CustomAction(): string | null {
        return this.getAttribute('data-action');
    }

    RightClick(event: any) {
        if (this.CustomAction()) return;
        if (event.ctrlKey || event.metaKey) return;

        event.preventDefault();
        ShowNei(this.obj, ShowNeiMode.Consumption, null);
    }

    LeftClick() {
        let action = this.CustomAction();

        if (action === "select") NeiSelect(this.GetDisplayObject() as Goods);
        if (action) return;

        ShowNei(this.obj, ShowNeiMode.Production, null);
    }
}

customElements.define("item-icon", IconBox);
console.log("Registered custom element: item-icon");